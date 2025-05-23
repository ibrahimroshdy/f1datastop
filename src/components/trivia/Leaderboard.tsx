import { TriviaScore } from "@/types/trivia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { formatDistance, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { getTopScores, getUserScores, GAME_MODES } from "@/services/triviaService";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

export function Leaderboard() {
  const { user } = useAuth();
  const [topScores, setTopScores] = useState<TriviaScore[]>([]);
  const [userScores, setUserScores] = useState<TriviaScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("global");
  const [modeFilter, setModeFilter] = useState<string>("all");
  
  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        // Load top 30 scores for global leaderboard
        const tops = await getTopScores(30);
        setTopScores(tops);
        
        // Load user's last 30 scores if logged in
        if (user) {
          const userResults = await getUserScores(user.id, 30);
          setUserScores(userResults);
        }
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLeaderboard();
  }, [user]);
  
  // Filter scores by game mode
  const filterScoresByMode = (scores: TriviaScore[]) => {
    if (modeFilter === "all") return scores;
    return scores.filter(score => score.gameMode === modeFilter);
  };
  
  // Format time duration
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Unknown";
    }
  };
  
  // Get game mode badge variant
  const getGameModeBadge = (gameMode: string) => {
    const mode = GAME_MODES[gameMode as keyof typeof GAME_MODES];
    if (!mode) return <Badge variant="outline">Normal</Badge>;
    
    return (
      <Badge 
        variant={mode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {mode.icon} {mode.title}
      </Badge>
    );
  };
  
  const filteredTopScores = filterScoresByMode(topScores);
  const filteredUserScores = filterScoresByMode(userScores);
  
  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-2xl">F1 Trivia Leaderboard</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="normal">🏎️ Normal Mode</SelectItem>
                <SelectItem value="destructive">💥 Destructive Mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <Tabs 
          defaultValue="global" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="global">Global Leaderboard</TabsTrigger>
            <TabsTrigger 
              value="personal" 
              disabled={!user}
              title={!user ? "Login to view your personal scores" : ""}
            >
              Your Scores
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="global">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredTopScores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {modeFilter === "all" ? "No scores yet. Be the first to play!" : `No scores for ${modeFilter} mode yet.`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Accuracy</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Time</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopScores.map((score, index) => (
                    <TableRow key={score.id || index}>
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell>
                        {score.username}
                        {user && score.userId === user.id && (
                          <span className="ml-2 text-xs text-f1-red">(You)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">{score.score}</TableCell>
                      <TableCell className="text-center">
                        {getGameModeBadge(score.gameMode || 'normal')}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {Math.round((score.correctAnswers / score.totalQuestions) * 100)}%
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {formatTime(score.timeSpent)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDate(score.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          
          <TabsContent value="personal">
            {!user ? (
              <div className="text-center py-12 text-muted-foreground">
                Please login to view your scores
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredUserScores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {modeFilter === "all" 
                  ? "You haven't played any games yet. Try playing one!" 
                  : `You haven't played any ${modeFilter} mode games yet.`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Questions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUserScores.map((score, index) => (
                    <TableRow key={score.id || index}>
                      <TableCell>{formatDate(score.createdAt)}</TableCell>
                      <TableCell className="text-right font-bold">{score.score}</TableCell>
                      <TableCell className="text-center">
                        {getGameModeBadge(score.gameMode || 'normal')}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round((score.correctAnswers / score.totalQuestions) * 100)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(score.timeSpent)}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {score.correctAnswers}/{score.totalQuestions}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 