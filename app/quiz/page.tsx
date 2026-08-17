"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useQuizStore } from "@/stores/quiz";
import { db } from "@/lib/db";
import type { QuestionBank, QuizMode } from "@/lib/types";
import QuestionCard from "@/components/QuestionCard";
import AIChat from "@/components/AIChat";

export default function QuizPage() {
  const router = useRouter();
  const { currentSession, questions, orderedIndices, startQuiz, resumeQuiz, answerQuestion, nextQuestion, prevQuestion, finishQuiz, resetQuiz } = useQuizStore();
  
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | "">("");
  const [selectedMode, setSelectedMode] = useState<QuizMode>("sequential");
  const [isLoading, setIsLoading] = useState(true);
  
  // Local state for the current question
  const [localAnswer, setLocalAnswer] = useState<string>("");
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    const init = async () => {
      const allBanks = await db.banks.toArray();
      setBanks(allBanks);
      if (allBanks.length > 0 && selectedBankId === "") {
        setSelectedBankId(allBanks[0].id!);
      }

      if (currentSession && questions.length === 0) {
        await resumeQuiz();
      }
      setIsLoading(false);
    };
    init();
  }, [currentSession, questions.length, resumeQuiz, selectedBankId]);

  const handleStart = async () => {
    if (selectedBankId === "") return;
    setIsLoading(true);
    await startQuiz(Number(selectedBankId), selectedMode);
    setIsLoading(false);
  };

  const handleEnd = () => {
    finishQuiz();
    router.push("/quiz/result");
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
              >
                顺序模式
              </div>
              <div 
                className={`${styles.modeOption} ${selectedMode === "random" ? styles.active : ""}`}
                onClick={() => setSelectedMode("random")}
              >
                随机模式
              </div>
              <div 
                className={`${styles.modeOption} ${selectedMode === "recite" ? styles.active : ""}`}
                onClick={() => setSelectedMode("recite")}
              >
                背诵模式
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
  const currentQuestion = questions[currentIdx] || questions.find(q => q.id === questions[currentIdx]?.id);
  const bank = banks.find(b => b.id === currentSession.bankId);
  const modeLabel = currentSession.mode === 'sequential' ? '顺序' : currentSession.mode === 'random' ? '随机' : '背诵';

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

  const handleSelectOption = (optId: string) => {
    if (isSubmitted || currentSession.mode === "recite") return;
    
    if (currentQuestion.type === "multi") {
      let currentArr = localAnswer ? localAnswer.split("") : [];
      if (currentArr.includes(optId)) {
        currentArr = currentArr.filter(id => id !== optId);
      } else {
        currentArr.push(optId);
      }
      currentArr.sort();
      setLocalAnswer(currentArr.join(""));
    } else {
      setLocalAnswer(optId);
    }
  };

  const handleSubmit = async () => {
    if (!localAnswer) return;
    await answerQuestion(currentQuestion.id!, localAnswer);
    setLocalAnswer("");
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.bankName}>{bank?.name || "题库"}</span>
          <span className={styles.modeBadge}>{modeLabel}</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.aiBtn} onClick={() => setShowAIChat(true)}>问 AI</button>
          <button className={styles.endBtn} onClick={handleEnd}>结束</button>
        </div>
      </header>

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

      {showAIChat && (
        <AIChat 
          questionId={currentQuestion.id!}
          questionText={currentQuestion.question || ""}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </div>
  );
}
