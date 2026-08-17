"use client";

import React, { useState } from "react";
import styles from "./ExplanationModal.module.css";
import { Question } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatCjkMarkdown } from "@/lib/markdown";

interface ExplanationModalProps {
  isOpen: boolean;
  question: Question;
  originalDefaultExplanation?: string;
  initialAppendText?: string;
  onSave: (newExplanation: string) => Promise<void>;
  onClose: () => void;
}

export default function ExplanationModal({
  isOpen,
  question,
  originalDefaultExplanation,
  initialAppendText,
  onSave,
  onClose
}: ExplanationModalProps) {
  const getInitialContent = () => {
    const base = question.explanation || "";
    if (initialAppendText) {
      return base.trim() ? `${base.trim()}\n\n---\n\n${initialAppendText}` : initialAppendText;
    }
    return base;
  };

  const [content, setContent] = useState(getInitialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"both" | "edit" | "preview">("both");

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content.trim());
      onClose();
    } catch (err) {
      console.error("Failed to save explanation", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    if (originalDefaultExplanation !== undefined) {
      setContent(originalDefaultExplanation);
    }
  };

  const handleClear = () => {
    if (confirm("确定要清空当前解析内容吗？")) {
      setContent("");
    }
  };

  return (
    <div 
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>✏️ 自定义本题解析</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              {question.number ? `第 ${question.number} 题` : `ID: ${question.id}`}
            </span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "both" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("both")}
            >
              双栏分屏
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "edit" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              仅编辑
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "preview" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              仅预览
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            {originalDefaultExplanation !== undefined && (
              <button
                type="button"
                className={styles.toolActionBtn}
                onClick={handleRestoreDefault}
                title="恢复题目原始内置解析"
              >
                🔄 还原题库解析
              </button>
            )}
            <button
              type="button"
              className={styles.toolActionBtn}
              onClick={handleClear}
              title="清空当前编辑框"
            >
              🧹 清空
            </button>
          </div>
        </div>

        <div className={styles.body} style={{ gridTemplateColumns: activeTab === "both" ? "1fr 1fr" : "1fr" }}>
          {(activeTab === "both" || activeTab === "edit") && (
            <div className={styles.editPane}>
              <textarea
                className={styles.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="支持标准 Markdown 语法，如表格、粗体、代码块、列表等..."
              />
            </div>
          )}

          {(activeTab === "both" || activeTab === "preview") && (
            <div className={styles.previewPane}>
              <div className={styles.previewLabel}>实时排版预览</div>
              {content ? (
                <div className={styles.markdownBody}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {formatCjkMarkdown(content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ color: "var(--color-text-muted)", fontStyle: "italic", padding: "1rem" }}>
                  暂无解析内容，可在左侧输入或点击下方保存
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
            {isSaving ? "正在保存..." : "💾 保存解析"}
          </button>
        </div>
      </div>
    </div>
  );
}
