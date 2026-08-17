"use client";
import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import { db, getMistakes, removeMistake } from "@/lib/db";
import { Question, MistakeRecord, QuestionBank } from "@/lib/types";
import { useRouter } from "next/navigation";
import AIChat from "@/components/AIChat";

type MistakeItem = MistakeRecord & { questionData?: Question, bankName?: string };

export default function MistakesPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | "all">("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chatQuestion, setChatQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedBank]);

  const loadData = async () => {
    const allBanks = await db.banks.toArray();
    setBanks(allBanks);
    
    const m = await getMistakes(selectedBank === "all" ? undefined : selectedBank);
    
    // fetch questions
    const enriched: MistakeItem[] = await Promise.all(m.map(async (record) => {
      const q = await db.questions.get(record.questionId);
      const b = allBanks.find(b => b.id === record.bankId);
      return { ...record, questionData: q, bankName: b?.name };
    }));
    
    setMistakes(enriched.filter(m => m.questionData));
  };

  const handleDelete = async (questionId: number) => {
    await removeMistake(questionId);
    loadData();
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReview = () => {
    router.push(`/quiz`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>错题本</h1>
        <div className={styles.actions}>
          <select 
            className={styles.select}
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">所有题库</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={handleReview} disabled={mistakes.length === 0}>
            一键复习
          </button>
        </div>
      </div>

      {mistakes.length === 0 ? (
        <div className={styles.empty}>
          <h2>暂无错题记录 🎉</h2>
          <p>继续保持好成绩！</p>
        </div>
      ) : (
        <div className={styles.list}>
          {mistakes.map(m => {
            const q = m.questionData!;
            const isExpanded = expanded[m.id!];
            return (
              <div key={m.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.tags}>
                    {m.bankName && <span className={styles.tag}>{m.bankName}</span>}
                    {q.tag && <span className={styles.tag}>{q.tag}</span>}
                  </div>
                  <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(m.id!)}>
                    {isExpanded ? "收起" : "展开详情"}
                  </button>
                </div>
                
                <div className={styles.question}>
                  {q.number ? `${q.number}. ` : ""}{q.question}
                </div>

                <div className={styles.details}>
                  <p style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                    你的回答：<strong style={{ color: 'var(--color-error)' }}>{m.userAnswer}</strong>
                    <span style={{ margin: '0 8px' }}>|</span>
                    正确答案：<strong style={{ color: 'var(--color-success)' }}>{q.answer}</strong>
                  </p>
                  
                  {isExpanded && (
                    <>
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.entries(q.options || {}).map(([key, text]) => {
                          const isCorrect = q.answer.includes(key);
                          const isUserSelected = m.userAnswer.includes(key);
                          let optionClass = styles.option;
                          if (isCorrect) optionClass += ` ${styles.optionCorrect}`;
                          else if (isUserSelected) optionClass += ` ${styles.optionWrong}`;
                          
                          return (
                            <div key={key} className={optionClass}>
                              <strong>{key}.</strong> {text}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className={styles.explanation}>
                          <strong>解析：</strong> {q.explanation}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button type="button" className={styles.actionBtn} onClick={() => setChatQuestion(q)}>
                    🤖 问 AI
                  </button>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => handleDelete(m.questionId)}>
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chatQuestion && (
        <AIChat
          questionId={chatQuestion.id!}
          questionText={chatQuestion.question}
          onClose={() => setChatQuestion(null)}
        />
      )}
    </div>
  );
}

