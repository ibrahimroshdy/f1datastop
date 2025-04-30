import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
  paused: boolean;
}

export function Timer({ duration, onTimeUp, paused }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [progress, setProgress] = useState(100);
  
  useEffect(() => {
    setTimeLeft(duration);
    setProgress(100);
  }, [duration]);
  
  useEffect(() => {
    if (paused) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [duration, onTimeUp, paused]);
  
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
    <div className="w-full mb-8">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium">Time Remaining</span>
        <span className="text-sm font-medium">{timeLeft}s</span>
      </div>
      <Progress 
        value={progress} 
        className="h-2"
        indicatorClassName={getColorClass()}
      />
    </div>
  );
} 