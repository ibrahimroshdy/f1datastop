export interface TriviaQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  options: string[];
  category: TriviaCategory;
  difficulty: TriviaDifficulty;
  year?: number;
  points: number;
}

export interface TriviaScore {
  id?: string;
  userId: string;
  username: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number; // in seconds
  gameMode: GameMode;
  isPublic: boolean; // Whether the score should appear on public leaderboard
  createdAt: string;
}

export type TriviaCategory = 
  | 'drivers' 
  | 'teams' 
  | 'races' 
  | 'circuits' 
  | 'championships' 
  | 'statistics';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

export type GameMode = 'normal' | 'destructive';

export interface GameState {
  currentQuestion: number;
  score: number;
  answers: {
    questionId: string;
    userAnswer: string;
    isCorrect: boolean;
    timeTaken: number;
  }[];
  gameStarted: boolean;
  gameFinished: boolean;
  timeLeft: number;
  gameMode: GameMode;
  wrongAnswersCount: number; // Track wrong answers for destructive mode
  correctAnswersLost: number; // Track how many correct answers were lost
}

export interface GameModeInfo {
  mode: GameMode;
  title: string;
  description: string;
  rules: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  icon: string;
} 