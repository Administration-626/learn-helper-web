import Dexie, { type Table } from 'dexie';
import type { Question, QuestionBank, MistakeRecord, LLMConfig, ChatMessage } from '@/lib/types';

export class LearnHelperDatabase extends Dexie {
  questions!: Table<Question, number>;
  banks!: Table<QuestionBank, number>;
  mistakes!: Table<MistakeRecord, number>;
  llmConfigs!: Table<LLMConfig, number>;
  chatMessages!: Table<ChatMessage, number>;

  constructor() {
    super('LearnHelperDB');
    this.version(1).stores({
      questions: '++id, bankId, type',
      banks: '++id, name, createdAt',
      mistakes: '++id, questionId, bankId, createdAt',
      llmConfigs: '++id, name, isActive',
      chatMessages: '++id, questionId, createdAt'
    });
  }
}

export const db = new LearnHelperDatabase();

export async function importBank(name: string, questions: Question[]) {
  const validQuestions = questions.filter(q => q && q.question?.trim());
  return await db.transaction('rw', db.banks, db.questions, async () => {
    const bankId = await db.banks.add({
      name,
      createdAt: Date.now(),
      questionCount: validQuestions.length
    });

    const questionsWithBankId = validQuestions.map(q => {
      const cleanAns = (q.answer || '').replace(/\s+/g, '').toUpperCase();
      const isMulti = q.type === 'multi' || cleanAns.length > 1;
      return {
        ...q,
        bankId,
        answer: cleanAns,
        type: (isMulti ? 'multi' : 'single') as 'single' | 'multi'
      };
    });

    await db.questions.bulkAdd(questionsWithBankId);
    return bankId;
  });
}

export async function getQuestions(bankId: number) {
  return await db.questions.where('bankId').equals(bankId).toArray();
}

export async function addMistake(questionId: number, bankId: number, userAnswer: string) {
  const existing = await db.mistakes.where('questionId').equals(questionId).first();
  if (!existing) {
    await db.mistakes.add({
      questionId,
      bankId,
      userAnswer,
      createdAt: Date.now()
    });
  } else {
    await db.mistakes.update(existing.id!, { userAnswer, createdAt: Date.now() });
  }
}

export async function removeMistake(questionId: number) {
  await db.mistakes.where('questionId').equals(questionId).delete();
}

export async function deleteBank(bankId: number) {
  return await db.transaction('rw', db.banks, db.questions, db.mistakes, db.chatMessages, async () => {
    const qs = await db.questions.where('bankId').equals(bankId).toArray();
    const qIds = qs.map(q => q.id!).filter(Boolean);
    await db.banks.delete(bankId);
    await db.questions.where('bankId').equals(bankId).delete();
    await db.mistakes.where('bankId').equals(bankId).delete();
    if (qIds.length > 0) {
      await db.chatMessages.where('questionId').anyOf(qIds).delete();
    }
  });
}

export async function getMistakes(bankId?: number) {
  if (bankId !== undefined) {
    return await db.mistakes.where('bankId').equals(bankId).toArray();
  }
  return await db.mistakes.toArray();
}

export async function exportBank(bankId: number) {
  const questions = await getQuestions(bankId);
  return questions.map(q => {
    const copy = { ...q };
    delete copy.id;
    delete copy.bankId;
    return copy;
  });
}

export async function saveLLMConfig(config: LLMConfig) {
  return await db.transaction('rw', db.llmConfigs, async () => {
    if (config.isActive) {
      const configsToUpdate = await db.llmConfigs.toArray();
      for (const c of configsToUpdate) {
        if (c.id !== config.id && c.isActive) {
          await db.llmConfigs.update(c.id!, { isActive: false });
        }
      }
    }
    if (config.id) {
      await db.llmConfigs.put(config);
      return config.id;
    } else {
      return await db.llmConfigs.add(config);
    }
  });
}

export async function getActiveLLMConfig() {
  const configs = await db.llmConfigs.toArray();
  return configs.find(c => c.isActive) || null;
}

export async function saveChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>) {
  return await db.chatMessages.add({
    ...msg,
    createdAt: Date.now()
  });
}

export async function getChatMessages(questionId: number) {
  return await db.chatMessages
    .where('questionId')
    .equals(questionId)
    .sortBy('createdAt');
}

export async function clearChatMessages(questionId: number) {
  return await db.chatMessages.where('questionId').equals(questionId).delete();
}
