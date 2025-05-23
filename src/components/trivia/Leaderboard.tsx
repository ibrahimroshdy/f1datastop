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
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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
  
  // Format date with shorter mobile version
  const formatDate = (dateString: string, useMobileFormat = isMobile) => {
    try {
      const date = new Date(dateString);
      const distance = formatDistanceToNow(date, { addSuffix: true });
      // For mobile, use shorter format
      if (useMobileFormat) {
        return distance
          .replace('about ', '')
          .replace(' ago', '')
          .replace('minute', 'min')
          .replace('minutes', 'min')
          .replace('hour', 'hr')
          .replace('hours', 'hr')
          .replace('day', 'd')
          .replace('days', 'd');
      }
      return distance;
    } catch (error) {
      return "Unknown";
    }
  };
  
  // Get compact game mode badge for mobile
  const getGameModeBadge = (gameMode: string, isMobile = false) => {
    const mode = GAME_MODES[gameMode as keyof typeof GAME_MODES];
    if (!mode) return <Badge variant="outline" className="text-xs px-1.5 py-0.5">N</Badge>;
    
    if (isMobile) {
      return (
        <Badge 
          variant={mode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
          className="text-xs px-1.5 py-0.5 font-medium"
          title={mode.title}
        >
          {mode.icon}
        </Badge>
      );
    }
    
    // Desktop/tablet: More compact with better styling
    return (
      <Badge 
        variant={mode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
        className="text-xs px-2.5 py-1 font-medium whitespace-nowrap"
        title={`${mode.title} - ${mode.difficulty} difficulty`}
      >
        <span className="mr-1">{mode.icon}</span>
        <span className="text-xs font-semibold">
          {mode.mode === 'normal' ? 'Normal' : 'Destructive'}
        </span>
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
      <CardHeader className="border-b pb-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">F1 Trivia Leaderboard</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[180px] font-medium">
                <SelectValue placeholder="Filter by mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium">All Modes</SelectItem>
                <SelectItem value="normal" className="font-medium">🏎️ Normal Mode</SelectItem>
                <SelectItem value="destructive" className="font-medium">💥 Destructive Mode</SelectItem>
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
            <TabsTrigger value="global" className="text-xs sm:text-sm font-medium">Global Leaderboard</TabsTrigger>
            <TabsTrigger 
              value="personal" 
              disabled={!user}
              title={!user ? "Login to view your personal scores" : ""}
              className="text-xs sm:text-sm font-medium"
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
                      {isMobile ? (
                        <>
                          <TableHead className="text-xs px-2 py-2 w-8 font-medium">#</TableHead>
                          <TableHead className="text-xs px-2 py-2 font-medium">Player & Score</TableHead>
                          <TableHead className="text-xs px-2 py-2 w-12 text-center font-medium">Mode</TableHead>
                          <TableHead className="text-xs px-2 py-2 w-14 text-right font-medium">Date</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="w-12 text-xs px-3 py-2.5 font-semibold text-muted-foreground">#</TableHead>
                          <TableHead className="text-xs px-3 py-2.5 min-w-0 font-semibold text-muted-foreground">Player</TableHead>
                          <TableHead className="text-right text-xs px-3 py-2.5 w-16 font-semibold text-muted-foreground">Score</TableHead>
                          <TableHead className="text-center text-xs px-3 py-2.5 w-20 font-semibold text-muted-foreground">Mode</TableHead>
                          <TableHead className="text-right hidden md:table-cell text-xs px-3 py-2.5 font-semibold text-muted-foreground">Accuracy</TableHead>
                          <TableHead className="text-right hidden md:table-cell text-xs px-3 py-2.5 font-semibold text-muted-foreground">Time</TableHead>
                          <TableHead className="text-right text-xs px-3 py-2.5 w-20 font-semibold text-muted-foreground">Date</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTopScores.map((score, index) => (
                      <TableRow key={score.id || index} className={isMobile ? "border-b" : "hover:bg-muted/30 transition-colors"}>
                        {isMobile ? (
                          <>
                            <TableCell className="font-bold text-sm px-2 py-3 text-primary">
                              #{index + 1}
                            </TableCell>
                            <TableCell className="px-2 py-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1 mr-2">
                                    <div className="font-semibold text-sm truncate text-foreground">
                                      {score.username}
                                    </div>
                                    {user && score.userId === user.id && (
                                      <span className="text-xs text-f1-red font-medium">(You)</span>
                                    )}
                                  </div>
                                  <span className="font-bold text-base text-primary">
                                    {score.score}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                  {Math.round((score.correctAnswers / score.totalQuestions) * 100)}% 
                                  <span className="mx-1">•</span> 
                                  {Math.floor(score.timeSpent / 60)}m
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center px-2 py-3">
                              {getGameModeBadge(score.gameMode || 'normal', true)}
                            </TableCell>
                            <TableCell className="text-right px-2 py-3">
                              <div className="text-xs text-muted-foreground font-medium">
                                {formatDate(score.createdAt, true)}
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-bold text-sm px-3 py-3 text-primary">
                              #{index + 1}
                            </TableCell>
                            <TableCell className="px-3 py-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-sm truncate text-foreground">
                                  {score.username}
                                </div>
                                {user && score.userId === user.id && (
                                  <span className="text-xs text-f1-red font-medium">(You)</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-base px-3 py-3 text-primary">
                              {score.score}
                            </TableCell>
                            <TableCell className="text-center px-3 py-3">
                              {getGameModeBadge(score.gameMode || 'normal', false)}
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell text-sm px-3 py-3 font-medium text-muted-foreground">
                              {Math.round((score.correctAnswers / score.totalQuestions) * 100)}%
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell text-sm px-3 py-3 font-medium text-muted-foreground">
                              {formatTime(score.timeSpent)}
                            </TableCell>
                            <TableCell className="text-right text-sm px-3 py-3 font-medium text-muted-foreground">
                              {formatDate(score.createdAt)}
                            </TableCell>
                          </>
                        )}
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
                <div className="bg-muted/30 rounded-lg p-3 border">
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="font-semibold text-foreground">Tip:</strong> Click on the privacy indicators to toggle whether your scores appear on the public leaderboard
                    </span>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isMobile ? (
                        <>
                          <TableHead className="text-xs px-2 py-2 w-14 font-medium">Date</TableHead>
                          <TableHead className="text-xs px-2 py-2 font-medium">Game Details</TableHead>
                          <TableHead className="text-xs px-2 py-2 w-14 text-center font-medium">Privacy</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-xs px-3 py-2.5 w-20 font-semibold text-muted-foreground">Date</TableHead>
                          <TableHead className="text-right text-xs px-3 py-2.5 w-16 font-semibold text-muted-foreground">Score</TableHead>
                          <TableHead className="text-center text-xs px-3 py-2.5 w-20 font-semibold text-muted-foreground">Mode</TableHead>
                          <TableHead className="text-right text-xs px-3 py-2.5 w-16 font-semibold text-muted-foreground">Acc%</TableHead>
                          <TableHead className="text-right text-xs px-3 py-2.5 w-16 font-semibold text-muted-foreground">Time</TableHead>
                          <TableHead className="text-center text-xs px-3 py-2.5 w-20 font-semibold text-muted-foreground">Privacy</TableHead>
                          <TableHead className="text-right hidden md:table-cell text-xs px-3 py-2.5 font-semibold text-muted-foreground">Questions</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserScores.map((score, index) => (
                      <TableRow key={score.id || index} className={isMobile ? "border-b" : "hover:bg-muted/30 transition-colors"}>
                        {isMobile ? (
                          <>
                            <TableCell className="text-xs px-2 py-3 align-top">
                              <div className="text-xs text-muted-foreground font-medium">
                                {formatDate(score.createdAt, true)}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-base text-primary">
                                    {score.score} pts
                                  </span>
                                  {getGameModeBadge(score.gameMode || 'normal', true)}
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                                  <span>{Math.round((score.correctAnswers / score.totalQuestions) * 100)}% accuracy</span>
                                  <span>{Math.floor(score.timeSpent / 60)}m</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">{score.correctAnswers}/{score.totalQuestions}</span> correct
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center px-2 py-3 align-top">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePrivacy(score.id!, score.isPublic)}
                                disabled={updatingScoreId === score.id || !score.id}
                                className="h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
                                title={score.isPublic ? "Click to make private" : "Click to make public"}
                              >
                                {updatingScoreId === score.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : score.isPublic ? (
                                  <Eye className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 text-orange-600" />
                                )}
                              </Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-sm px-3 py-3 font-medium text-muted-foreground">
                              {formatDate(score.createdAt)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-base px-3 py-3 text-primary">
                              {score.score}
                            </TableCell>
                            <TableCell className="text-center px-3 py-3">
                              {getGameModeBadge(score.gameMode || 'normal', false)}
                            </TableCell>
                            <TableCell className="text-right text-sm px-3 py-3 font-semibold">
                              {Math.round((score.correctAnswers / score.totalQuestions) * 100)}%
                            </TableCell>
                            <TableCell className="text-right text-sm px-3 py-3 font-medium text-muted-foreground">
                              {formatTime(score.timeSpent)}
                            </TableCell>
                            <TableCell className="text-center px-3 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePrivacy(score.id!, score.isPublic)}
                                disabled={updatingScoreId === score.id || !score.id}
                                className="h-auto p-2 hover:bg-muted/50 transition-colors rounded-md"
                                title={score.isPublic ? "Click to make private" : "Click to make public"}
                              >
                                {updatingScoreId === score.id ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground font-medium">Updating...</span>
                                  </div>
                                ) : score.isPublic ? (
                                  <div className="flex items-center justify-center gap-1.5 hover:scale-105 transition-transform">
                                    <Eye className="h-3.5 w-3.5 text-green-600" />
                                    <span className="text-xs text-green-600 font-medium">Public</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5 hover:scale-105 transition-transform">
                                    <EyeOff className="h-3.5 w-3.5 text-orange-600" />
                                    <span className="text-xs text-orange-600 font-medium">Private</span>
                                  </div>
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell text-sm px-3 py-3 font-medium text-muted-foreground">
                              <span className="font-semibold text-foreground">{score.correctAnswers}</span>
                              <span className="text-muted-foreground">/{score.totalQuestions}</span>
                            </TableCell>
                          </>
                        )}
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