import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Play, Trophy, Info } from "lucide-react";
import { GameMode } from "@/types/trivia";
import { GAME_MODES } from "@/services/triviaService";

interface IntroCardProps {
  onStart: (gameMode: GameMode) => void;
  onViewLeaderboard: () => void;
  isLoading: boolean;
}

export function IntroCard({ onStart, onViewLeaderboard, isLoading }: IntroCardProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🏎️ F1 Trivia Challenge</CardTitle>
          <p className="text-muted-foreground">
            Test your Formula 1 knowledge with questions from 2005 onwards
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Choose Your Game Mode</h3>
            
            <div className="grid gap-4">
              {Object.values(GAME_MODES).map((mode) => (
                <Card 
                  key={mode.mode}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedMode === mode.mode 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedMode(mode.mode)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{mode.icon}</span>
                          <h3 className="font-semibold">{mode.title}</h3>
                          <Badge 
                            variant={mode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {mode.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {mode.description}
                        </p>
                        <div className="space-y-1">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rules:</h4>
                          {mode.rules.map((rule, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          selectedMode === mode.mode 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground'
                        }`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">General Information</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Questions cover drivers, teams, races, championships, and statistics</p>
                    <p>• Points are awarded based on difficulty, category, and year</p>
                    <p>• Time bonuses are given for quick correct answers</p>
                    <p>• All questions are from the 2005 F1 season onwards</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
        
        <CardFooter className="flex gap-4">
          <Button 
            onClick={() => onStart(selectedMode)} 
            className="flex-1"
            disabled={isLoading}
          >
            <Play className="mr-2 h-4 w-4" />
            Start {GAME_MODES[selectedMode].title}
          </Button>
          
          <Button 
            onClick={onViewLeaderboard} 
            variant="outline"
            disabled={isLoading}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Leaderboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 