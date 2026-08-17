"use client";
import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import { db, getMistakes, removeMistake } from "@/lib/db";
import { Question, MistakeRecord, QuestionBank } from "@/lib/types";
import { useRouter } from "next/navigation";
import AIChat from "@/components/AIChat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { formatCjkMarkdown } from "@/lib/markdown";
import { useQuizStore } from "@/stores/quiz";
import { SparklesIcon, TrashIcon } from "@/components/Icons";
import { classifyQuestion } from "@/lib/quiz-engine";

type MistakeItem = MistakeRecord & { questionData?: Question, bankName?: string };

export default function MistakesPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | "all">("all");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chatQuestion, setChatQuestion] = useState<Question | null>(null);

  const loadData = React.useCallback(() => {
    (async () => {
      const allBanks = await db.banks.toArray();
      setBanks(allBanks);
      
      const m = await getMistakes(selectedBank === "all" ? undefined : selectedBank);
      
      const enriched: MistakeItem[] = await Promise.all(m.map(async (record) => {
        const q = await db.questions.get(record.questionId);
        const b = allBanks.find(item => item.id === record.bankId);
        return { ...record, questionData: q, bankName: b?.name };
      }));
      
      setMistakes(enriched.filter(item => item.questionData));
    })();
  }, [selectedBank]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (questionId: number) => {
    await removeMistake(questionId);
    loadData();
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const domainStats = React.useMemo(() => {
    const map = new Map<string, number>();
    mistakes.forEach(m => {
      const q = m.questionData;
      if (!q) return;
      const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
      map.set(tag, (map.get(tag) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [mistakes]);

  const filteredMistakes = React.useMemo(() => {
    if (selectedDomain === "all") return mistakes;
    return mistakes.filter(m => {
      const q = m.questionData;
      if (!q) return false;
      const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
      return tag === selectedDomain;
    });
  }, [mistakes, selectedDomain]);

  const handleReview = (reviewFilteredOnly: boolean = false) => {
    const targetList = reviewFilteredOnly && selectedDomain !== "all" ? filteredMistakes : mistakes;
    if (targetList.length === 0) return;
    const questionsToReview = targetList.map(m => m.questionData!).filter(Boolean);
    useQuizStore.getState().startMistakesQuiz(questionsToReview);
    router.push('/quiz');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>错题本</h1>
        <div className={styles.actions}>
          <select 
            className={styles.select}
            value={selectedBank}
            onChange={(e) => {
              setSelectedBank(e.target.value === "all" ? "all" : Number(e.target.value));
              setSelectedDomain("all");
            }}
          >
            <option value="all">所有题库</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={() => handleReview(false)} disabled={mistakes.length === 0}>
            一键复习全部 ({mistakes.length})
          </button>
        </div>
      </div>

      {mistakes.length > 0 && (
        <div className={styles.domainOverview}>
          <div className={styles.domainHeader}>
            <div className={styles.domainTitle}>
              <span>📊 知识薄弱领域分析</span>
              <span className={styles.domainSubtext}>
                （按错误频次排序，点击可筛选专项强化）
              </span>
            </div>
            {selectedDomain !== "all" && (
              <button
                type="button"
                className={styles.button}
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                onClick={() => handleReview(true)}
              >
                仅复习【{selectedDomain}】({filteredMistakes.length}题)
              </button>
            )}
          </div>
          <div className={styles.domainPills}>
            <button
              type="button"
              className={`${styles.domainPill} ${selectedDomain === "all" ? styles.domainPillActive : ""}`}
              onClick={() => setSelectedDomain("all")}
            >
              <span>全部领域</span>
              <span className={styles.domainCount}>{mistakes.length}</span>
            </button>
            {domainStats.map(([domain, count], idx) => (
              <button
                key={domain}
                type="button"
                className={`${styles.domainPill} ${selectedDomain === domain ? styles.domainPillActive : ""}`}
                onClick={() => setSelectedDomain(selectedDomain === domain ? "all" : domain)}
              >
                <span>{domain}</span>
                <span className={styles.domainCount}>{count}</span>
                {idx === 0 && count >= 2 && <span title="错题集中领域">⚠️</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {mistakes.length === 0 ? (
        <div className={styles.empty}>
          <h2>暂无错题记录 🎉</h2>
          <p>继续保持好成绩！</p>
        </div>
      ) : filteredMistakes.length === 0 ? (
        <div className={styles.empty} style={{ padding: '2rem' }}>
          <h3>该领域下暂无错题</h3>
          <button
            type="button"
            className={styles.button}
            style={{ marginTop: '1rem' }}
            onClick={() => setSelectedDomain("all")}
          >
            返回全部领域
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredMistakes.map(m => {
            const q = m.questionData!;
            const isExpanded = expanded[m.id!];
            const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
            return (
              <div key={m.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.tags}>
                    <span className={styles.domainBadge}>{tag}</span>
                    {m.bankName && <span className={styles.tag}>{m.bankName}</span>}
                  </div>
                  <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(m.id!)}>
                    {isExpanded ? "收起" : "展开详情"}
                  </button>
                </div>
                
                <div className={styles.question}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: ({ children }) => <span>{children}</span> }}
                  >
                    {formatCjkMarkdown((q.number ? `${q.number}. ` : "") + q.question)}
                  </ReactMarkdown>
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
                              <strong>{key}.</strong>{" "}
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{ p: ({ children }) => <span>{children}</span> }}
                              >
                                {formatCjkMarkdown(text)}
                              </ReactMarkdown>
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className={styles.explanation}>
                          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>【解析】：</div>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {formatCjkMarkdown(q.explanation)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button type="button" className={styles.actionBtn} onClick={() => setChatQuestion(q)}>
                    <SparklesIcon size={14} />
                    <span>AI 答疑</span>
                  </button>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => handleDelete(m.questionId)}>
                    <TrashIcon size={13} />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chatQuestion && (
        <AIChat
          question={chatQuestion}
          userAnswer={mistakes.find(m => m.questionId === chatQuestion.id)?.userAnswer}
          onClose={() => setChatQuestion(null)}
        />
      )}
    </div>
  );
}

