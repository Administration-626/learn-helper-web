"use client";

import React, { useState } from "react";
import styles from "./QuestionCard.module.css";
import { Question, QuizMode } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { formatCjkMarkdown } from "@/lib/markdown";
import ExplanationModal from "./ExplanationModal";
import { EditIcon } from "./Icons";
import { updateQuestionExplanation } from "@/lib/db";
import { useQuizStore } from "@/stores/quiz";

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
  const [showEditModal, setShowEditModal] = useState(false);

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
        <div className={styles.questionText}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ children }) => <span>{children}</span>,
            }}
          >
            {formatCjkMarkdown((question.number ? `${question.number}. ` : "") + question.question)}
          </ReactMarkdown>
        </div>

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
              <span className={styles.optionText}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <span>{children}</span>,
                  }}
                >
                  {formatCjkMarkdown(text)}
                </ReactMarkdown>
              </span>
            </button>
          ))}
        </div>
      </div>

      {((isSubmitted && !isExam) || isRecite) && (
        <div className={styles.feedback}>
          <div className={styles.feedbackHeader}>
            <h4 className={styles.feedbackTitle}>
              正确答案: <span style={{ color: "var(--color-success)" }}>{question.answer}</span>
            </h4>
            <button
              type="button"
              className={styles.editExplanationBtn}
              onClick={() => setShowEditModal(true)}
              title="编辑自定义本题解析"
            >
              <EditIcon size={13} />
              <span>编辑解析</span>
            </button>
          </div>
          {question.explanation && (
            <div className={styles.explanationBody}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {formatCjkMarkdown(question.explanation)}
              </ReactMarkdown>
            </div>
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

      {showEditModal && (
        <ExplanationModal
          isOpen={showEditModal}
          question={question}
          onSave={async (newExp) => {
            if (question.id) {
              await updateQuestionExplanation(question.id, newExp);
              useQuizStore.getState().updateQuestionExplanation(question.id, newExp);
            }
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

