"use client";

import React, { useState, useRef } from "react";
import styles from "./BankImport.module.css";
import * as db from "@/lib/db";
import { Question } from "@/lib/types";

interface BankImportProps {
  onImportSuccess?: () => void;
}

export default function BankImport({ onImportSuccess }: BankImportProps) {
  const [bankName, setBankName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "idle", msg: string }>({ type: "idle", msg: "" });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      // Basic preview
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            setPreviewCount(data.length);
          } else if (data.questions && Array.isArray(data.questions)) {
            setPreviewCount(data.questions.length);
          } else {
            setPreviewCount(0);
          }
        } catch {
          setPreviewCount(null);
        }
      };
      reader.readAsText(selected);
    }
  };

  const handleImport = async () => {
    if (!file || !bankName.trim()) {
      setStatus({ type: "error", msg: "请填写题库名称并选择文件" });
      return;
    }

    setIsImporting(true);
    setStatus({ type: "idle", msg: "" });

    try {
      const content = await file.text();
      let questions: Omit<Question, "id">[] = [];
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        questions = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        questions = data.questions;
      } else {
        throw new Error("无效的 JSON 格式，找不到题目数组");
      }

      await db.importBank(bankName.trim(), questions as Question[]);

      setStatus({ type: "success", msg: `成功导入 ${questions.length} 道题目！` });
      setBankName("");
      setFile(null);
      setPreviewCount(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImportSuccess?.();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "导入失败";
      setStatus({ type: "error", msg });
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadBuiltIn = async () => {
    setIsImporting(true);
    setStatus({ type: "idle", msg: "" });

    try {
      const res = await fetch("/questions.json");
      if (!res.ok) throw new Error("加载内置题库文件失败");
      const data = await res.json();
      
      await db.importBank("系统架构设计师·真题题库", data);
      setStatus({ type: "success", msg: `🎉 成功载入内置题库《系统架构设计师》，共 ${data.length} 道题目！` });
      onImportSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "载入内置题库失败";
      setStatus({ type: "error", msg });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <h2 className={styles.title} style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>导入题库</h2>
        <button
          type="button"
          onClick={handleLoadBuiltIn}
          disabled={isImporting}
          style={{
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 14px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          ⚡ 一键载入内置题库 (609题)
        </button>
      </div>
      
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>题库名称</label>
          <input 
            type="text" 
            className={styles.input}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="例如：2023年计算机网络期末复习"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>选择文件 (JSON)</label>
          <input 
            type="file" 
            accept=".json"
            className={styles.fileInput}
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </div>

        {previewCount !== null && (
          <div className={styles.preview}>
            解析到 <strong>{previewCount}</strong> 道题目
          </div>
        )}

        {status.type !== "idle" && (
          <div className={`${styles.alert} ${status.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {status.msg}
          </div>
        )}

        <button 
          className={styles.importBtn}
          onClick={handleImport}
          disabled={!file || !bankName.trim() || isImporting}
        >
          {isImporting ? "导入中..." : "确认导入"}
        </button>
      </div>
    </div>
  );
}

