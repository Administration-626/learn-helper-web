"use client";

import React from "react";
import styles from "./QuestionCard.module.css";
import { Question, QuizMode } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  mode: QuizMode;
  selectedAnswer: string | null;
  isSubmitted: boolean;
  onSelectOption: (optionKey: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  mode,
  selectedAnswer,
  isSubmitted,
  onSelectOption,
  onSubmit,
  onNext,
  onPrev,
}: QuestionCardProps) {
  const isMultiChoice = question.type === "multi";
  const isRecite = mode === "recite";
  const isExam = mode === "exam";

  const getOptionClass = (key: string) => {
    const classes = [styles.option];
    
    if (selectedAnswer?.includes(key)) {
      classes.push(styles.selected);
    }

    if ((isSubmitted && !isExam) || isRecite) {
      const isCorrect = question.answer.includes(key);
      const isSelected = selectedAnswer?.includes(key);

      if (isCorrect) {
        classes.push(styles.correct);
      } else if (isSelected && !isCorrect) {
        classes.push(styles.incorrect);
      }
      classes.push(styles.disabled);
    }

    return classes.join(" ");
  };

  const handleOptionClick = (key: string) => {
    if ((!isExam && isSubmitted) || isRecite) return;
    onSelectOption(key);
  };

  const optionEntries = Object.entries(question.options || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.progress}>
          第 {questionIndex + 1} / {totalQuestions} 题
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {question.tag && <span className={styles.tag}>{question.tag}</span>}
          <span className={styles.tag}>
            {question.type === "multi" ? "多选题" : "单选题"}
          </span>
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.questionText}>
          {question.number ? `${question.number}. ` : ""}{question.question}
        </p>

        <div className={styles.options}>
          {optionEntries.map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={getOptionClass(key)}
              onClick={() => handleOptionClick(key)}
              disabled={(!isExam && isSubmitted) || isRecite}
            >
              <span className={styles.optionLabel}>{key}</span>
              <span className={styles.optionText}>{text}</span>
            </button>
          ))}
        </div>
      </div>

      {((isSubmitted && !isExam) || isRecite) && (
        <div className={styles.feedback}>
          <h4 className={styles.feedbackTitle}>
            正确答案: <span style={{ color: "var(--color-success)" }}>{question.answer}</span>
          </h4>
          {question.explanation && (
            <p className={styles.explanation}>
              <strong>解析：</strong>{question.explanation}
            </p>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button 
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`} 
          onClick={onPrev}
          disabled={questionIndex === 0}
        >
          上一题
        </button>

        {!isSubmitted && !isRecite && isMultiChoice && (
          <button 
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onSubmit}
            disabled={!selectedAnswer}
          >
            确认提交 ({selectedAnswer || "未选"})
          </button>
        )}

        <button 
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onNext}
          disabled={questionIndex === totalQuestions - 1}
        >
          下一题
        </button>
      </div>
    </div>
  );
}

