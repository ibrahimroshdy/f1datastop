import { GameState, TriviaScore } from "@/types/trivia";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";

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

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader className="text-center border-b pb-4">
        <div className="flex justify-center mb-3">
          <Badge className="text-sm sm:text-base px-3 py-1.5">Quiz Completed!</Badge>
        </div>
        <CardTitle className="text-xl sm:text-2xl">Your Score: {score} points</CardTitle>
        <p className={`mt-2 text-sm sm:text-base font-medium ${getPerformanceColor()}`}>
          {getPerformanceMessage()}
        </p>
      </CardHeader>
      
      <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{accuracy}%</p>
          </div>
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">Time Spent</p>
            <p className="text-xl sm:text-2xl font-bold">{formatTime(timeSpent)}</p>
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
      
      <CardFooter className="flex flex-col gap-3 sm:flex-row justify-center pt-4 sm:pt-6 border-t px-4 sm:px-6">
        <Button onClick={onRestart} className="w-full sm:w-auto h-11 sm:h-10">
          Play Again
        </Button>
        <Button 
          onClick={onReview}
          variant="secondary" 
          className="w-full sm:w-auto h-11 sm:h-10"
        >
          <Eye className="mr-2 h-4 w-4" /> Review Answers
        </Button>
        <Button 
          onClick={onViewLeaderboard} 
          variant="outline" 
          className="w-full sm:w-auto h-11 sm:h-10"
        >
          View Leaderboard
        </Button>
      </CardFooter>
    </Card>
  );
} 