import { Question, QuizMode } from '@/lib/types';

// Deterministic random shuffle using seed
export function shuffleWithSeed(arr: any[], seed: number) {
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

export function checkAnswer(userAnswer: string, correctAnswer: string, type: 'single' | 'multi'): boolean {
  if (type === 'single') {
    return userAnswer === correctAnswer;
  }
  
  // For multi-choice, order doesn't matter (e.g. "AB" == "BA")
  const sortedUser = userAnswer.split('').sort().join('');
  const sortedCorrect = correctAnswer.split('').sort().join('');
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
