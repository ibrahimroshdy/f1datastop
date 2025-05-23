import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Play, Trophy, Info, EyeOff, Eye } from "lucide-react";
import { GameMode } from "@/types/trivia";
import { GAME_MODES } from "@/services/triviaService";

interface IntroCardProps {
  onStart: (gameMode: GameMode, isPublic: boolean) => void;
  onViewLeaderboard: () => void;
  isLoading: boolean;
}

export function IntroCard({ onStart, onViewLeaderboard, isLoading }: IntroCardProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [isPublic, setIsPublic] = useState<boolean>(true);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">🏎️ F1 Trivia Challenge</CardTitle>
          <p className="text-sm sm:text-base text-muted-foreground">
            Test your Formula 1 knowledge with questions from 2005 onwards
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-center">Choose Your Game Mode</h3>
            
            <div className="grid gap-3 sm:gap-4">
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
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 sm:space-y-3 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg sm:text-xl">{mode.icon}</span>
                            <h3 className="text-sm sm:text-base font-semibold">{mode.title}</h3>
                          </div>
                          <Badge 
                            variant={mode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
                            className="text-xs self-start sm:self-center"
                          >
                            {mode.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {mode.description}
                        </p>
                        <div className="space-y-1">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rules:</h4>
                          {mode.rules.map((rule, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs">
                              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                              <span className="leading-relaxed">{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4 mt-1">
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

          {/* Privacy Settings - Mobile Optimized */}
          <Card className="bg-muted/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-0.5">
                  {isPublic ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-orange-600" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium">Leaderboard Visibility</h4>
                      <p className="text-xs text-muted-foreground">
                        Choose whether your score appears on the public leaderboard
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => setIsPublic(!isPublic)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isPublic ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isPublic ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs">
                    {isPublic ? (
                      <div className="flex items-center gap-1 text-green-700">
                        <Eye className="h-3 w-3" />
                        <span>Your score will appear on the public leaderboard</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-orange-700">
                        <EyeOff className="h-3 w-3" />
                        <span>Your score will be private (only you can see it)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* General Information - Mobile Optimized */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">General Information</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Questions cover drivers, teams, races, championships, and statistics</p>
                    <p>• Points are awarded based on difficulty, category, and year</p>
                    <p>• Time bonuses are given for quick correct answers</p>
                    <p>• All questions are from the 2005 F1 season onwards</p>
                    <p>• You can change your privacy settings for future games anytime</p>
                    
                    <div className="pt-2 border-t border-muted-foreground/20 mt-3">
                      <p className="font-medium text-blue-600">Mobile View Abbreviations:</p>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <div>
                          <p className="font-medium">Difficulty:</p>
                          <p>• E = Easy</p>
                          <p>• M = Medium</p>
                          <p>• H = Hard</p>
                        </div>
                        <div>
                          <p className="font-medium">Categories:</p>
                          <p>• D = Drivers</p>
                          <p>• T = Teams</p>
                          <p>• R = Races</p>
                          <p>• C = Championships</p>
                          <p>• S = Statistics</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-3 sm:gap-4 px-4 sm:px-6">
          <Button 
            onClick={() => onStart(selectedMode, isPublic)} 
            className="w-full sm:flex-1 h-11 sm:h-10"
            disabled={isLoading}
          >
            <Play className="mr-2 h-4 w-4" />
            Start {GAME_MODES[selectedMode].title}
          </Button>
          
          <Button 
            onClick={onViewLeaderboard} 
            variant="outline"
            className="w-full sm:w-auto h-11 sm:h-10"
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