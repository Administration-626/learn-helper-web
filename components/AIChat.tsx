"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./AIChat.module.css";
import { getChatMessages, saveChatMessage, clearChatMessages, updateQuestionExplanation, getActiveLLMConfig, db } from "@/lib/db";
import { Question } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type AIChatLayout = "split" | "bottom" | "drawer";

interface AIChatProps {
  questionId?: number;
  questionText?: string;
  question?: Question;
  userAnswer?: string;
  layout?: AIChatLayout;
  onLayoutChange?: (layout: AIChatLayout) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "💡 为什么选这个答案？",
  "🔍 逐个选项分析对错",
  "📖 本题核心考点剖析",
  "🎯 解题技巧与速记口诀"
];

function formatCjkMarkdown(text: string): string {
  if (!text) return "";
  // Fix CommonMark CJK punctuation-flanked emphasis bug (e.g. **范式（Normal Forms）**概念)
  return text.replace(/([)）\]】"”’'])\*\*([\u4e00-\u9fa5a-zA-Z0-9])/g, "$1** $2");
}

let idCounter = 0;
function createMessageId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export default function AIChat({ 
  questionId: propQId, 
  questionText: propQText, 
  question: propQuestion, 
  userAnswer, 
  layout = "split",
  onLayoutChange,
  onClose 
}: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedExplanationId, setSavedExplanationId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(propQuestion || null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resolvedQId = propQuestion?.id || propQId || 0;

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      let currentQ = propQuestion;
      if (!currentQ && resolvedQId) {
        currentQ = await db.questions.get(resolvedQId);
        if (isCurrent && currentQ) setActiveQuestion(currentQ);
      }

      try {
        const history = await getChatMessages(resolvedQId);
        if (!isCurrent) return;
        if (history && history.length > 0) {
          setMessages(
            history.map((m, idx) => ({
              id: m.id ? String(m.id) : String(idx),
              role: m.role,
              content: m.content,
            }))
          );
        } else {
          const qTitle = currentQ?.question || propQText || "这道题目";
          setMessages([
            {
              id: "init",
              role: "assistant",
              content: `你好！我是你的 AI 辅导老师 🤖\n\n针对当前题目：**"${qTitle}"**，请随时向我提问，或点击下方快捷提问按钮！`,
            },
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    })();
    return () => { isCurrent = false; };
  }, [propQuestion, propQText, resolvedQId]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleMessageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 60;
    isAtBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom && target.scrollHeight > target.clientHeight + 80);
  };

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBottomBtn(false);
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleClearHistory = async () => {
    if (messages.length <= 1 && messages[0]?.id === "init") return;
    if (confirm("确定要清空与当前题目的全部对话记录吗？")) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      await clearChatMessages(resolvedQId);
      const qTitle = activeQuestion?.question || propQText || "这道题目";
      setMessages([
        {
          id: "init",
          role: "assistant",
          content: `🧹 已清空对话记录。\n\n针对题目：**"${qTitle}"**，有什么想问的随时告诉我！`,
        },
      ]);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsExplanation = async (content: string, msgId: string) => {
    if (!resolvedQId) return;
    try {
      await updateQuestionExplanation(resolvedQId, content);
      setActiveQuestion(prev => prev ? { ...prev, explanation: content } : null);
      setSavedExplanationId(msgId);
      setTimeout(() => setSavedExplanationId(null), 3000);
    } catch (err) {
      console.error("Failed to save explanation:", err);
    }
  };

  const handleExportMarkdown = (content: string) => {
    const qTitle = activeQuestion?.question || propQText || "题目详细解析";
    const optText = activeQuestion?.options
      ? Object.entries(activeQuestion.options)
          .map(([k, v]) => `- **${k}**: ${v}`)
          .join("\n")
      : "";
    const correctAns = activeQuestion?.answer ? `\n\n**【标准答案】**：${activeQuestion.answer}` : "";
    const userAnsText = userAnswer ? `\n**【你的选择】**：${userAnswer}` : "";
    
    const mdDoc = `# 刷题笔记：${qTitle}

## 题目内容
${qTitle}

${optText ? `### 选项\n${optText}` : ""}${correctAns}${userAnsText}

---

## 🤖 AI 深度解答与考点剖析
${content}

---
*导出时间：${new Date().toLocaleString()} · 刷题助手 LearnHelper*
`;
    const blob = new Blob([mdDoc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `刷题笔记_${activeQuestion?.id ? `第${activeQuestion.id}题` : '题解'}_${Date.now().toString().slice(-4)}.md`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendPrompt = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessageContent = text.trim();
    const userMessage: Message = {
      id: createMessageId(),
      role: "user",
      content: userMessageContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Save user message to IndexedDB
    try {
      await saveChatMessage({
        questionId: resolvedQId,
        role: "user",
        content: userMessageContent,
      });
    } catch (e) {
      console.error("Failed to save user message", e);
    }

    try {
      const activeConfig = await getActiveLLMConfig();
      if (!activeConfig) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            content: "⚠️ 请先在【设置】页面配置大模型 API Key 和 Base URL 后再使用 AI 答疑功能。",
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Build rich context about the question
      const q = activeQuestion;
      const optionsText = q?.options 
        ? Object.entries(q.options).map(([k, v]) => `  ${k}. ${v}`).join("\n") 
        : "(无选项)";

      const userAnsInfo = userAnswer ? `- 学生当前选择：${userAnswer} (${userAnswer === q?.answer ? "回答正确" : "回答错误"})\n` : "";

      const questionContext = `【当前题目信息】
- 题干：${q?.question || propQText || "无"}
- 选项：
${optionsText}
- 正确答案：${q?.answer || "未提供"}
${userAnsInfo}- 官方解析：${q?.explanation || "无"}
`;

      const customQaPrompt = typeof window !== "undefined" ? localStorage.getItem("qaPrompt") : null;
      const baseSystemPrompt = customQaPrompt || "你是一个专业的软考与计算机辅导名师，请基于题目背景耐心解答学生的问题，分步骤剖析考点。如果学生询问答案、原因或解析，请直接给出详尽深入的解答和考点分析。如果学生答错了，请重点剖析其错因。";
      
      const fullSystemPrompt = `${baseSystemPrompt}\n\n${questionContext}`;

      const apiMessages = [
        { role: "system", content: fullSystemPrompt },
        ...messages.filter((m) => m.id !== "init").map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessageContent },
      ];

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          config: activeConfig,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `请求失败: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessageId = createMessageId();
      let assistantText = "";
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
              const delta = parsed.choices?.[0]?.delta?.content || "";
              assistantText += delta;
            } catch {
              // buffer chunk was partial
            }
          }
        }

        const currentText = assistantText;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantMessageId) {
            return [...prev.slice(0, -1), { ...last, content: currentText }];
          } else {
            return [...prev, { id: assistantMessageId, role: "assistant", content: currentText }];
          }
        });
      }

      // Save assistant response to IndexedDB
      if (assistantText) {
        await saveChatMessage({
          questionId: resolvedQId,
          role: "assistant",
          content: assistantText,
        });
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Chat error:", error);
      const msg = error instanceof Error ? error.message : "未知错误，请检查网络或配置";
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: `❌ 请求出错: ${msg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [activeQuestion, isLoading, messages, propQText, resolvedQId, userAnswer]);

  const contentPanel = (
    <div className={`${styles.panel} ${layout === "split" ? styles.panelInline : layout === "bottom" ? styles.panelBottom : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h3 className={styles.title}>AI 答疑辅导</h3>
          {onLayoutChange && (
            <div className={styles.layoutToggleGroup}>
              <button
                type="button"
                className={`${styles.layoutBtn} ${layout === "split" ? styles.layoutBtnActive : ""}`}
                onClick={() => onLayoutChange("split")}
                title="左右分屏并排"
              >
                🗖 分屏
              </button>
              <button
                type="button"
                className={`${styles.layoutBtn} ${layout === "bottom" ? styles.layoutBtnActive : ""}`}
                onClick={() => onLayoutChange("bottom")}
                title="底部嵌入模式"
              >
                🗕 底部
              </button>
              <button
                type="button"
                className={`${styles.layoutBtn} ${layout === "drawer" ? styles.layoutBtnActive : ""}`}
                onClick={() => onLayoutChange("drawer")}
                title="右侧悬浮抽屉"
              >
                🗗 抽屉
              </button>
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button 
            type="button" 
            className={styles.headerBtn} 
            onClick={handleClearHistory}
            title="清空当前题目的对话记录"
          >
            🗑️ 清空
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="关闭 (Esc)">
            ✕
          </button>
        </div>
      </div>

      <div className={styles.messageListContainer}>
        <div className={styles.messageList} onScroll={handleMessageScroll}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageWrapper} ${
                msg.role === "user" ? styles.wrapperUser : styles.wrapperAssistant
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                }`}
              >
                <div className={styles.markdownBody} style={{ wordBreak: "break-word" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatCjkMarkdown(msg.content)}</ReactMarkdown>
                </div>
                {msg.role === "assistant" && msg.id !== "init" && (
                  <div className={styles.bubbleFooter}>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => handleCopy(msg.content, msg.id)}
                      title="复制回答到剪贴板"
                    >
                      {copiedId === msg.id ? "✓ 已复制" : "📋 复制"}
                    </button>
                    {resolvedQId > 0 && (
                      <button
                        type="button"
                        className={`${styles.copyBtn} ${savedExplanationId === msg.id ? styles.copyBtnSuccess : ""}`}
                        onClick={() => handleSaveAsExplanation(msg.content, msg.id)}
                        title="将此条 AI 解答持久化保存为该题的官方解析"
                      >
                        {savedExplanationId === msg.id ? "✓ 已设为本题解析" : "📌 设为本题解析"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => handleExportMarkdown(msg.content)}
                      title="导出包含题干与此条解析的本地 Markdown 笔记文件"
                    >
                      💾 导出笔记
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.messageWrapper} ${styles.wrapperAssistant}`}>
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                <span className={styles.loadingDots}>AI 正在组织思路解答中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {showScrollBottomBtn && (
          <button
            type="button"
            className={styles.scrollBottomBtn}
            onClick={scrollToBottom}
          >
            ↓ 滚动至最新
          </button>
        )}
      </div>

      <div className={styles.quickPrompts}>
        {QUICK_PROMPTS.map((promptText) => (
          <button
            key={promptText}
            type="button"
            className={styles.chip}
            disabled={isLoading}
            onClick={() => handleSendPrompt(promptText)}
          >
            {promptText}
          </button>
        ))}
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt(input);
            }
          }}
          placeholder="输入你的问题... (Enter 发送)"
          rows={2}
        />
        {isLoading ? (
          <button
            type="button"
            className={`${styles.sendBtn} ${styles.stopBtn}`}
            onClick={handleStop}
          >
            🛑 停止
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => handleSendPrompt(input)}
            disabled={!input.trim()}
          >
            发送
          </button>
        )}
      </div>
    </div>
  );

  if (layout === "drawer") {
    return (
      <div 
        className={styles.overlay}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {contentPanel}
      </div>
    );
  }

  return contentPanel;
}

