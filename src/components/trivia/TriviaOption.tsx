import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TriviaOptionProps {
  option: string;
  selected: boolean;
  correctAnswer?: string;
  showResult: boolean;
  onSelect: () => void;
  disabled: boolean;
}

export function TriviaOption({
  option,
  selected,
  correctAnswer,
  showResult,
  onSelect,
  disabled
}: TriviaOptionProps) {
  // State to track hover
  const [hover, setHover] = useState(false);
  
  // Determine styles based on state
  const isCorrect = showResult && option === correctAnswer;
  const isIncorrect = showResult && selected && option !== correctAnswer;
  
  return (
    <Button
      className={cn(
        "w-full mb-3 text-left justify-start h-auto py-4 px-6 font-normal text-base transition-all",
        isCorrect && "bg-green-600 hover:bg-green-700 text-white",
        isIncorrect && "bg-red-600 hover:bg-red-700 text-white",
        selected && !showResult && "bg-f1-red hover:bg-f1-red/90 text-white",
        hover && !disabled && !showResult && !selected && "bg-accent",
        disabled && !selected && !isCorrect && "opacity-70"
      )}
      variant={selected && !showResult ? "default" : "outline"}
      onClick={onSelect}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {option}
      {isCorrect && (
        <span className="ml-auto text-white">✓</span>
      )}
      {isIncorrect && (
        <span className="ml-auto text-white">✗</span>
      )}
    </Button>
  );
} 