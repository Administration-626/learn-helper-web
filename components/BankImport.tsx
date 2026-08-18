"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./BankImport.module.css";
import * as db from "@/lib/db";
import { Question } from "@/lib/types";
import { DownloadIcon, RefreshIcon, CheckIcon } from "@/components/Icons";

interface BankImportProps {
  onImportSuccess?: () => void;
}

interface ServerBankItem {
  id: string;
  filename: string;
  name: string;
  count: number;
  url: string;
  sizeBytes: number;
}

export default function BankImport({ onImportSuccess }: BankImportProps) {
  const [serverBanks, setServerBanks] = useState<ServerBankItem[]>([]);
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set());
  const [loadingServerBanks, setLoadingServerBanks] = useState(false);
  const [importingBankId, setImportingBankId] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "idle", msg: string }>({ type: "idle", msg: "" });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshServerBanks = useCallback(async () => {
    setLoadingServerBanks(true);
    try {
      const [res, localBanks] = await Promise.all([
        fetch("/api/banks"),
        db.db.banks.toArray()
      ]);
      if (res.ok) {
        const data = await res.json();
        setServerBanks(data.banks || []);
      }
      setImportedNames(new Set(localBanks.map(b => b.name)));
    } catch (e) {
      console.error("Failed to load server banks", e);
    } finally {
      setLoadingServerBanks(false);
    }
  }, []);

  useEffect(() => {
    refreshServerBanks();
  }, [refreshServerBanks]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
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

      const res = await db.updateOrImportBank(bankName.trim(), questions as Question[]);

      const actionText = res.isUpdate ? "覆盖更新" : "成功导入";
      const extraText = res.isUpdate ? "（已保留原错题记录与自定义解析）" : "";
      setStatus({ type: "success", msg: `${actionText} ${res.count} 道题目！${extraText}` });
      setBankName("");
      setFile(null);
      setPreviewCount(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refreshServerBanks();
      onImportSuccess?.();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "导入失败";
      setStatus({ type: "error", msg });
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadServerBank = async (sb: ServerBankItem) => {
    setImportingBankId(sb.id);
    setStatus({ type: "idle", msg: "" });

    try {
      const res = await fetch(sb.url);
      if (!res.ok) throw new Error(`加载题库文件失败 (HTTP ${res.status})`);
      const data = await res.json();
      
      const rawQuestions = Array.isArray(data) ? data : data.questions || [];
      const result = await db.updateOrImportBank(sb.name, rawQuestions);
      const actionText = result.isUpdate ? "更新" : "载入";
      const extraText = result.isUpdate ? "（已就地合并，保留您的错题与自定义笔记）" : "";
      setStatus({ type: "success", msg: `成功${actionText}题库《${sb.name}》，共 ${result.count} 道题目！${extraText}` });
      refreshServerBanks();
      onImportSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "载入题库失败";
      setStatus({ type: "error", msg });
    } finally {
      setImportingBankId(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. 服务器自动扫描题库专区 */}
      <div className={styles.serverSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span>服务器预置题库</span>
            <span className={styles.serverHint}>（放入服务器 public/banks 目录即可自动扫描）</span>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={refreshServerBanks}
            disabled={loadingServerBanks}
            title="刷新服务器题库列表"
          >
            <RefreshIcon size={13} />
            <span>{loadingServerBanks ? "扫描中..." : "重新扫描"}</span>
          </button>
        </div>

        <div className={styles.serverBankList}>
          {serverBanks.map((sb) => {
            const isImported = importedNames.has(sb.name);
            const isCurrentLoading = importingBankId === sb.id;
            return (
              <div key={sb.id} className={styles.serverBankCard}>
                <div className={styles.serverBankInfo}>
                  <div className={styles.serverBankName}>{sb.name}</div>
                  <div className={styles.serverBankMeta}>
                    <span>{sb.count} 道题目</span>
                    <span className={styles.dot}>•</span>
                    <span>{sb.filename}</span>
                    {isImported && <span className={styles.importedBadge}>已在本地</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.loadBankBtn} ${isImported ? styles.loadBankBtnUpdate : ""}`}
                  onClick={() => handleLoadServerBank(sb)}
                  disabled={isCurrentLoading || isImporting}
                >
                  {isCurrentLoading ? (
                    <span>载入中...</span>
                  ) : isImported ? (
                    <>
                      <CheckIcon size={13} />
                      <span>同步更新</span>
                    </>
                  ) : (
                    <>
                      <DownloadIcon size={13} />
                      <span>一键载入</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {serverBanks.length === 0 && !loadingServerBanks && (
            <div className={styles.emptyServerHint}>
              服务器暂无预置题库，可将 .json 文件存放在 public/banks/ 目录下
            </div>
          )}
        </div>
      </div>

      {/* 2. 本地自定义 JSON 文件导入 */}
      <div className={styles.customSection}>
        <h3 className={styles.customTitle}>本地文件导入</h3>
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>题库名称</label>
            <input 
              type="text" 
              className={styles.input}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="例如：2024年计算机网络期末复习"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>选择本地文件 (JSON)</label>
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
              已解析到 <strong>{previewCount}</strong> 道题目
            </div>
          )}

          <button 
            className={styles.importBtn}
            onClick={handleImport}
            disabled={!file || !bankName.trim() || isImporting}
          >
            {isImporting ? "导入中..." : "确认导入本地文件"}
          </button>
        </div>
      </div>

      {status.type !== "idle" && (
        <div className={`${styles.alert} ${status.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}


