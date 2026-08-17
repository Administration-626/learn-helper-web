"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useQuizStore } from "@/stores/quiz";
import { calculateStats, classifyQuestion } from "@/lib/quiz-engine";
import { getActiveLLMConfig } from "@/lib/db";
import { SparklesIcon } from "@/components/Icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { formatCjkMarkdown } from "@/lib/markdown";

export default function QuizResultPage() {
  const router = useRouter();
  const { currentSession, questions, resetQuiz } = useQuizStore();
  
  const [expandedMistake, setExpandedMistake] = useState<number | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const stats = React.useMemo(() => {
    if (!currentSession) return { total: 0, correct: 0, incorrect: 0, accuracy: 0, incorrectQuestions: [] };
    return calculateStats(currentSession.answers, questions);
  }, [currentSession, questions]);

  const domainSummary = React.useMemo(() => {
    const counts: Record<string, number> = {};
    stats.incorrectQuestions.forEach(q => {
      const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [stats.incorrectQuestions]);

  if (!currentSession) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <h2>没有正在进行的测试</h2>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/quiz")} style={{ marginTop: "1rem" }}>
            去刷题
          </button>
        </div>
      </div>
    );
  }

  const accuracyClass = 
    stats.accuracy >= 80 ? styles.accuracyGreen : 
    stats.accuracy >= 60 ? styles.accuracyAmber : 
    styles.accuracyRed;

  const handleRestart = () => {
    resetQuiz();
    router.push("/quiz");
  };

  const handleHome = () => {
    resetQuiz();
    router.push("/");
  };

  const requestAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis("");
    
    try {
      const activeConfig = await getActiveLLMConfig();
      if (!activeConfig) {
        setAiAnalysis("⚠️ 请先在【设置】页面配置大模型 API Key 后再使用 AI 智能分析功能。");
        setIsAnalyzing(false);
        return;
      }

      const customPrompt = typeof window !== "undefined" ? localStorage.getItem("analysisPrompt") : null;
      const systemPrompt = customPrompt || "你是一个专业的考试辅导专家，请根据用户的刷题成绩，分析薄弱知识点、错误原因并给出学习建议。";

      const domainBreakdownText = domainSummary.length > 0
        ? `\n- 薄弱考点领域分布: ${domainSummary.map(([d, c]) => `${d} (错 ${c} 题)`).join('、')}`
        : '';

      const prompt = `我刚刚完成了一次刷题测试：
- 总题数：${stats.total} 题
- 答对：${stats.correct} 题
- 答错：${stats.incorrect} 题
- 正确率：${stats.accuracy}%${domainBreakdownText}

错题列表：
${stats.incorrectQuestions.map((q, idx) => `${idx + 1}. [${q.tag || classifyQuestion(q)}] ${q.question}\n我的回答: ${currentSession.answers[q.id!] || "未答"}, 正确答案: ${q.answer}\n解析: ${q.explanation || "无"}`).join("\n\n")}

请对我的答题情况进行系统分析，指出薄弱知识点，并给出针对性的复习建议。`;
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          config: activeConfig
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `请求失败: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let content = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              content += parsed.choices?.[0]?.delta?.content || "";
            } catch {
              // buffer chunk was partial
            }
          }
        }
        setAiAnalysis(content);
      }
    } catch (error: unknown) {
      console.error("AI Analysis failed:", error);
      const msg = error instanceof Error ? error.message : "未知错误";
      setAiAnalysis(`AI 分析请求失败: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>测试结果</h1>
        
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>答题数</div>
            <div className={styles.statValue}>{stats.total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>错题数</div>
            <div className={styles.statValue} style={{ color: "var(--color-error)" }}>{stats.incorrect}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>正确率</div>
            <div className={`${styles.statValue} ${accuracyClass}`}>{stats.accuracy}%</div>
          </div>
        </div>

        {domainSummary.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)', marginRight: '8px' }}>📊 薄弱考点分布:</span>
            {domainSummary.map(([d, c], i) => (
              <span key={d} style={{ marginRight: '10px', color: 'var(--color-text-secondary)' }}>
                {d} <strong style={{ color: 'var(--color-error)' }}>({c}题)</strong>{i < domainSummary.length - 1 ? '、' : ''}
              </span>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button 
            type="button"
            className={`${styles.btn} ${styles.btnAi}`} 
            onClick={requestAiAnalysis}
            disabled={isAnalyzing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <SparklesIcon size={14} />
            <span>{isAnalyzing ? "正在智能分析..." : "AI 智能分析"}</span>
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleRestart}>再来一次</button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleHome}>返回首页</button>
        </div>
      </header>

      {aiAnalysis && (
        <div className={styles.aiAnalysis}>
          <h3>AI 学习分析与建议</h3>
          <div className={styles.aiContent} style={{ lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {formatCjkMarkdown(aiAnalysis)}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {stats.incorrectQuestions.length > 0 && (
        <div className={styles.mistakesSection}>
          <h2 className={styles.sectionTitle}>错题回顾 ({stats.incorrectQuestions.length})</h2>
          <div className={styles.mistakeList}>
            {stats.incorrectQuestions.map((q, idx) => {
              const tag = q.tag && q.tag.trim() ? q.tag.trim() : classifyQuestion(q);
              return (
                <div key={q.id} className={styles.mistakeCard}>
                  <div 
                    className={styles.mistakeHeader} 
                    onClick={() => setExpandedMistake(expandedMistake === q.id ? null : q.id!)}
                  >
                    <span className={styles.mistakeQuestion}>
                      <span style={{ fontSize: '0.78rem', padding: '2px 6px', background: 'rgba(37, 99, 235, 0.08)', color: '#1e40af', borderRadius: '4px', marginRight: '6px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                        {tag}
                      </span>
                      {idx + 1}. {q.question}
                    </span>
                    <span className={styles.expandIcon}>
                      {expandedMistake === q.id ? "▲" : "▼"}
                    </span>
                  </div>
                
                {expandedMistake === q.id && (
                  <div className={styles.mistakeDetails}>
                    <p style={{ fontWeight: 500, marginBottom: "0.75rem" }}>{q.question}</p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                      {Object.entries(q.options || {}).map(([key, text]) => (
                        <div key={key} style={{ color: q.answer.includes(key) ? "var(--color-success)" : "var(--color-text-secondary)" }}>
                          <strong>{key}.</strong> {text} {q.answer.includes(key) && "✓ (正确答案)"}
                        </div>
                      ))}
                    </div>

                    <div className={styles.answers}>
                      <span className={styles.userAnswer}>你的答案: {currentSession.answers[q.id!] || "未作答"}</span>
                      <span className={styles.correctAnswer}>正确答案: {q.answer}</span>
                    </div>

                    {q.explanation && (
                      <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
                        <strong>解析：</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

