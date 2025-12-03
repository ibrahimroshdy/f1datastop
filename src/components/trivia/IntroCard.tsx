import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Play, Trophy, Info, EyeOff, Eye, Flag, Timer, Zap } from "lucide-react";
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
      <Card className="border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="text-center px-4 sm:px-6 bg-gradient-to-b from-primary/5 to-transparent pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-primary/10 p-4 rounded-full">
                <Flag className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
            F1 Trivia Challenge
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2">
            Test your Formula 1 knowledge with questions from 2005 onwards
          </CardDescription>
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
          
          {/* Privacy Settings - Enhanced with shadcn Switch */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isPublic ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                  {isPublic ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-orange-600" />
                  )}
            </div>
            <div>
                    <Label htmlFor="public-score" className="text-sm font-medium cursor-pointer">
                      Public Leaderboard
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPublic 
                        ? "Your score will be visible to everyone" 
                        : "Only you can see your score"}
                    </p>
                  </div>
            </div>
                <Switch
                  id="public-score"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  className="data-[state=checked]:bg-green-600"
                />
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
                    <p>• Game ends immediately if time runs out on any question</p>
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
      
        <CardFooter className="flex flex-col sm:flex-row gap-3 sm:gap-4 px-4 sm:px-6 bg-gradient-to-t from-muted/30 to-transparent pt-6">
        <Button 
            onClick={() => onStart(selectedMode, isPublic)} 
          className="w-full sm:flex-1 h-12 sm:h-11 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
          disabled={isLoading}
        >
          <Play className="mr-2 h-5 w-5" />
            Start {GAME_MODES[selectedMode].title}
        </Button>
          
        <Button 
            onClick={onViewLeaderboard} 
          variant="outline" 
          className="w-full sm:w-auto h-12 sm:h-11 text-base font-medium"
            disabled={isLoading}
        >
          <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
            Leaderboard
        </Button>
      </CardFooter>
    </Card>
    </div>
  );
} 