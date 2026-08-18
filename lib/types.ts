export interface Question {
  id?: number; // auto-increment in IndexedDB
  bankId?: number; // which bank this belongs to
  year?: string | number;
  month?: string | number;
  number?: number;
  tag?: string;
  question: string;
  options: Record<string, string>; // {"A": "...", "B": "..."}
  answer: string; // "B" or "BC"
  type?: 'single' | 'multi'; // defaults to 'single'
  explanation?: string;
}

// Question bank
export interface QuestionBank {
  id?: number;
  name: string;
  createdAt: number;
  questionCount: number;
}

// Mistake record
export interface MistakeRecord {
  id?: number;
  questionId: number;
  bankId: number;
  userAnswer: string;
  createdAt: number;
}

// Quiz session
export interface QuizSession {
  bankId: number;
  mode: QuizMode;
  currentIndex: number;
  answers: Record<number, string>; // questionId -> userAnswer
  seed?: number; // for random mode persistence
}

// LLM config
export interface LLMConfig {
  id?: number;
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  isActive: boolean;
}

// Chat message
export interface ChatMessage {
  id?: number;
  questionId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export type QuizMode = 'sequential' | 'random' | 'recite' | 'exam';
