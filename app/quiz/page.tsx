"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useQuizStore } from "@/stores/quiz";
import { db, getQuestions } from "@/lib/db";
import { generateQuestionOrder, isMultiChoiceQuestion, toggleOptionSelection } from "@/lib/quiz-engine";
import type { QuestionBank, QuizMode } from "@/lib/types";
import QuestionCard from "@/components/QuestionCard";
import AIChat, { type AIChatLayout } from "@/components/AIChat";
import { SparklesIcon } from "@/components/Icons";

export default function QuizPage() {
  const router = useRouter();
  const { currentSession, questions, orderedIndices, startQuiz, answerQuestion, nextQuestion, prevQuestion, finishQuiz, resetQuiz } = useQuizStore();
  
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | "">("");
  const [selectedMode, setSelectedMode] = useState<QuizMode>("sequential");
  const [isLoading, setIsLoading] = useState(true);
  
  // Local state for the current question
  const [localAnswer, setLocalAnswer] = useState<string>("");
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiLayout, setAiLayout] = useState<AIChatLayout>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ai_layout_mode") as AIChatLayout) || "split";
    }
    return "split";
  });

  const handleLayoutChange = (mode: AIChatLayout) => {
    setAiLayout(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_layout_mode", mode);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const allBanks = await db.banks.toArray();
        setBanks(allBanks);
        if (allBanks.length > 0) {
          setSelectedBankId(prev => (prev === "" ? allBanks[0].id! : prev));
        }

        const state = useQuizStore.getState();
        if (state.currentSession) {
          if (state.currentSession.bankId === -1) {
            if (state.questions.length === 0) {
              state.resetQuiz();
            }
          } else if (state.questions.length === 0) {
            const qs = await getQuestions(state.currentSession.bankId);
            if (qs.length === 0) {
              state.resetQuiz();
            } else {
              const ordered = generateQuestionOrder(qs.length, state.currentSession.mode, state.currentSession.seed);
              useQuizStore.setState({ questions: qs, orderedIndices: ordered });
            }
          }
        }
      } catch (err) {
        console.error("Failed to init quiz:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleStart = async () => {
    if (selectedBankId === "") return;
    setIsLoading(true);
    await startQuiz(Number(selectedBankId), selectedMode);
    setIsLoading(false);
  };

  if (isLoading) {
    return <div className={styles.container}><div className={styles.loading}>加载中...</div></div>;
  }

  if (banks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCard} style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📚</div>
          <h1 className={styles.title} style={{ marginBottom: "0.5rem" }}>暂无可用题库</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
            请先导入题库或载入内置真题题库开始刷题。
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              type="button"
              className={styles.startBtn}
              onClick={() => router.push("/bank")}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              前往题库管理
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCard}>
          <h1 className={styles.title}>开始刷题</h1>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>选择题库</label>
            <select 
              className={styles.select}
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(Number(e.target.value))}
            >
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.questionCount}题)</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>选择模式</label>
            <div className={styles.modeOptions}>
              <div 
                className={`${styles.modeOption} ${selectedMode === "sequential" ? styles.active : ""}`}
                onClick={() => setSelectedMode("sequential")}
                title="即选即判，适合日常单题深入攻坚"
              >
                <strong>顺序练习</strong>
                <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.8, marginTop: '2px' }}>即选即判</span>
              </div>
              <div 
                className={`${styles.modeOption} ${selectedMode === "random" ? styles.active : ""}`}
                onClick={() => setSelectedMode("random")}
                title="乱序打乱刷题，保持新鲜感"
              >
                <strong>随机练习</strong>
                <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.8, marginTop: '2px' }}>随机乱序</span>
              </div>
              <div 
                className={`${styles.modeOption} ${selectedMode === "exam" ? styles.active : ""}`}
                onClick={() => setSelectedMode("exam")}
                title="全卷作答时不揭晓答案，交卷后统一看成绩与全解析"
              >
                <strong>全真模考</strong>
                <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.8, marginTop: '2px' }}>交卷后看解析</span>
              </div>
              <div 
                className={`${styles.modeOption} ${selectedMode === "recite" ? styles.active : ""}`}
                onClick={() => setSelectedMode("recite")}
                title="直接展示答案与解析，适合快速通读"
              >
                <strong>背诵模式</strong>
                <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.8, marginTop: '2px' }}>直接看解析</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            className={styles.startBtn} 
            onClick={handleStart}
            disabled={selectedBankId === ""}
          >
            开始
          </button>
        </div>
      </div>
    );
  }

  const currentIdx = orderedIndices[currentSession.currentIndex];
  const currentQuestion = questions[currentIdx];
  const bankName = currentSession.bankId === -1 
    ? "错题复习专场" 
    : (banks.find(b => b.id === currentSession.bankId)?.name || "题库");
  const modeLabel = 
    currentSession.mode === 'sequential' ? '顺序练习' : 
    currentSession.mode === 'random' ? '随机练习' : 
    currentSession.mode === 'exam' ? '全真模考' : '背诵模式';

  if (!currentQuestion) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCard} style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ marginBottom: "1rem" }}>正在加载题目...</p>
          <button type="button" className={styles.startBtn} onClick={resetQuiz}>
            重新开始
          </button>
        </div>
      </div>
    );
  }

  const existingAnswer = currentSession.answers[currentQuestion.id!];
  const isSubmitted = !!existingAnswer;
  const displayAnswer = isSubmitted ? existingAnswer : localAnswer;

  const handleSelectOption = async (optId: string) => {
    if (isSubmitted || currentSession.mode === "recite") return;
    
    if (isMultiChoiceQuestion(currentQuestion)) {
      const nextAns = toggleOptionSelection(localAnswer, optId);
      setLocalAnswer(nextAns);
    } else {
      // Single choice: immediately submit answer!
      setLocalAnswer("");
      await answerQuestion(currentQuestion.id!, optId);
    }
  };

  const handleSubmit = async () => {
    if (!localAnswer || !currentQuestion) return;
    await answerQuestion(currentQuestion.id!, localAnswer);
    setLocalAnswer("");
  };

  const handleEnd = async () => {
    if (localAnswer && currentQuestion && !isSubmitted) {
      await answerQuestion(currentQuestion.id!, localAnswer);
      setLocalAnswer("");
    }
    finishQuiz();
    router.push("/quiz/result");
  };

  const isSplit = showAIChat && aiLayout === "split";
  const isBottom = showAIChat && aiLayout === "bottom";
  const isDrawer = showAIChat && aiLayout === "drawer";

  return (
    <div className={`${styles.container} ${isSplit ? styles.containerWide : ""}`}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.bankName}>{bankName}</span>
          <span className={styles.modeBadge}>{modeLabel}</span>
        </div>
        <div className={styles.headerRight}>
          <button 
            type="button"
            className={`${styles.aiBtn} ${showAIChat ? styles.aiBtnActive : ""}`} 
            onClick={() => setShowAIChat(!showAIChat)}
          >
            <SparklesIcon size={14} />
            <span>{showAIChat ? "收起 AI" : "AI 答疑"}</span>
          </button>
          <button type="button" className={styles.endBtn} onClick={handleEnd}>
            {currentSession.mode === "exam" ? "交卷" : "结束"}
          </button>
        </div>
      </header>

      <div className={isSplit ? styles.splitGrid : ""}>
        <div className={styles.questionSection}>
          <QuestionCard
            question={currentQuestion}
            questionIndex={currentSession.currentIndex}
            totalQuestions={orderedIndices.length}
            mode={currentSession.mode}
            selectedAnswer={displayAnswer}
            isSubmitted={isSubmitted}
            onSelectOption={handleSelectOption}
            onSubmit={handleSubmit}
            onNext={() => { setLocalAnswer(""); nextQuestion(); }}
            onPrev={() => { setLocalAnswer(""); prevQuestion(); }}
          />

          {isBottom && (
            <div style={{ marginTop: "1.5rem" }}>
              <AIChat 
                key={currentQuestion?.id ?? currentSession.currentIndex}
                question={currentQuestion}
                userAnswer={displayAnswer}
                layout="bottom"
                onLayoutChange={handleLayoutChange}
                onClose={() => setShowAIChat(false)}
              />
            </div>
          )}
        </div>

        {isSplit && (
          <div className={styles.aiSection}>
            <AIChat 
              key={currentQuestion?.id ?? currentSession.currentIndex}
              question={currentQuestion}
              userAnswer={displayAnswer}
              layout="split"
              onLayoutChange={handleLayoutChange}
              onClose={() => setShowAIChat(false)}
            />
          </div>
        )}
      </div>

      {isDrawer && (
        <AIChat 
          key={currentQuestion?.id ?? currentSession.currentIndex}
          question={currentQuestion}
          userAnswer={displayAnswer}
          layout="drawer"
          onLayoutChange={handleLayoutChange}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </div>
  );
}
