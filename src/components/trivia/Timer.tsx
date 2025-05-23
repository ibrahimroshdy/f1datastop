import { Progress } from "@/components/ui/progress";
import { useEffect, useState, useRef } from "react";

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
  paused: boolean;
}

export function Timer({ duration, onTimeUp, paused }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTime = useRef<number>(Date.now());
  
  // Reset timer when duration changes (new question)
  useEffect(() => {
    setTimeLeft(duration);
    setProgress(100);
    lastTickTime.current = Date.now();
  }, [duration]);
  
  // Handle timer logic with pause support
  useEffect(() => {
    if (paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    // Reset last tick time when resuming from pause
    lastTickTime.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [onTimeUp, paused]);
  
  // Update progress based on time left
  useEffect(() => {
    setProgress((timeLeft / duration) * 100);
  }, [timeLeft, duration]);
  
  // Determine color based on time left
  const getColorClass = () => {
    const percentage = (timeLeft / duration) * 100;
    if (percentage > 60) return "bg-green-500";
    if (percentage > 30) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  return (
    <div className="w-full mb-4 sm:mb-6 lg:mb-8">
      <div className="flex justify-between items-center mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">
          Time Remaining {paused && <span className="text-yellow-600">(Paused)</span>}
        </span>
        <span className="text-sm sm:text-base font-bold tabular-nums">
          {timeLeft}s
        </span>
      </div>
      <Progress 
        value={progress} 
        className="h-2 sm:h-3"
        indicatorClassName={getColorClass()}
      />
      {/* Warning text for low time on mobile */}
      {timeLeft <= 10 && timeLeft > 0 && !paused && (
        <div className="text-center mt-2">
          <span className="text-xs sm:text-sm text-red-600 font-medium animate-pulse">
            Hurry up! Only {timeLeft} seconds left!
          </span>
        </div>
      )}
    </div>
  );
} 