"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./AIChat.module.css";
import { getChatMessages, saveChatMessage, clearChatMessages, updateQuestionExplanation, getActiveLLMConfig, db } from "@/lib/db";
import { Question } from "@/lib/types";
import { useQuizStore } from "@/stores/quiz";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { formatCjkMarkdown } from "@/lib/markdown";
import ExplanationModal from "./ExplanationModal";
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  CloseIcon,
  PinIcon,
  RefreshIcon,
  PlusIcon,
  EditIcon,
  DownloadIcon,
  TrashIcon,
  StopIcon,
  BrainIcon,
  SendIcon,
} from "./Icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  isTruncated?: boolean;
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
  "为什么选这个答案？",
  "逐个选项分析对错",
  "核心考点深度剖析",
  "解题技巧与速记要点"
];

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedExplanationId, setSavedExplanationId] = useState<string | null>(null);
  const [hoveredSavedId, setHoveredSavedId] = useState<string | null>(null);
  const [editModalText, setEditModalText] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(propQuestion || null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [originalExplanation, setOriginalExplanation] = useState<string | null>(null);
  const isTogglingExplanationRef = useRef(false);

  const resolvedQId = propQuestion?.id || propQId || 0;

  useEffect(() => {
    let isCurrent = true;

    // Abort previous in-flight AI stream if question changed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    (async () => {
      let currentQ = propQuestion;
      if (!currentQ && resolvedQId) {
        currentQ = await db.questions.get(resolvedQId);
      }

      if (!isCurrent) return;
      setIsLoading(false);
      setSavedExplanationId(null);
      setHoveredSavedId(null);

      if (currentQ) {
        setActiveQuestion(currentQ);
        setOriginalExplanation(currentQ.explanation || "");
      } else {
        setActiveQuestion(null);
        setOriginalExplanation("");
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
          if (currentQ?.explanation) {
            const match = history.find(m => m.role === "assistant" && m.content === currentQ.explanation);
            if (match && match.id) setSavedExplanationId(String(match.id));
          }
        } else {
          const qTitle = currentQ?.question || propQText || "这道题目";
          setMessages([
            {
              id: "init",
              role: "assistant",
              content: `你好！我是你的 AI 辅导助手 ✨\n\n针对当前题目：**"${qTitle}"**，请随时向我提问，或点击下方快捷提问按钮。`,
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

  const handleAdoptExplanation = async (content: string, msgId: string) => {
    if (!resolvedQId || isTogglingExplanationRef.current) return;
    isTogglingExplanationRef.current = true;

    try {
      if (originalExplanation === null && activeQuestion) {
        setOriginalExplanation(activeQuestion.explanation || "");
      }
      await updateQuestionExplanation(resolvedQId, content);
      setActiveQuestion(prev => prev ? { ...prev, explanation: content } : null);
      useQuizStore.getState().updateQuestionExplanation(resolvedQId, content);
      setSavedExplanationId(msgId);
    } catch (err) {
      console.error("Failed to adopt explanation:", err);
    } finally {
      setTimeout(() => {
        isTogglingExplanationRef.current = false;
      }, 500);
    }
  };

  const handleCancelAdopt = async () => {
    if (!resolvedQId || isTogglingExplanationRef.current) return;
    isTogglingExplanationRef.current = true;

    try {
      const fallback = originalExplanation || "";
      await updateQuestionExplanation(resolvedQId, fallback);
      setActiveQuestion(prev => prev ? { ...prev, explanation: fallback } : null);
      useQuizStore.getState().updateQuestionExplanation(resolvedQId, fallback);
      setSavedExplanationId(null);
    } catch (err) {
      console.error("Failed to cancel adoption:", err);
    } finally {
      setTimeout(() => {
        isTogglingExplanationRef.current = false;
      }, 500);
    }
  };

  const handleAppendExplanation = async (content: string, msgId: string) => {
    if (!resolvedQId || isTogglingExplanationRef.current) return;
    isTogglingExplanationRef.current = true;

    try {
      if (originalExplanation === null && activeQuestion) {
        setOriginalExplanation(activeQuestion.explanation || "");
      }
      const currentExp = activeQuestion?.explanation?.trim() || "";
      const merged = currentExp ? `${currentExp}\n\n---\n\n${content}` : content;
      await updateQuestionExplanation(resolvedQId, merged);
      setActiveQuestion(prev => prev ? { ...prev, explanation: merged } : null);
      useQuizStore.getState().updateQuestionExplanation(resolvedQId, merged);
      setSavedExplanationId(msgId);
    } catch (err) {
      console.error("Failed to append explanation:", err);
    } finally {
      setTimeout(() => {
        isTogglingExplanationRef.current = false;
      }, 500);
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

## AI 深度解答与考点剖析
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
    setElapsedSeconds(0);

    const timerId = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);

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
        clearInterval(timerId);
        return;
      }

      // Build rich context about the question
      const q = propQuestion || activeQuestion;
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
      const baseSystemPrompt = customQaPrompt || "你是一个专业的软考与计算机辅导名师，请基于题目背景耐心解答学生的问题，分步骤剖析考点。如果学生询问答案、原因或解析，请直接给出详尽深入的解答和考点分析。如果学生答错了，请重点剖析其错因。\n\n【排版规范】：涉及带引号或书名号的名词加粗时，请将标点置于加粗符号外（如“**左右法**”或《**教程**》），避免标点紧贴星号导致 Markdown 解析失败。";
      
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
        throw new Error(errText || `请求失败 (${response.status})`);
      }

      if (!response.body) throw new Error("服务器未返回响应体 (No response body)");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessageId = createMessageId();
      let assistantText = "";
      let assistantReasoning = "";
      let buffer = "";

      let isTruncated = false;
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
              if (parsed.error) {
                throw new Error(parsed.error.message || JSON.stringify(parsed.error));
              }
              const choice = parsed.choices?.[0];
              if (choice?.finish_reason === "length") {
                isTruncated = true;
              }
              const delta = choice?.delta;
              const textDelta = delta?.content || choice?.text || "";
              const reasoningDelta = delta?.reasoning_content || delta?.reasoning || "";

              if (textDelta) assistantText += textDelta;
              if (reasoningDelta) assistantReasoning += reasoningDelta;
            } catch (parseErr) {
              if (parseErr instanceof Error && !parseErr.message.includes("Unexpected end of JSON")) {
                throw parseErr;
              }
            }
          }
        }

        const currentText = assistantText;
        const currentReasoning = assistantReasoning;
        if (currentText || currentReasoning) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === assistantMessageId) {
              return [...prev.slice(0, -1), { ...last, content: currentText, reasoning: currentReasoning, isTruncated }];
            } else {
              return [...prev, { id: assistantMessageId, role: "assistant", content: currentText, reasoning: currentReasoning, isTruncated }];
            }
          });
        }
      }

      if (!assistantText && !assistantReasoning) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            content: "⚠️ 大模型未返回任何有效文本内容。请检查【设置】中的模型名称（Model）配置是否正确，或尝试重新提问。",
          },
        ]);
      } else if (assistantText) {
        // Save assistant response to IndexedDB
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
      const msg = error instanceof Error ? error.message : "未知错误，请检查网络或大模型配置";
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: `❌ 请求出错: ${msg}`,
        },
      ]);
    } finally {
      clearInterval(timerId);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [activeQuestion, isLoading, messages, propQText, propQuestion, resolvedQId, userAnswer]);

  const contentPanel = (
    <div className={`${styles.panel} ${layout === "split" ? styles.panelInline : layout === "bottom" ? styles.panelBottom : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <SparklesIcon size={18} className={styles.aiSparkleIcon} />
          <h3 className={styles.title}>AI 答疑辅导</h3>
          {onLayoutChange && (
            <div className={styles.layoutToggleGroup}>
                <button
                  type="button"
                  className={`${styles.layoutBtn} ${layout === "split" ? styles.layoutBtnActive : ""}`}
                  onClick={() => onLayoutChange("split")}
                  title="左右分屏并排"
                >
                  分屏
                </button>
                <button
                  type="button"
                  className={`${styles.layoutBtn} ${layout === "bottom" ? styles.layoutBtnActive : ""}`}
                  onClick={() => onLayoutChange("bottom")}
                  title="底部嵌入模式"
                >
                  底部
                </button>
                <button
                  type="button"
                  className={`${styles.layoutBtn} ${layout === "drawer" ? styles.layoutBtnActive : ""}`}
                  onClick={() => onLayoutChange("drawer")}
                  title="右侧悬浮抽屉"
                >
                  抽屉
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
              <TrashIcon size={13} />
              <span>清空</span>
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose} title="关闭 (Esc)">
              <CloseIcon size={14} />
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
                  {msg.reasoning && (
                    <details open={isLoading} className={styles.reasoningBox}>
                      <summary className={styles.reasoningSummary}>
                        <BrainIcon size={14} />
                        <span>深度思考过程 ({msg.reasoning.length} 字)</span>
                      </summary>
                      <div className={styles.reasoningContent}>{msg.reasoning}</div>
                    </details>
                  )}
                  {msg.content && (
                    <div className={styles.markdownBody} style={{ wordBreak: "break-word" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {formatCjkMarkdown(msg.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.isTruncated && (
                    <div style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ⚠️ 该回答已达单次最大 Token 上限，点击下方【继续输出】可无缝续写剩余内容
                    </div>
                  )}
                  {msg.role === "assistant" && msg.id !== "init" && msg.content && (() => {
                    const currentExpTrim = (activeQuestion?.explanation || "").trim();
                    const msgTrim = msg.content.trim();
                    const isAdopted = savedExplanationId === msg.id || (currentExpTrim.length > 0 && currentExpTrim === msgTrim);
                    const hasOtherAdopted = !isAdopted && (
                      (savedExplanationId !== null && savedExplanationId !== msg.id) ||
                      (currentExpTrim.length > 0 && currentExpTrim !== (originalExplanation || "").trim())
                    );

                    return (
                      <div className={styles.bubbleFooter}>
                        {msg.isTruncated && (
                          <button
                            type="button"
                            className={styles.copyBtn}
                            style={{ color: '#d97706', borderColor: '#fcd34d' }}
                            onClick={() => handleSendPrompt("请接着上一段未写完的内容继续输出，从截断处直接往下写：")}
                            title="点击让 AI 接着上一段截断处继续输出"
                          >
                            <SparklesIcon size={13} />
                            <span>继续输出</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() => handleCopy(msg.content, msg.id)}
                          title="复制回答到剪贴板"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <CheckIcon size={13} />
                              <span>已复制</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon size={13} />
                              <span>复制</span>
                            </>
                          )}
                        </button>

                        {resolvedQId > 0 && (
                          <>
                            {isAdopted ? (
                              /* State B: Already adopted this message */
                              <button
                                type="button"
                                className={`${styles.copyBtn} ${styles.savedBtnActive}`}
                                onClick={handleCancelAdopt}
                                onMouseEnter={() => setHoveredSavedId(msg.id)}
                                onMouseLeave={() => setHoveredSavedId(null)}
                                title="点击取消采纳，恢复题目原始解析"
                              >
                                {hoveredSavedId === msg.id ? (
                                  <>
                                    <CloseIcon size={13} />
                                    <span>取消采纳</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckIcon size={13} />
                                    <span>已采纳为题解</span>
                                  </>
                                )}
                              </button>
                            ) : hasOtherAdopted ? (
                              /* State C: Another answer is adopted, provide Overwrite or Append or Edit */
                              <>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() => handleAdoptExplanation(msg.content, msg.id)}
                                  title="将此回答覆盖为最新的本题题解"
                                >
                                  <RefreshIcon size={13} />
                                  <span>覆盖题解</span>
                                </button>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() => handleAppendExplanation(msg.content, msg.id)}
                                  title="将此回答追加合并到现有题解的末尾"
                                >
                                  <PlusIcon size={13} />
                                  <span>追加合并</span>
                                </button>
                                <button
                                  type="button"
                                  className={styles.copyBtn}
                                  onClick={() => setEditModalText(msg.content)}
                                  title="打开编辑器自由精修组合"
                                >
                                  <EditIcon size={13} />
                                  <span>精修组合</span>
                                </button>
                              </>
                            ) : (
                              /* State A: Initial state, adopt this message directly */
                              <button
                                type="button"
                                className={styles.copyBtn}
                                onClick={() => handleAdoptExplanation(msg.content, msg.id)}
                                title="将此条 AI 解答采纳为该题的标准题解"
                              >
                                <PinIcon size={13} />
                                <span>采纳为题解</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() => handleExportMarkdown(msg.content)}
                          title="导出包含题干与此条解析的本地 Markdown 笔记文件"
                        >
                          <DownloadIcon size={13} />
                          <span>导出笔记</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
            {isLoading && !messages[messages.length - 1]?.content && !messages[messages.length - 1]?.reasoning && (
              <div className={`${styles.messageWrapper} ${styles.wrapperAssistant}`}>
                <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                  <div className={styles.loadingWrapper}>
                    <div className={styles.loadingDots}>
                      <span>AI 正在组织思路解答中...</span>
                      <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                        ({elapsedSeconds}s)
                      </span>
                    </div>
                    {elapsedSeconds >= 12 && (
                      <div className={styles.loadingHint}>
                        大模型正在深度推理或网络排队中，若等待时间过长可点击下方【停止】或检查【设置】中的 API 服务
                      </div>
                    )}
                  </div>
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
              <StopIcon size={12} />
              <span>停止</span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => handleSendPrompt(input)}
              disabled={!input.trim()}
            >
              <SendIcon size={14} />
              <span>发送</span>
            </button>
          )}
        </div>
    </div>
  );

  const finalElement = layout === "drawer" ? (
    <div 
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {contentPanel}
    </div>
  ) : contentPanel;

  return (
    <>
      {finalElement}
      {editModalText && activeQuestion && (
        <ExplanationModal
          isOpen={!!editModalText}
          question={activeQuestion}
          originalDefaultExplanation={originalExplanation || undefined}
          initialAppendText={editModalText}
          onSave={async (newExp) => {
            if (resolvedQId) {
              await updateQuestionExplanation(resolvedQId, newExp);
              setActiveQuestion(prev => prev ? { ...prev, explanation: newExp } : null);
              useQuizStore.getState().updateQuestionExplanation(resolvedQId, newExp);
            }
          }}
          onClose={() => setEditModalText(null)}
        />
      )}
    </>
  );
}

