import { TriviaQuestion, GameMode } from "@/types/trivia";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "./Timer";
import { TriviaOption } from "./TriviaOption";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkipForward, Clock } from "lucide-react";
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

  const currentGameMode = GAME_MODES[gameMode];

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="border-b pb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {questionNumber} of {totalQuestions}
            </Badge>
            <Badge className={`font-normal ${getDifficultyColor()}`}>
              {question.difficulty.toUpperCase()}
            </Badge>
            <Badge 
              variant={currentGameMode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
              className="font-normal"
            >
              {currentGameMode.icon} {currentGameMode.title}
            </Badge>
          </div>
          <Badge variant="secondary" className="font-normal">
            {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
          </Badge>
        </div>
        
        {/* Destructive mode warning */}
        {gameMode === 'destructive' && (wrongAnswersCount > 0 || correctAnswersLost > 0) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-destructive font-medium">
                  Wrong answers: {wrongAnswersCount}
                </span>
                {correctAnswersLost > 0 && (
                  <span className="text-destructive font-medium">
                    Correct answers lost: {correctAnswersLost}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                Every 2 wrong = -1 correct
              </span>
            </div>
          </div>
        )}
        
        <CardTitle className="text-xl font-bold">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Timer
          duration={timeLimitPerQuestion}
          onTimeUp={handleInternalTimeUp}
          paused={timerPaused}
        />
        
        <div className="flex flex-col gap-1">
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
      <CardFooter className="border-t pt-4 flex justify-between items-center min-h-[60px]">
        <div className="flex items-center gap-2">
          {!showResult && onSkipQuestion && (
            <Button 
              onClick={handleSkipQuestion}
              variant="outline"
              size="sm"
              className="text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip
            </Button>
          )}
        </div>
        
        <div className="flex-1 text-center">
          {showResult && (
            <div className="space-y-2">
              <p className="text-base font-medium">
                {selectedOption === question.correctAnswer 
                  ? <span className="text-green-600">✅ Correct! +{question.points} points</span> 
                  : selectedOption 
                    ? <span className="text-red-600">❌ Incorrect</span> 
                    : <span className="text-orange-600">⏰ Time's up!</span>}
              </p>
              {selectedOption !== question.correctAnswer && (
                <p className="text-sm text-muted-foreground">
                  Correct answer: <span className="font-medium text-foreground">{question.correctAnswer}</span>
                </p>
              )}
              {/* Destructive mode warning for wrong answers */}
              {gameMode === 'destructive' && selectedOption !== question.correctAnswer && (
                <p className="text-xs text-destructive">
                  💥 Wrong answer! {wrongAnswersCount + 1}/2 towards losing a correct answer
                </p>
              )}
              {isAutoAdvancing && autoAdvanceTime > 0 && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Auto-advancing in {autoAdvanceTime}s</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {showResult && (
            <>
              {isAutoAdvancing && (
                <Button 
                  onClick={cancelAutoAdvance}
                  variant="outline"
                  size="sm"
                >
                  Cancel Auto-advance
                </Button>
              )}
              <Button 
                onClick={handleNextQuestion}
                className={isAutoAdvancing ? "animate-pulse" : ""}
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