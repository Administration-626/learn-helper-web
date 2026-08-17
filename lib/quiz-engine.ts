import { Question, QuizMode } from '@/lib/types';

// Deterministic random shuffle using seed
export function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let currentSeed = seed;
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateQuestionOrder(total: number, mode: QuizMode, seed?: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  if (mode === 'random' && seed !== undefined) {
    return shuffleWithSeed(indices, seed);
  }
  return indices;
}

export function isMultiChoiceQuestion(question?: Question | Partial<Question> | null): boolean {
  if (!question) return false;
  if (question.type === 'multi') return true;
  const cleanAns = (question.answer || '').replace(/[^A-Za-z0-9]/g, '');
  return cleanAns.length > 1;
}

export function checkAnswer(userAnswer: string, correctAnswer: string, type?: 'single' | 'multi'): boolean {
  const cleanUser = (userAnswer || '').replace(/\s+/g, '').toUpperCase();
  const cleanCorrect = (correctAnswer || '').replace(/\s+/g, '').toUpperCase();

  const isMulti = type === 'multi' || cleanCorrect.length > 1;
  if (!isMulti) {
    return cleanUser === cleanCorrect;
  }
  
  // For multi-choice or multi-blank questions, sort letters before comparison
  const sortedUser = cleanUser.split('').sort().join('');
  const sortedCorrect = cleanCorrect.split('').sort().join('');
  return sortedUser === sortedCorrect;
}

export function calculateStats(answers: Record<number, string>, questions: Question[]) {
  let correct = 0;
  let incorrect = 0;
  const incorrectQuestions: Question[] = [];

  for (const [idStr, userAnswer] of Object.entries(answers)) {
    const qId = parseInt(idStr, 10);
    const question = questions.find(q => q.id === qId);
    
    if (question) {
      const isCorrect = checkAnswer(userAnswer, question.answer, question.type || 'single');
      if (isCorrect) {
        correct++;
      } else {
        incorrect++;
        incorrectQuestions.push(question);
      }
    }
  }

  const total = Object.keys(answers).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    total,
    correct,
    incorrect,
    accuracy,
    incorrectQuestions
  };
}
