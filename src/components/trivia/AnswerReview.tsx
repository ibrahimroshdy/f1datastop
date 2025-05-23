import { GameState, TriviaQuestion } from "@/types/trivia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnswerReviewProps {
  questions: TriviaQuestion[];
  answers: GameState['answers'];
}

export function AnswerReview({ questions, answers }: AnswerReviewProps) {
  
  const getAnswerForQuestion = (questionId: string) => {
    return answers.find(a => a.questionId === questionId);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center border-b pb-4">
        <CardTitle className="text-2xl">Quiz Review</CardTitle>
        <p className="text-muted-foreground">Check your answers below</p>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {questions.map((question, index) => {
          const userAnswerData = getAnswerForQuestion(question.id);
          const isCorrect = userAnswerData?.isCorrect ?? false;
          const userAnswer = userAnswerData?.userAnswer;
          const timedOut = !userAnswer && userAnswerData?.timeTaken === 30; // Check if timed out
          
          return (
            <div key={question.id} className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground mb-1">Question {index + 1}</p>
              <p className="font-semibold mb-3">{question.question}</p>
              
              <div className="space-y-2 mb-3">
                {question.options.map(option => (
                  <div 
                    key={option} 
                    className={cn(
                      "flex items-center p-2 rounded border text-sm",
                      option === question.correctAnswer && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300",
                      userAnswer === option && !isCorrect && "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300",
                      option !== question.correctAnswer && userAnswer !== option && "border-border"
                    )}
                  >
                    {option}
                    {option === question.correctAnswer && 
                      <CheckCircle className="ml-auto h-4 w-4 text-green-600" />}
                    {userAnswer === option && !isCorrect && 
                      <XCircle className="ml-auto h-4 w-4 text-red-600" />}
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="text-sm">
                <span className="font-medium">Your Answer: </span>
                {timedOut ? (
                  <span className="text-orange-600 flex items-center">
                    <MinusCircle className="h-4 w-4 mr-1" /> Timed Out
                  </span>
                ) : (
                  <span className={cn(
                    isCorrect ? "text-green-600" : "text-red-600"
                  )}>
                    {userAnswer || "(No Answer)"}
                  </span>
                )}
                {!isCorrect && (
                   <span className="ml-2 text-muted-foreground">(Correct: {question.correctAnswer})</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
} 