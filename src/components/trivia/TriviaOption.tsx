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
        // Base styles with improved mobile responsiveness
        "w-full text-left justify-start h-auto py-3 sm:py-4 px-4 sm:px-6 font-normal text-sm sm:text-base transition-all",
        // Better line height and text wrapping for mobile
        "leading-relaxed whitespace-normal break-words",
        // Improved touch targets for mobile
        "min-h-[48px] sm:min-h-[56px]",
        // Result states
        isCorrect && "bg-green-600 hover:bg-green-700 text-white",
        isIncorrect && "bg-red-600 hover:bg-red-700 text-white",
        // Selected state (before showing results)
        selected && !showResult && "bg-f1-red hover:bg-f1-red/90 text-white",
        // Hover state for non-disabled, non-selected options
        hover && !disabled && !showResult && !selected && "bg-accent",
        // Disabled state
        disabled && !selected && !isCorrect && "opacity-70"
      )}
      variant={selected && !showResult ? "default" : "outline"}
      onClick={onSelect}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="flex-grow pr-2">{option}</span>
      {isCorrect && (
        <span className="ml-auto text-white flex-shrink-0">✓</span>
      )}
      {isIncorrect && (
        <span className="ml-auto text-white flex-shrink-0">✗</span>
      )}
    </Button>
  );
} 