import { TriviaQuestion, GameMode } from "@/types/trivia";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "./Timer";
import { TriviaOption } from "./TriviaOption";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkipForward, Clock, AlertTriangle } from "lucide-react";
import { GAME_MODES } from "@/services/triviaService";

interface QuestionCardProps {
  question: TriviaQuestion;
  onAnswer: (answer: string, isCorrect: boolean, timeTaken: number) => void;
  onNextQuestion: () => void;
  onTimeUp: () => void;
  onSkipQuestion?: () => void;
  isLastQuestion: boolean;
  questionNumber: number;
  totalQuestions: number;
  timeLimitPerQuestion: number;
  gameMode: GameMode;
  wrongAnswersCount?: number;
  correctAnswersLost?: number;
  globalPaused?: boolean;
}

export function QuestionCard({
  question,
  onAnswer,
  onNextQuestion,
  onTimeUp,
  onSkipQuestion,
  isLastQuestion,
  questionNumber,
  totalQuestions,
  timeLimitPerQuestion,
  gameMode,
  wrongAnswersCount = 0,
  correctAnswersLost = 0,
  globalPaused = false
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [autoAdvanceTime, setAutoAdvanceTime] = useState(0);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-advance delay in seconds (time to show the result)
  const AUTO_ADVANCE_DELAY = 4;
  
  useEffect(() => {
    // Reset state when question changes
    setSelectedOption(null);
    setShowResult(false);
    setTimerPaused(false);
    setTimeTaken(0);
    setStartTime(Date.now());
    setAutoAdvanceTime(0);
    setIsAutoAdvancing(false);
    
    // Clear any existing timers
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [question]);
  
  const startAutoAdvance = () => {
    setIsAutoAdvancing(true);
    setAutoAdvanceTime(AUTO_ADVANCE_DELAY);
    
    // Start countdown
    countdownRef.current = setInterval(() => {
      setAutoAdvanceTime(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Auto advance after delay
    autoAdvanceRef.current = setTimeout(() => {
      handleNextQuestion();
    }, AUTO_ADVANCE_DELAY * 1000);
  };
  
  const cancelAutoAdvance = () => {
    setIsAutoAdvancing(false);
    setAutoAdvanceTime(0);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };
  
  const handleOptionSelect = (option: string) => {
    if (selectedOption || showResult) return;
    
    setSelectedOption(option);
    setTimerPaused(true);
    
    // Calculate time taken
    const endTime = Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    setTimeTaken(seconds);
    
    // Show the correct answer
    setShowResult(true);
    
    // Call parent handler
    const isCorrect = option === question.correctAnswer;
    onAnswer(option, isCorrect, seconds);
    
    // Start auto-advance timer
    startAutoAdvance();
  };
  
  const handleInternalTimeUp = () => {
    if (selectedOption || showResult || globalPaused) return;
    setTimerPaused(true);
    setShowResult(true);
    onTimeUp();
    
    // Don't start auto-advance for timeout - game will end immediately
  };
  
  const handleNextQuestion = () => {
    cancelAutoAdvance();
    onNextQuestion();
  };
  
  const handleSkipQuestion = () => {
    if (onSkipQuestion) {
      cancelAutoAdvance();
      // Instead of ending the game, treat as timeout and go to next question
      setTimerPaused(true);
      setShowResult(true);
      setSelectedOption(''); // Mark as skipped
      
      // Call parent handler with empty answer (skip)
      const endTime = Date.now();
      const seconds = Math.floor((endTime - startTime) / 1000);
      setTimeTaken(seconds);
      onAnswer('', false, seconds); // Empty answer counts as wrong
      
      // Start auto-advance timer
      startAutoAdvance();
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);
  
  // Get difficulty badge color
  const getDifficultyColor = () => {
    switch (question.difficulty) {
      case 'easy': return 'bg-green-500 hover:bg-green-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'hard': return 'bg-red-500 hover:bg-red-600';
      default: return '';
    }
  };

  // Get category abbreviation for mobile
  const getCategoryAbbreviation = (category: string) => {
    switch (category.toLowerCase()) {
      case 'drivers': return 'D';
      case 'teams': return 'T';
      case 'races': return 'R';
      case 'championships': return 'C';
      case 'statistics': return 'S';
      default: return category.charAt(0).toUpperCase();
    }
  };

  // Get difficulty abbreviation for mobile
  const getDifficultyAbbreviation = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'E';
      case 'medium': return 'M';
      case 'hard': return 'H';
      default: return difficulty.charAt(0).toUpperCase();
    }
  };

  const currentGameMode = GAME_MODES[gameMode];

  return (
    <Card className={`w-full max-w-4xl mx-auto relative ${globalPaused ? 'opacity-60' : ''}`}>
      {globalPaused && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Game Paused</h3>
            <p className="text-sm text-muted-foreground">Resume from the game controls above</p>
          </div>
        </div>
      )}
      <CardHeader className="border-b pb-3 sm:pb-4 space-y-2 sm:space-y-3">
        {/* Mobile-optimized compact header */}
        <div className="space-y-2 sm:space-y-3">
          {/* Single row for all badges on mobile, responsive layout on desktop */}
          <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2">
            {/* Left side - Question progress and difficulty */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Badge variant="outline" className="text-xs font-normal whitespace-nowrap px-1.5 sm:px-2.5 py-0.5">
                {questionNumber}/{totalQuestions}
              </Badge>
              <Badge className={`text-xs font-normal whitespace-nowrap px-1.5 sm:px-2.5 py-0.5 ${getDifficultyColor()}`}>
                <span className="sm:hidden">{getDifficultyAbbreviation(question.difficulty)}</span>
                <span className="hidden sm:inline">{question.difficulty.toUpperCase()}</span>
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap px-1.5 sm:px-2.5 py-0.5">
                <span className="sm:hidden">{getCategoryAbbreviation(question.category)}</span>
                <span className="hidden sm:inline">{question.category.charAt(0).toUpperCase() + question.category.slice(1)}</span>
            </Badge>
            </div>
            
            {/* Right side - Game mode */}
            <Badge 
              variant={currentGameMode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
              className="text-xs font-normal px-1.5 sm:px-2.5 py-0.5"
            >
              {currentGameMode.icon}
              <span className="hidden sm:inline ml-1">{currentGameMode.title}</span>
            </Badge>
          </div>
        </div>
        
        {/* Destructive mode warning - more compact on mobile */}
        {gameMode === 'destructive' && (wrongAnswersCount > 0 || correctAnswersLost > 0) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-destructive">Destructive</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs">
                  <span className="text-destructive">Wrong: {wrongAnswersCount}</span>
                  {correctAnswersLost > 0 && (
                    <span className="text-destructive">Lost: {correctAnswersLost}</span>
                  )}
                </div>
              </div>
              <span className="text-muted-foreground text-xs hidden sm:block">
                Every 2 wrong = -1 correct
              </span>
            </div>
          </div>
        )}
        
        {/* Question title with more compact spacing */}
        <CardTitle className="text-base sm:text-lg lg:text-xl font-bold leading-tight">
          {question.question}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Timer component */}
        <Timer
          duration={timeLimitPerQuestion}
          onTimeUp={handleInternalTimeUp}
          paused={timerPaused || globalPaused}
        />
        
        {/* Options with improved mobile spacing */}
        <div className="space-y-2 sm:space-y-3">
          {question.options.map((option) => (
            <TriviaOption
              key={option}
              option={option}
              selected={selectedOption === option}
              correctAnswer={showResult ? question.correctAnswer : undefined}
              showResult={showResult}
              onSelect={() => handleOptionSelect(option)}
              disabled={showResult || timerPaused}
            />
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="border-t pt-4 flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        {/* Result display or placeholder - more compact layout */}
        <div className="flex-1 text-center px-2">
          {showResult ? (
            <div className="space-y-2 max-w-sm mx-auto">
              {/* Main result feedback - more compact */}
              <div className="flex items-center justify-center gap-2">
                {selectedOption === question.correctAnswer ? (
                  <>
                    <span className="text-2xl">✅</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-green-600">Correct!</div>
                      <div className="text-xs text-muted-foreground">+{question.points} points</div>
                    </div>
                  </>
                ) : selectedOption === '' ? (
                  <>
                    <span className="text-2xl">⏭️</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-blue-600">Skipped</div>
                      <div className="text-xs text-muted-foreground truncate max-w-32">
                        {question.correctAnswer}
                      </div>
                    </div>
                  </>
                ) : selectedOption ? (
                  <>
                    <span className="text-2xl">❌</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-red-600">Incorrect</div>
                      <div className="text-xs text-muted-foreground truncate max-w-32">
                        {question.correctAnswer}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">⏰</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-orange-600">Time's up!</div>
                      <div className="text-xs text-muted-foreground truncate max-w-32">
                        {question.correctAnswer}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Destructive mode warning - more compact */}
              {gameMode === 'destructive' && (selectedOption !== question.correctAnswer) && (
                <div className="text-xs text-center">
                  <span className="text-destructive font-medium">
                    💥 {wrongAnswersCount + 1}/2 wrong
                  </span>
                  {Math.floor((wrongAnswersCount + 1) / 2) > Math.floor(wrongAnswersCount / 2) && (
                    <span className="block text-red-600 font-bold animate-pulse mt-1">
                      ⚠️ Correct answer removed!
                    </span>
                  )}
                </div>
              )}
              
              {/* Auto-advance timer - more compact */}
              {isAutoAdvancing && autoAdvanceTime > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Next in {autoAdvanceTime}s</span>
                </div>
              )}
            </div>
          ) : (
            // Compact placeholder
            <div className="py-3">
              <span className="text-sm text-muted-foreground">Choose your answer</span>
            </div>
          )}
        </div>
        
        {/* Action buttons - cleaner layout */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Skip/End Game button */}
          {!showResult && onSkipQuestion && (
            <Button 
              onClick={handleSkipQuestion}
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground w-full sm:w-auto order-2 sm:order-1"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Question
            </Button>
          )}
          
          {/* Next/Finish button */}
        {showResult && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
              {isAutoAdvancing && (
                <Button 
                  onClick={cancelAutoAdvance}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Cancel Auto-advance
                </Button>
              )}
          <Button 
            onClick={handleNextQuestion}
                className={`w-full sm:w-auto ${isAutoAdvancing ? "animate-pulse" : ""}`}
          >
            {isLastQuestion ? "Finish Quiz" : "Next Question"}
          </Button>
            </div>
        )}
        </div>
      </CardFooter>
    </Card>
  );
} 