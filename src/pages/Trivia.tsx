import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { GameState, TriviaQuestion, TriviaScore } from "@/types/trivia";
import { generateTriviaQuestions, saveScore } from "@/services/triviaService";
import { IntroCard } from "@/components/trivia/IntroCard";
import { QuestionCard } from "@/components/trivia/QuestionCard";
import { ScoreCard } from "@/components/trivia/ScoreCard";
import { Leaderboard } from "@/components/trivia/Leaderboard";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import MainLayout from "@/components/layout/MainLayout";
import { AnswerReview } from "@/components/trivia/AnswerReview";

// Initial game state
const initialGameState: GameState = {
  currentQuestion: 0,
  score: 0,
  answers: [],
  gameStarted: false,
  gameFinished: false,
  timeLeft: 0
};

export default function Trivia() {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isLoading, setIsLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  
  // Time limit per question in seconds
  const TIME_LIMIT_PER_QUESTION = 30;
  // Number of questions per quiz
  const QUESTIONS_PER_QUIZ = 15;
  
  // Reset the game state
  const resetGame = () => {
    setGameState(initialGameState);
    setQuestions([]);
    setStartTime(null);
    setEndTime(null);
    setShowLeaderboard(false);
    setShowReview(false);
  };
  
  // Start the game by loading questions
  const startGame = async () => {
    try {
      setIsLoading(true);
      const loadedQuestions = await generateTriviaQuestions(QUESTIONS_PER_QUIZ);
      if (!loadedQuestions || loadedQuestions.length === 0) {
        toast.error("Could not load trivia questions. Please try again.");
        setIsLoading(false);
        return;
      }
      setQuestions(loadedQuestions);
      setGameState({
        ...initialGameState,
        gameStarted: true
      });
      setStartTime(Date.now());
    } catch (error) {
      console.error("Failed to start game:", error);
      toast.error("Failed to load questions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle answering a question
  const handleAnswer = (answer: string, isCorrect: boolean, timeTaken: number) => {
    const currentQuestion = questions[gameState.currentQuestion];
    if (!currentQuestion) return;
    
    const timeBonus = isCorrect ? Math.max(0, Math.floor((TIME_LIMIT_PER_QUESTION - timeTaken) / 2)) : 0;
    const pointsEarned = isCorrect ? currentQuestion.points + timeBonus : 0;
    
    setGameState(prev => ({
      ...prev,
      score: prev.score + pointsEarned,
      answers: [
        ...prev.answers,
        {
          questionId: currentQuestion.id,
          userAnswer: answer,
          isCorrect,
          timeTaken
        }
      ]
    }));
  };
  
  // Move to the next question or end the game
  const handleNextQuestion = () => {
    const nextQuestionIndex = gameState.currentQuestion + 1;
    
    if (nextQuestionIndex >= questions.length) {
      finishGame();
    } else {
      setGameState(prev => ({
        ...prev,
        currentQuestion: nextQuestionIndex
      }));
    }
  };

  // Function to finish the game
  const finishGame = () => {
    setGameState(prev => ({
      ...prev,
      gameFinished: true
    }));
    setEndTime(Date.now());
  };

  // Handle time up - End the game immediately
  const handleTimeUp = () => {
    toast.warning("Time's up for that question!");
    const currentQuestion = questions[gameState.currentQuestion];
    if (!currentQuestion) return;

    setGameState(prev => ({
      ...prev,
      answers: [
        ...prev.answers,
        {
          questionId: currentQuestion.id,
          userAnswer: "",
          isCorrect: false,
          timeTaken: TIME_LIMIT_PER_QUESTION
        }
      ]
    }));
    
    handleNextQuestion(); 
  };
  
  // Save score to leaderboard
  useEffect(() => {
    const saveUserScore = async () => {
      if (gameState.gameFinished && startTime && endTime && user && questions.length > 0) {
        try {
          const timeSpent = Math.floor((endTime - startTime) / 1000);
          const score: TriviaScore = {
            userId: user.id,
            username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
            score: gameState.score,
            correctAnswers: gameState.answers.filter(a => a.isCorrect).length,
            totalQuestions: questions.length,
            timeSpent,
            createdAt: new Date().toISOString()
          };
          
          await saveScore(score);
          toast.success("Your score has been saved to the leaderboard!");
        } catch (error) {
          console.error("Failed to save score:", error);
          toast.error("Failed to save your score. Please try again.");
        }
      }
    };
    
    saveUserScore();
  }, [gameState.gameFinished, startTime, endTime, user, profile, gameState.score, gameState.answers, questions]);
  
  // Calculate total time spent in seconds
  const getTotalTimeSpent = () => {
    if (!startTime || !endTime) return 0;
    return Math.floor((endTime - startTime) / 1000);
  };
  
  // View to display based on game state
  const renderGameView = () => {
    if (showLeaderboard) {
      return (
        <>
          <Leaderboard />
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="text-primary hover:underline"
            >
              {gameState.gameFinished ? "Back to Score" : "Back to Game"}
            </button>
          </div>
        </>
      );
    }

    if (showReview) {
      return (
        <>
          <AnswerReview questions={questions} answers={gameState.answers} />
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowReview(false)}
              className="text-primary hover:underline"
            >
              Back to Score
            </button>
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
          onStart={startGame} 
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

    return (
      <QuestionCard
        question={currentQ}
        onAnswer={handleAnswer}
        onNextQuestion={handleNextQuestion}
        onTimeUp={handleTimeUp}
        isLastQuestion={gameState.currentQuestion === questions.length - 1}
        questionNumber={gameState.currentQuestion + 1}
        totalQuestions={questions.length}
        timeLimitPerQuestion={TIME_LIMIT_PER_QUESTION}
      />
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 flex-grow">
        <h1 className="text-3xl font-bold mb-8 text-center">F1 Trivia Challenge</h1>
        {renderGameView()}
      </div>
    </MainLayout>
  );
} 