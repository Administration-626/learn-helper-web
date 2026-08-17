"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./AIChat.module.css";
import { getChatMessages, saveChatMessage, getActiveLLMConfig } from "@/lib/db";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  questionId: number;
  questionText: string;
  onClose: () => void;
}

export default function AIChat({ questionId, questionText, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getChatMessages(questionId);
        if (history && history.length > 0) {
          setMessages(
            history.map((m, idx) => ({
              id: m.id ? String(m.id) : String(idx),
              role: m.role,
              content: m.content,
            }))
          );
        } else {
          setMessages([
            {
              id: "init",
              role: "assistant",
              content: `你好！针对这道题目："${questionText}"，有什么需要我帮你解答或解析的吗？`,
            },
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    loadHistory();
  }, [questionId, questionText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessageContent = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageContent,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Save user message to IndexedDB
    try {
      await saveChatMessage({
        questionId,
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
            id: Date.now().toString(),
            role: "assistant",
            content: "⚠️ 请先在【设置】页面配置大模型 API Key 和 Base URL 后再使用 AI 答疑功能。",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const customQaPrompt = typeof window !== "undefined" ? localStorage.getItem("qaPrompt") : null;
      const systemPrompt = customQaPrompt || "你是一个专业的辅导老师，请针对题目耐心解答学生的问题，分步骤剖析考点。";

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.filter((m) => m.id !== "init").map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          config: activeConfig,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `请求失败: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantMessageId = (Date.now() + 1).toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Handle SSE data chunk parsing or raw stream
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              assistantContent += delta;
            } catch {
              // If not JSON format, append raw text
              assistantContent += data;
            }
          } else if (line.trim()) {
            assistantContent += line;
          }
        }

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantMessageId) {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          } else {
            return [...prev, { id: assistantMessageId, role: "assistant", content: assistantContent }];
          }
        });
      }

      // Save assistant response to IndexedDB
      if (assistantContent) {
        await saveChatMessage({
          questionId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `❌ 请求出错: ${error.message || "未知错误，请检查网络或配置"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>AI 答疑辅导</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.messageList}>
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
                <div style={{ wordBreak: "break-word" }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.messageWrapper} ${styles.wrapperAssistant}`}>
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                <span className={styles.loadingDots}>AI 思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <textarea
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
            rows={2}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

