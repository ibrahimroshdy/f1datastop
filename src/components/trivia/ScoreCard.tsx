import { GameState, TriviaScore } from "@/types/trivia";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Eye, Trophy, Target, Clock, RotateCcw, Medal, Flame, CheckCircle } from "lucide-react";

interface ScoreCardProps {
  gameState: GameState;
  timeSpent: number;
  onRestart: () => void;
  onViewLeaderboard: () => void;
  onReview: () => void;
}

export function ScoreCard({ 
  gameState, 
  timeSpent, 
  onRestart, 
  onViewLeaderboard, 
  onReview 
}: ScoreCardProps) {
  const { user } = useAuth();
  const correctAnswers = gameState.answers.filter(a => a.isCorrect).length;
  const totalQuestions = gameState.answers.length;
  const score = gameState.score;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  // Function to get performance message based on accuracy
  const getPerformanceMessage = () => {
    if (accuracy >= 90) return "Excellent! You're an F1 expert!";
    if (accuracy >= 70) return "Great job! You know your F1 facts!";
    if (accuracy >= 50) return "Good effort! Keep watching those races!";
    return "Keep practicing! You'll get better with time.";
  };
  
  // Function to get performance color
  const getPerformanceColor = () => {
    if (accuracy >= 90) return "text-green-500";
    if (accuracy >= 70) return "text-green-400";
    if (accuracy >= 50) return "text-yellow-500";
    return "text-red-500";
  };
  
  // Format time spent
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get performance icon
  const getPerformanceIcon = () => {
    if (accuracy >= 90) return <Trophy className="h-8 w-8 text-yellow-500" />;
    if (accuracy >= 70) return <Medal className="h-8 w-8 text-gray-400" />;
    if (accuracy >= 50) return <Target className="h-8 w-8 text-orange-500" />;
    return <Flame className="h-8 w-8 text-red-500" />;
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-t-4 border-t-primary overflow-hidden">
      <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent">
        {/* Checkered flag pattern decoration */}
        <div className="absolute top-0 left-0 right-0 h-2 checkered-bg opacity-30" />
        
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${
              accuracy >= 70 ? 'bg-yellow-500/30' : 'bg-primary/20'
            }`} />
            <div className={`relative p-4 rounded-full ${
              accuracy >= 90 ? 'bg-yellow-500/10' :
              accuracy >= 70 ? 'bg-green-500/10' :
              accuracy >= 50 ? 'bg-orange-500/10' : 'bg-red-500/10'
            }`}>
              {getPerformanceIcon()}
            </div>
          </div>
        </div>
        
        <Badge className="text-sm sm:text-base px-4 py-1.5 mb-3" variant="secondary">
          <CheckCircle className="h-4 w-4 mr-1.5" />
          Quiz Completed!
        </Badge>
        
        <CardTitle className="text-3xl sm:text-4xl font-bold tabular-nums">
          {score} <span className="text-lg font-normal text-muted-foreground">points</span>
        </CardTitle>
        
        <p className={`mt-3 text-sm sm:text-base font-semibold ${getPerformanceColor()}`}>
          {getPerformanceMessage()}
        </p>
      </CardHeader>
      
      <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Accuracy</p>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${getPerformanceColor()}`}>
              {accuracy}%
            </p>
            <Progress 
              value={accuracy} 
              className="h-1.5 mt-2"
            />
          </div>
          <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Time Spent</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-blue-500">
              {formatTime(timeSpent)}
            </p>
          </div>
        </div>
        
        <div className="space-y-3 sm:space-y-4 text-sm sm:text-base">
          <div className="flex justify-between">
            <span>Correct Answers:</span>
            <span className="font-medium">{correctAnswers} of {totalQuestions}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span>Average Time Per Question:</span>
            <span className="font-medium">
              {totalQuestions > 0 ? formatTime(Math.round(timeSpent / totalQuestions)) : '0s'}
            </span>
          </div>
          
          <Separator />
          
          {user ? (
            <div className="flex justify-between">
              <span>Saved to Your Profile:</span>
              <span className="font-medium text-green-500">Yes</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Score Saved:</span>
              <span className="font-medium text-yellow-500">Login to save scores</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3 sm:flex-row justify-center pt-4 sm:pt-6 border-t px-4 sm:px-6 bg-gradient-to-t from-muted/30 to-transparent">
        <Button 
          onClick={onRestart} 
          className="w-full sm:w-auto h-12 sm:h-11 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Play Again
        </Button>
        <Button 
          onClick={onReview}
          variant="secondary" 
          className="w-full sm:w-auto h-12 sm:h-11 text-base"
        >
          <Eye className="mr-2 h-4 w-4" /> 
          Review Answers
        </Button>
        <Button 
          onClick={onViewLeaderboard} 
          variant="outline" 
          className="w-full sm:w-auto h-12 sm:h-11 text-base"
        >
          <Trophy className="mr-2 h-4 w-4 text-yellow-500" />
          Leaderboard
        </Button>
      </CardFooter>
    </Card>
  );
} 