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
} 