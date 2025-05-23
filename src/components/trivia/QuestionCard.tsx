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
  correctAnswersLost = 0
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
    if (selectedOption || showResult) return;
    setTimerPaused(true);
    setShowResult(true);
    onTimeUp();
    
    // Start auto-advance timer for timeout case too
    startAutoAdvance();
  };
  
  const handleNextQuestion = () => {
    cancelAutoAdvance();
    onNextQuestion();
  };
  
  const handleSkipQuestion = () => {
    if (onSkipQuestion) {
      cancelAutoAdvance();
      onSkipQuestion();
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
    <Card className="w-full max-w-4xl mx-auto">
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
          paused={timerPaused}
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
      
      <CardFooter className="border-t pt-4 flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center min-h-[120px]">
        {/* Skip button - full width on mobile */}
        <div className="w-full sm:w-auto flex justify-center sm:justify-start">
          {!showResult && onSkipQuestion && (
            <Button 
              onClick={handleSkipQuestion}
              variant="outline"
              size="sm"
              className="text-muted-foreground w-full sm:w-auto"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Question
            </Button>
          )}
        </div>
        
        {/* Result display - fixed height to prevent layout shifts */}
        <div className="flex-1 text-center px-2 min-h-[80px] flex items-center justify-center">
          {showResult ? (
            <div className="space-y-1.5 w-full max-w-md mx-auto">
              <p className="text-sm sm:text-base font-medium">
                {selectedOption === question.correctAnswer 
                  ? <span className="text-green-600">✅ Correct! +{question.points} points</span> 
                  : selectedOption 
                    ? <span className="text-red-600">❌ Incorrect</span> 
                    : <span className="text-orange-600">⏰ Time's up!</span>}
              </p>
              {selectedOption !== question.correctAnswer && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="block">Correct answer:</span>
                  <span className="font-medium text-foreground break-words">{question.correctAnswer}</span>
                </p>
              )}
              {/* Destructive mode warning for wrong answers */}
              {gameMode === 'destructive' && selectedOption !== question.correctAnswer && (
                <p className="text-xs text-destructive font-medium">
                  💥 Wrong answer! {wrongAnswersCount + 1}/2 towards losing a correct answer
                  {Math.floor((wrongAnswersCount + 1) / 2) > Math.floor(wrongAnswersCount / 2) && (
                    <span className="block text-red-600 font-bold animate-pulse">
                      ⚠️ Correct answer removed! Points deducted!
                    </span>
                  )}
                </p>
              )}
              {isAutoAdvancing && autoAdvanceTime > 0 && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  <span>Auto-advancing in {autoAdvanceTime}s</span>
                </div>
              )}
            </div>
          ) : (
            // Reserved space when no result is shown to maintain consistent layout
            <div className="w-full h-16 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50">Select an answer or skip this question</span>
            </div>
          )}
        </div>
        
        {/* Action buttons - responsive layout with fixed positioning */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 min-h-[44px] items-center justify-center sm:justify-end">
          {showResult && (
            <>
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
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 