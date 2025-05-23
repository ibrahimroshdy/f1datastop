import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { GameState, TriviaQuestion, TriviaScore, GameMode } from "@/types/trivia";
import { generateTriviaQuestions, saveScore, GAME_MODES } from "@/services/triviaService";
import { IntroCard } from "@/components/trivia/IntroCard";
import { QuestionCard } from "@/components/trivia/QuestionCard";
import { ScoreCard } from "@/components/trivia/ScoreCard";
import { Leaderboard } from "@/components/trivia/Leaderboard";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import MainLayout from "@/components/layout/MainLayout";
import { AnswerReview } from "@/components/trivia/AnswerReview";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, Home, LogIn, Trophy, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

// Simple Progress component if not available in ui
const Progress = ({ value, className = "" }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full ${className}`}>
    <div 
      className="bg-primary h-full rounded-full transition-all duration-300 ease-out" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// Login required component
const LoginRequired = () => {
  const navigate = useNavigate();
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-primary/10 p-3 rounded-full">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl sm:text-2xl">Login Required</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4 px-4 sm:px-6">
        <p className="text-sm sm:text-base text-muted-foreground">
          You need to be logged in to play F1 Trivia and compete on the leaderboard.
        </p>
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/auth/login')}
            className="w-full h-11 sm:h-10"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Login to Play
          </Button>
          <Button 
            onClick={() => navigate('/auth/signup')}
            variant="outline"
            className="w-full h-11 sm:h-10"
          >
            Create Account
          </Button>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground">
          <p className="font-medium mb-2">With an account you can:</p>
          <ul className="list-disc list-inside space-y-1 text-left">
            <li>Save your high scores</li>
            <li>Compete on the leaderboard</li>
            <li>Track your progress over time</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced game state with additional features
const initialGameState: GameState = {
  currentQuestion: 0,
  score: 0,
  answers: [],
  gameStarted: false,
  gameFinished: false,
  timeLeft: 0,
  gameMode: 'normal',
  wrongAnswersCount: 0,
  correctAnswersLost: 0
};

// Utility function to detect mobile devices
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640; // Tailwind's sm breakpoint
};

// Game statistics interface
interface GameStats {
  totalTimeSpent: number;
  averageTimePerQuestion: number;
  longestStreak: number;
  currentStreak: number;
  difficultyBreakdown: Record<string, { correct: number; total: number }>;
}

export default function Trivia() {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isLoading, setIsLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  const [isPublic, setIsPublic] = useState<boolean>(true); // Track privacy setting
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());
  const [gameStats, setGameStats] = useState<GameStats>({
    totalTimeSpent: 0,
    averageTimePerQuestion: 0,
    longestStreak: 0,
    currentStreak: 0,
    difficultyBreakdown: {}
  });
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  
  // Enhanced time configuration
  const TIME_LIMIT_PER_QUESTION = 45; // Increased from 30 to 45 seconds
  const QUESTIONS_PER_QUIZ = 15;
  const WARNING_TIME = 10; // Show warning when 10 seconds left
  
  // Refs for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mobile detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Check if user is authenticated
  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 flex-grow">
          <LoginRequired />
        </div>
      </MainLayout>
    );
  }
  
  // Enhanced reset function
  const resetGame = useCallback(() => {
    // Clear any running timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    
    setGameState(initialGameState);
    setQuestions([]);
    setStartTime(null);
    setEndTime(null);
    setShowLeaderboard(false);
    setShowReview(false);
    setIsPaused(false);
    setPausedTime(0);
    setIsPublic(true); // Reset privacy setting
    setGameStats({
      totalTimeSpent: 0,
      averageTimePerQuestion: 0,
      longestStreak: 0,
      currentStreak: 0,
      difficultyBreakdown: {}
    });
    setQuestionStartTime(null);
  }, []);
  
  // Enhanced game start with game mode selection and privacy setting
  const startGame = async (gameMode: GameMode, isPublicScore: boolean) => {
    try {
      setIsLoading(true);
      
      const loadedQuestions = await generateTriviaQuestions(QUESTIONS_PER_QUIZ);
      
      if (!loadedQuestions || loadedQuestions.length === 0) {
        toast.error("Could not load trivia questions. Please try again.");
        return;
      }
      
      // Only show warning if significantly fewer questions
      if (loadedQuestions.length < QUESTIONS_PER_QUIZ * 0.8) {
        toast.warning(`Only ${loadedQuestions.length} questions available.`);
      }
      
      setQuestions(loadedQuestions);
      setGameState({
        ...initialGameState,
        gameStarted: true,
        gameMode
      });
      setIsPublic(isPublicScore); // Store privacy setting
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      
      // Show game mode notification
      const modeInfo = GAME_MODES[gameMode];
      const privacyMsg = isPublicScore ? "" : " (private score)";
      toast.success(`${modeInfo.icon} Starting ${modeInfo.title}!${privacyMsg}`, {
        description: gameMode === 'destructive' ? "Remember: Every 2 wrong answers removes 1 correct answer!" : undefined,
        duration: 3000
      });
      
    } catch (error) {
      console.error("Failed to start game:", error);
      toast.error("Failed to load questions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Enhanced pause/resume functionality
  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      setPausedTime(prev => prev + (Date.now() - (questionStartTime || 0)));
      setQuestionStartTime(Date.now());
    } else {
      // Pause
      setIsPaused(true);
      setQuestionStartTime(null);
    }
  }, [isPaused, questionStartTime]);
  
  // Calculate destructive mode penalty
  const calculateDestructivePenalty = (wrongCount: number, currentCorrect: number) => {
    const correctToLose = Math.floor(wrongCount / 2);
    return Math.min(correctToLose, currentCorrect);
  };
  
  // Enhanced answer handling with destructive mode logic
  const handleAnswer = useCallback((answer: string, isCorrect: boolean, timeTaken: number) => {
    const currentQuestion = questions[gameState.currentQuestion];
    if (!currentQuestion) return;
    
    // Calculate time bonus with enhanced scoring
    const actualTimeTaken = Math.min(timeTaken, TIME_LIMIT_PER_QUESTION);
    const timeBonus = isCorrect ? Math.max(0, Math.floor((TIME_LIMIT_PER_QUESTION - actualTimeTaken) * 2)) : 0;
    const basePoints = currentQuestion.points || 10;
    const pointsEarned = isCorrect ? basePoints + timeBonus : 0;
    
    // Update game state with destructive mode logic
    setGameState(prev => {
      const newWrongCount = !isCorrect ? prev.wrongAnswersCount + 1 : prev.wrongAnswersCount;
      const newAnswers = [
        ...prev.answers,
        {
          questionId: currentQuestion.id,
          userAnswer: answer,
          isCorrect,
          timeTaken: actualTimeTaken
        }
      ];
      
      let newScore = prev.score + pointsEarned;
      let newCorrectAnswersLost = prev.correctAnswersLost;
      
      // Destructive mode: Check if we need to remove correct answers
      if (prev.gameMode === 'destructive' && !isCorrect) {
        const currentCorrectAnswers = newAnswers.filter(a => a.isCorrect).length;
        const shouldLoseCorrect = Math.floor(newWrongCount / 2) > Math.floor(prev.wrongAnswersCount / 2);
        
        if (shouldLoseCorrect && currentCorrectAnswers > 0) {
          // Find the most recent correct answer to "lose"
          const correctAnswersWithPoints = newAnswers
            .map((a, index) => ({ ...a, originalIndex: index }))
            .filter(a => a.isCorrect)
            .reverse(); // Start from most recent
          
          if (correctAnswersWithPoints.length > newCorrectAnswersLost) {
            newCorrectAnswersLost++;
            
            // Calculate lost points (approximate based on average points)
            const avgPointsPerCorrect = prev.score / Math.max(1, prev.answers.filter(a => a.isCorrect).length);
            const pointsToLose = Math.floor(avgPointsPerCorrect || basePoints);
            newScore = Math.max(0, newScore - pointsToLose);
            
            // Show destructive mode notification only on desktop
            if (!isMobile) {
              toast.error(`💥 2 wrong answers reached! Lost 1 correct answer (-${pointsToLose} points)`, {
                duration: 4000
              });
            }
          }
        }
      }
      
      return {
        ...prev,
        score: newScore,
        answers: newAnswers,
        wrongAnswersCount: newWrongCount,
        correctAnswersLost: newCorrectAnswersLost
      };
    });
    
    // Update game statistics
    setGameStats(prev => {
      const newStats = { ...prev };
      
      // Update streak
      if (isCorrect) {
        newStats.currentStreak = prev.currentStreak + 1;
        newStats.longestStreak = Math.max(prev.longestStreak, newStats.currentStreak);
      } else {
        newStats.currentStreak = 0;
      }
      
      // Update difficulty breakdown
      const difficulty = currentQuestion.difficulty || 'medium';
      if (!newStats.difficultyBreakdown[difficulty]) {
        newStats.difficultyBreakdown[difficulty] = { correct: 0, total: 0 };
      }
      newStats.difficultyBreakdown[difficulty].total++;
      if (isCorrect) {
        newStats.difficultyBreakdown[difficulty].correct++;
      }
      
      return newStats;
    });
    
    // Only show toast for streaks of 5+ or exceptional performance
    if (isCorrect && gameStats.currentStreak >= 4) {
      toast.success(`🔥 ${gameStats.currentStreak + 1} in a row!`, {
        duration: 2000,
      });
    }
    
    setQuestionStartTime(Date.now()); // Reset timer for next question
  }, [questions, gameState.currentQuestion, gameState.gameMode, gameState.wrongAnswersCount, gameState.correctAnswersLost, gameStats.currentStreak, TIME_LIMIT_PER_QUESTION]);
  
  // Enhanced next question handling
  const handleNextQuestion = useCallback(() => {
    const nextQuestionIndex = gameState.currentQuestion + 1;
    
    if (nextQuestionIndex >= questions.length) {
      finishGame();
    } else {
      setGameState(prev => ({
        ...prev,
        currentQuestion: nextQuestionIndex
      }));
      setQuestionStartTime(Date.now());
    }
  }, [gameState.currentQuestion, questions.length]);
  
  // Enhanced game finish with game mode context
  const finishGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameFinished: true
    }));
    setEndTime(Date.now());
    setQuestionStartTime(null);
    
    // Clear any running timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    
    // Show completion notification with mode context
    const correctAnswers = gameState.answers.filter(a => a.isCorrect).length;
    const effectiveCorrect = gameState.gameMode === 'destructive' 
      ? correctAnswers - gameState.correctAnswersLost
      : correctAnswers;
      
    const modeInfo = GAME_MODES[gameState.gameMode];
    toast.success(`${modeInfo.icon} ${modeInfo.title} completed!`, {
      description: gameState.gameMode === 'destructive' 
        ? `${correctAnswers}/${questions.length} correct (${gameState.correctAnswersLost} lost to destructive mode)`
        : `${correctAnswers}/${questions.length} correct`,
      duration: 4000,
    });
  }, [gameState.answers, gameState.gameMode, gameState.correctAnswersLost, questions.length]);
  
  // Enhanced time up handling with destructive mode logic
  const handleTimeUp = useCallback(() => {
    if (isPaused) return;
    
    const currentQuestion = questions[gameState.currentQuestion];
    if (!currentQuestion) return;

    // Handle timeout as wrong answer for destructive mode
    setGameState(prev => {
      const newWrongCount = prev.wrongAnswersCount + 1;
      const newAnswers = [
        ...prev.answers,
        {
          questionId: currentQuestion.id,
          userAnswer: "",
          isCorrect: false,
          timeTaken: TIME_LIMIT_PER_QUESTION
        }
      ];
      
      let newScore = prev.score;
      let newCorrectAnswersLost = prev.correctAnswersLost;
      
      // Destructive mode penalty for timeout
      if (prev.gameMode === 'destructive') {
        const currentCorrectAnswers = newAnswers.filter(a => a.isCorrect).length;
        const shouldLoseCorrect = Math.floor(newWrongCount / 2) > Math.floor(prev.wrongAnswersCount / 2);
        
        if (shouldLoseCorrect && currentCorrectAnswers > 0) {
          newCorrectAnswersLost++;
          const avgPointsPerCorrect = prev.score / Math.max(1, prev.answers.filter(a => a.isCorrect).length);
          const pointsToLose = Math.floor(avgPointsPerCorrect || 10);
          newScore = Math.max(0, newScore - pointsToLose);
        }
      }
      
      return {
        ...prev,
        answers: newAnswers,
        wrongAnswersCount: newWrongCount,
        correctAnswersLost: newCorrectAnswersLost,
        score: newScore,
        gameFinished: true // End the game immediately when time runs out
      };
    });
    
    // Update statistics for timeout
    setGameStats(prev => ({
      ...prev,
      currentStreak: 0
    }));
    
    // End the game immediately instead of going to next question
    setEndTime(Date.now());
    setQuestionStartTime(null);
    
    // Clear any running timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    
    // Show timeout notification
    toast.error("⏰ Time's up! Game ended.", {
      description: "The game ends when time runs out on any question.",
      duration: 3000
    });
    
  }, [isPaused, questions, gameState.currentQuestion, gameState.gameMode, gameState.wrongAnswersCount, gameState.answers, gameState.score, TIME_LIMIT_PER_QUESTION]);
  
  // Skip question functionality
  const handleSkipQuestion = useCallback(() => {
    // Skipping a question should end the game, same as timing out
    handleTimeUp();
  }, [handleTimeUp]);
  
  // Save score to leaderboard with game mode
  useEffect(() => {
    const saveUserScore = async () => {
      if (gameState.gameFinished && startTime && endTime && user && questions.length > 0) {
        try {
          const timeSpent = Math.floor((endTime - startTime) / 1000);
          const effectiveCorrectAnswers = gameState.gameMode === 'destructive' 
            ? Math.max(0, gameState.answers.filter(a => a.isCorrect).length - gameState.correctAnswersLost)
            : gameState.answers.filter(a => a.isCorrect).length;
            
          const score: TriviaScore = {
            userId: user.id,
            username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
            score: gameState.score,
            correctAnswers: effectiveCorrectAnswers,
            totalQuestions: questions.length,
            timeSpent,
            gameMode: gameState.gameMode,
            createdAt: new Date().toISOString(),
            isPublic: isPublic
          };
          
          await saveScore(score);
          
          // Show success for high scores or destructive mode completion
          if (gameState.score > 100 || gameState.gameMode === 'destructive') {
            const modeInfo = GAME_MODES[gameState.gameMode];
            toast.success(`${modeInfo.icon} High score saved to leaderboard! 🏆`, {
              duration: 3000
            });
          }
        } catch (error) {
          console.error("Failed to save score:", error);
          toast.error("Failed to save your score.");
        }
      }
    };
    
    saveUserScore();
  }, [gameState.gameFinished, startTime, endTime, user, profile, gameState.score, gameState.answers, gameState.gameMode, gameState.correctAnswersLost, questions, isPublic]);
  
  // Calculate total time spent in seconds with pause adjustments
  const getTotalTimeSpent = () => {
    if (!startTime || !endTime) return 0;
    return Math.floor((endTime - startTime - pausedTime) / 1000);
  };
  
  // Calculate game progress
  const getGameProgress = () => {
    if (questions.length === 0) return 0;
    return Math.round((gameState.currentQuestion / questions.length) * 100);
  };
  
  // Enhanced view rendering with game mode context
  const renderGameView = () => {
    if (showLeaderboard) {
      return (
        <>
          <Leaderboard />
          <div className="flex justify-center mt-8">
            <Button
              onClick={() => setShowLeaderboard(false)}
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              {gameState.gameFinished ? "Back to Score" : "Back to Game"}
            </Button>
          </div>
        </>
      );
    }

    if (showReview) {
      return (
        <>
          <AnswerReview questions={questions} answers={gameState.answers} />
          <div className="flex justify-center mt-8">
            <Button
              onClick={() => setShowReview(false)}
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Score
            </Button>
          </div>
        </>
      )
    }
    
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading questions...</p>
        </div>
      );
    }
    
    if (!gameState.gameStarted) {
      return (
        <IntroCard 
          onStart={(gameMode, isPublic) => startGame(gameMode, isPublic)} 
          onViewLeaderboard={() => setShowLeaderboard(true)}
          isLoading={isLoading}
        />
      );
    }
    
    if (gameState.gameFinished) {
      return (
        <ScoreCard
          gameState={gameState}
          timeSpent={getTotalTimeSpent()}
          onRestart={resetGame}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          onReview={() => setShowReview(true)}
        />
      );
    }
    
    const currentQ = questions[gameState.currentQuestion];
    if (!currentQ) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading question...</p>
        </div>
      )
    }

    const currentGameMode = GAME_MODES[gameState.gameMode];

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Game Progress and Controls - Mobile Optimized */}
        <div className="bg-card border rounded-lg p-3 sm:p-4">
          {/* Top stats row - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            {/* Stats - stacked on mobile, horizontal on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <div className="text-xs sm:text-sm font-medium">
                  Score: <span className="text-primary font-bold">{gameState.score}</span>
                </div>
                <div className="text-xs sm:text-sm font-medium">
                  Streak: <span className="text-orange-500 font-bold">{gameStats.currentStreak}</span>
                </div>
                <div className="text-xs sm:text-sm font-medium">
                  Progress: <span className="font-bold">{gameState.currentQuestion + 1}/{questions.length}</span>
                </div>
              </div>
              
              {/* Game mode badge - centered on mobile */}
              <div className="flex justify-center sm:justify-start">
                <Badge 
                  variant={currentGameMode.difficulty === 'Extreme' ? 'destructive' : 'secondary'}
                  className="text-xs whitespace-nowrap"
                >
                  {currentGameMode.icon} {currentGameMode.title}
                </Badge>
              </div>
            </div>
            
            {/* Control buttons - full width stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={togglePause}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
                disabled={false}
              >
                {isPaused ? (
                  <>
                    <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Pause
                  </>
                )}
              </Button>
              
              <Button
                onClick={resetGame}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm text-destructive hover:text-destructive"
              >
                Quit Game
              </Button>
            </div>
          </div>
          
          {/* Destructive mode status - mobile optimized */}
          {gameState.gameMode === 'destructive' && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">Destructive Mode</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm">
                    <span>Wrong: <span className="font-medium text-destructive">{gameState.wrongAnswersCount}</span></span>
                    <span>Lost: <span className="font-medium text-destructive">{gameState.correctAnswersLost}</span></span>
                  </div>
                </div>
                <span className="text-muted-foreground text-xs">
                  Next loss at {Math.ceil(gameState.wrongAnswersCount / 2) * 2} wrong answers
                </span>
              </div>
            </div>
          )}
          
          {/* Progress bar section */}
          <div className="space-y-1 sm:space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Question {gameState.currentQuestion + 1} of {questions.length}</span>
              <span>{getGameProgress()}% Complete</span>
            </div>
            <Progress value={getGameProgress()} className="h-1.5 sm:h-2" />
          </div>
        </div>

        {/* Pause Overlay - mobile optimized */}
        {isPaused && (
          <div className="bg-card border rounded-lg p-6 sm:p-8 text-center">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Game Paused</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Take your time! Click resume when you're ready to continue.
            </p>
            <Button onClick={togglePause} className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              Resume Game
            </Button>
          </div>
        )}

        {/* Question Card */}
        {!isPaused && (
          <QuestionCard
            question={currentQ}
            onAnswer={handleAnswer}
            onNextQuestion={handleNextQuestion}
            onTimeUp={handleTimeUp}
            onSkipQuestion={handleSkipQuestion}
            isLastQuestion={gameState.currentQuestion === questions.length - 1}
            questionNumber={gameState.currentQuestion + 1}
            totalQuestions={questions.length}
            timeLimitPerQuestion={TIME_LIMIT_PER_QUESTION}
            gameMode={gameState.gameMode}
            wrongAnswersCount={gameState.wrongAnswersCount}
            correctAnswersLost={gameState.correctAnswersLost}
          />
        )}
      </div>
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    };
  }, []);

  return (
    <MainLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 flex-grow">
        {renderGameView()}
      </div>
    </MainLayout>
  );
} 