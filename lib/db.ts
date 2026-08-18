import Dexie, { type Table } from 'dexie';
import type { Question, QuestionBank, MistakeRecord, LLMConfig, ChatMessage } from '@/lib/types';
import { classifyQuestion } from '@/lib/quiz-engine';

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
      chatMessages: '++id, questionId, role, createdAt'
    });
  }
}

export const db = new LearnHelperDatabase();

export function getQuestionKey(q: Partial<Question>): string {
  if (q.year && q.month && q.number) {
    return `${q.year}-${q.month}-${q.number}`;
  }
  return (q.question || '').slice(0, 80).trim();
}

export async function importBank(name: string, questions: Question[]) {
  const res = await updateOrImportBank(name, questions);
  return res.bankId;
}

export async function updateOrImportBank(name: string, questions: Question[], targetBankId?: number) {
  const validQuestions = questions.filter(q => q && q.question?.trim());
  return await db.transaction('rw', db.banks, db.questions, db.mistakes, async () => {
    let existingBank: QuestionBank | undefined;
    if (targetBankId !== undefined) {
      existingBank = await db.banks.get(targetBankId);
    } else {
      existingBank = await db.banks.where('name').equals(name).first();
    }

    if (!existingBank) {
      const bankId = await db.banks.add({
        name,
        createdAt: Date.now(),
        questionCount: validQuestions.length
      });

      const questionsWithBankId = validQuestions.map(q => {
        const cleanAns = (q.answer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const isMulti = q.type === 'multi' || cleanAns.length > 1;
        const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
        return {
          ...q,
          bankId,
          tag,
          answer: cleanAns,
          type: (isMulti ? 'multi' : 'single') as 'single' | 'multi'
        };
      });

      await db.questions.bulkAdd(questionsWithBankId);
      return { bankId, isUpdate: false, count: validQuestions.length };
    }

    const bankId = existingBank.id!;
    const oldQuestions = await db.questions.where('bankId').equals(bankId).toArray();
    const oldMap = new Map<string, Question>();
    for (const oq of oldQuestions) {
      oldMap.set(getQuestionKey(oq), oq);
    }

    const toPut: Question[] = [];
    const toAdd: Question[] = [];

    for (const q of validQuestions) {
      const cleanAns = (q.answer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const isMulti = q.type === 'multi' || cleanAns.length > 1;
      const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
      const key = getQuestionKey(q);
      const oldQ = oldMap.get(key);

      if (oldQ && oldQ.id) {
        toPut.push({
          ...q,
          id: oldQ.id,
          bankId,
          tag,
          answer: cleanAns,
          type: (isMulti ? 'multi' : 'single') as 'single' | 'multi',
          explanation: oldQ.explanation || q.explanation || '',
        });
      } else {
        toAdd.push({
          ...q,
          bankId,
          tag,
          answer: cleanAns,
          type: (isMulti ? 'multi' : 'single') as 'single' | 'multi',
        });
      }
    }

    if (toPut.length > 0) {
      await db.questions.bulkPut(toPut);
    }
    if (toAdd.length > 0) {
      await db.questions.bulkAdd(toAdd);
    }

    const totalCount = toPut.length + toAdd.length;
    await db.banks.update(bankId, { questionCount: totalCount });

    return { bankId, isUpdate: true, count: totalCount };
  });
}

export async function getQuestions(bankId: number) {
  const list = await db.questions.where('bankId').equals(bankId).toArray();
  return list.map(q => {
    const cleanAns = (q.answer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const isMulti = q.type === 'multi' || cleanAns.length > 1;
    const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
    return {
      ...q,
      tag,
      answer: cleanAns,
      type: (isMulti ? 'multi' : 'single') as 'single' | 'multi'
    };
  });
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

export async function updateQuestionExplanation(questionId: number, explanation: string) {
  if (!questionId) return;
  return await db.questions.update(questionId, { explanation });
}
