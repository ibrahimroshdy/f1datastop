import { TriviaScore } from "@/types/trivia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { formatDistance, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { getTopScores, getUserScores, updateScorePrivacy, GAME_MODES } from "@/services/triviaService";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Filter, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function Leaderboard() {
  const { user } = useAuth();
  const [topScores, setTopScores] = useState<TriviaScore[]>([]);
  const [userScores, setUserScores] = useState<TriviaScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("global");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [updatingScoreId, setUpdatingScoreId] = useState<string | null>(null);
  
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
  
  // Function to refresh leaderboard data
  const refreshLeaderboard = async () => {
    try {
      // Refresh global leaderboard to reflect privacy changes
      const tops = await getTopScores(30);
      setTopScores(tops);
    } catch (error) {
      console.error("Failed to refresh leaderboard:", error);
    }
  };
  
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
  
  // Toggle privacy setting for a score
  const togglePrivacy = async (scoreId: string, currentIsPublic: boolean) => {
    if (!scoreId) {
      toast.error("Cannot update score: Invalid score ID");
      return;
    }

    setUpdatingScoreId(scoreId);
    try {
      const newIsPublic = !currentIsPublic;
      await updateScorePrivacy(scoreId, newIsPublic);
      
      // Update the local state
      setUserScores(prev => 
        prev.map(score => 
          score.id === scoreId 
            ? { ...score, isPublic: newIsPublic }
            : score
        )
      );

      // Refresh the global leaderboard to reflect changes immediately
      await refreshLeaderboard();

      toast.success(
        newIsPublic 
          ? "Score is now visible on the public leaderboard" 
          : "Score is now hidden from the public leaderboard"
      );
    } catch (error) {
      console.error("Failed to toggle privacy:", error);
      toast.error("Failed to update privacy setting. Please try again.");
    } finally {
      setUpdatingScoreId(null);
    }
  };
  
  const filteredTopScores = filterScoresByMode(topScores);
  const filteredUserScores = filterScoresByMode(userScores);
  
  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="border-b pb-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">F1 Trivia Leaderboard</CardTitle>
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
      
      <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
        <Tabs 
          defaultValue="global" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
            <TabsTrigger value="global" className="text-xs sm:text-sm">Global Leaderboard</TabsTrigger>
            <TabsTrigger 
              value="personal" 
              disabled={!user}
              title={!user ? "Login to view your personal scores" : ""}
              className="text-xs sm:text-sm"
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
              <div className="text-center py-12 text-sm sm:text-base text-muted-foreground">
                {modeFilter === "all" ? "No scores yet. Be the first to play!" : `No scores for ${modeFilter} mode yet.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] sm:w-[80px] text-xs sm:text-sm">Rank</TableHead>
                      <TableHead className="text-xs sm:text-sm">Player</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Score</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm">Mode</TableHead>
                      <TableHead className="text-right hidden md:table-cell text-xs sm:text-sm">Accuracy</TableHead>
                      <TableHead className="text-right hidden md:table-cell text-xs sm:text-sm">Time</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTopScores.map((score, index) => (
                      <TableRow key={score.id || index}>
                        <TableCell className="font-medium text-xs sm:text-sm">#{index + 1}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="min-w-0">
                            <div className="truncate">{score.username}</div>
                            {user && score.userId === user.id && (
                              <span className="text-xs text-f1-red">(You)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs sm:text-sm">{score.score}</TableCell>
                        <TableCell className="text-center">
                          {getGameModeBadge(score.gameMode || 'normal')}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                          {Math.round((score.correctAnswers / score.totalQuestions) * 100)}%
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                          {formatTime(score.timeSpent)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {formatDate(score.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      <strong>Tip:</strong> Click on the privacy indicators to toggle whether your scores appear on the public leaderboard
                    </span>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-center">Mode</TableHead>
                      <TableHead className="text-right">Accuracy</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-center">Privacy</TableHead>
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
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePrivacy(score.id!, score.isPublic)}
                            disabled={updatingScoreId === score.id || !score.id}
                            className="h-auto p-1 hover:bg-muted/50"
                            title={score.isPublic ? "Click to make private" : "Click to make public"}
                          >
                            {updatingScoreId === score.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Updating...</span>
                              </div>
                            ) : score.isPublic ? (
                              <div className="flex items-center justify-center gap-1 hover:scale-105 transition-transform">
                                <Eye className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-600">Public</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1 hover:scale-105 transition-transform">
                                <EyeOff className="h-4 w-4 text-orange-600" />
                                <span className="text-xs text-orange-600">Private</span>
                              </div>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {score.correctAnswers}/{score.totalQuestions}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 