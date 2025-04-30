import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Trophy, User, Clock, List } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface IntroCardProps {
  onStart: () => void;
  onViewLeaderboard: () => void;
  isLoading: boolean;
}

export function IntroCard({ onStart, onViewLeaderboard, isLoading }: IntroCardProps) {
  const { user } = useAuth();
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center border-b pb-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-f1-red flex items-center justify-center mb-4">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-3xl font-extrabold">
          F1 Trivia Challenge
        </CardTitle>
        <p className="text-muted-foreground mt-2">
          Test your Formula 1 knowledge with questions from 1950 to present day
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">15 Random Questions</h3>
              <p className="text-sm text-muted-foreground">
                Answer questions about drivers, teams, races, championships and more
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Timer Challenge</h3>
              <p className="text-sm text-muted-foreground">
                30 seconds per question - answer faster for a higher score
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <List className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Varying Difficulty</h3>
              <p className="text-sm text-muted-foreground">
                Questions range from easy to challenging - points awarded based on difficulty
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Global Leaderboard</h3>
              <p className="text-sm text-muted-foreground">
                Compete with other F1 fans around the world
              </p>
            </div>
          </div>
          
          {!user && (
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Create an Account</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up to save your scores and track your progress
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t">
        <Button 
          size="lg" 
          className="w-full sm:w-auto"
          onClick={onStart}
          disabled={isLoading}
        >
          {isLoading ? "Loading Questions..." : "Start Quiz"}
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full sm:w-auto"
          onClick={onViewLeaderboard}
        >
          View Leaderboard
        </Button>
      </CardFooter>
    </Card>
  );
} 