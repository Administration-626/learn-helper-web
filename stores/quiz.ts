import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Question, QuizSession, QuizMode } from '@/lib/types';
import { getQuestions, addMistake } from '@/lib/db';
import { generateQuestionOrder, checkAnswer } from '@/lib/quiz-engine';

interface QuizState {
  currentSession: QuizSession | null;
  questions: Question[];
  orderedIndices: number[];
  isFinished: boolean;
  
  startQuiz: (bankId: number, mode: QuizMode) => Promise<void>;
  startMistakesQuiz: (mistakeQuestions: Question[]) => void;
  resumeQuiz: () => Promise<void>;
  answerQuestion: (questionId: number, answer: string) => Promise<void>;
  updateQuestionExplanation: (questionId: number, explanation: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => void;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      questions: [],
      orderedIndices: [],
      isFinished: false,

      startQuiz: async (bankId: number, mode: QuizMode) => {
        const questions = await getQuestions(bankId);
        const seed = mode === 'random' ? Date.now() : undefined;
        const orderedIndices = generateQuestionOrder(questions.length, mode, seed);

        set({
          questions,
          orderedIndices,
          currentSession: {
            bankId,
            mode,
            currentIndex: 0,
            answers: {},
            seed
          },
          isFinished: false
        });
      },

      startMistakesQuiz: (mistakeQuestions: Question[]) => {
        set({
          questions: mistakeQuestions,
          orderedIndices: Array.from({ length: mistakeQuestions.length }, (_, i) => i),
          currentSession: {
            bankId: -1,
            mode: 'sequential',
            currentIndex: 0,
            answers: {},
          },
          isFinished: false
        });
      },

      resumeQuiz: async () => {
        const { currentSession, questions } = get();
        if (currentSession && questions.length === 0) {
          const qs = await getQuestions(currentSession.bankId);
          const orderedIndices = generateQuestionOrder(qs.length, currentSession.mode, currentSession.seed);
          set({ questions: qs, orderedIndices });
        }
      },

      answerQuestion: async (questionId: number, answer: string) => {
        const { currentSession, questions } = get();
        if (!currentSession) return;

        const newAnswers = { ...currentSession.answers, [questionId]: answer };
        
        // Add mistake to DB if incorrect and not in recite mode
        if (currentSession.mode !== 'recite') {
          const question = questions.find(q => q.id === questionId);
          if (question && !checkAnswer(answer, question.answer, question.type || 'single')) {
            await addMistake(questionId, currentSession.bankId, answer);
          }
        }

        set({
          currentSession: {
            ...currentSession,
            answers: newAnswers
          }
        });
      },

      updateQuestionExplanation: (questionId: number, explanation: string) => {
        set((state) => ({
          questions: state.questions.map((q) =>
            q.id === questionId ? { ...q, explanation } : q
          ),
        }));
      },

      nextQuestion: () => {
        const { currentSession, orderedIndices } = get();
        if (currentSession && currentSession.currentIndex < orderedIndices.length - 1) {
          set({
            currentSession: {
              ...currentSession,
              currentIndex: currentSession.currentIndex + 1
            }
          });
        }
      },

      prevQuestion: () => {
        const { currentSession } = get();
        if (currentSession && currentSession.currentIndex > 0) {
          set({
            currentSession: {
              ...currentSession,
              currentIndex: currentSession.currentIndex - 1
            }
          });
        }
      },

      finishQuiz: () => {
        set({ isFinished: true });
      },

      resetQuiz: () => {
        set({ currentSession: null, questions: [], orderedIndices: [], isFinished: false });
      }
    }),
    {
      name: 'quiz-storage',
      partialize: (state) => ({ currentSession: state.currentSession })
    }
  )
);
