import { TriviaQuestion } from "@/types/trivia";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "./Timer";
import { TriviaOption } from "./TriviaOption";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QuestionCardProps {
  question: TriviaQuestion;
  onAnswer: (answer: string, isCorrect: boolean, timeTaken: number) => void;
  onNextQuestion: () => void;
  onTimeUp: () => void;
  isLastQuestion: boolean;
  questionNumber: number;
  totalQuestions: number;
  timeLimitPerQuestion: number;
}

export function QuestionCard({
  question,
  onAnswer,
  onNextQuestion,
  onTimeUp,
  isLastQuestion,
  questionNumber,
  totalQuestions,
  timeLimitPerQuestion
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  
  useEffect(() => {
    // Reset state when question changes
    setSelectedOption(null);
    setShowResult(false);
    setTimerPaused(false);
    setTimeTaken(0);
    setStartTime(Date.now());
  }, [question]);
  
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
  };
  
  const handleInternalTimeUp = () => {
    if (selectedOption || showResult) return;
    setTimerPaused(true);
    onTimeUp();
  };
  
  const handleNextQuestion = () => {
    onNextQuestion();
  };
  
  // Get difficulty badge color
  const getDifficultyColor = () => {
    switch (question.difficulty) {
      case 'easy': return 'bg-green-500 hover:bg-green-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'hard': return 'bg-red-500 hover:bg-red-600';
      default: return '';
    }
  };

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
          </div>
          <Badge variant="secondary" className="font-normal">
            {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
          </Badge>
        </div>
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
      <CardFooter className="border-t pt-4 flex justify-between min-h-[60px]">
        <div>
          {showResult && (
            <p className="text-sm opacity-80">
              {selectedOption === question.correctAnswer 
                ? <span className="text-green-600 font-medium">Correct! +{question.points} points</span> 
                : selectedOption 
                  ? <span className="text-red-600 font-medium">Incorrect. The answer was: {question.correctAnswer}</span> 
                  : <span className="text-orange-600 font-medium">Time ran out! Correct answer: {question.correctAnswer}</span>}
            </p>
          )}
        </div>
        {showResult && (
          <Button 
            onClick={handleNextQuestion}
            className="ml-auto"
          >
            {isLastQuestion ? "Finish Quiz" : "Next Question"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 