"use client";
import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import BankImport from "@/components/BankImport";
import { db, exportBank } from "@/lib/db";
import { QuestionBank } from "@/lib/types";
import Link from "next/link";

export default function BankManagementPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    const data = await db.banks.orderBy("createdAt").reverse().toArray();
    setBanks(data);
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`确定要删除题库 "${name}" 吗？此操作不可逆。`)) {
      await db.transaction('rw', db.banks, db.questions, db.mistakes, async () => {
        await db.banks.delete(id);
        await db.questions.where('bankId').equals(id).delete();
        await db.mistakes.where('bankId').equals(id).delete();
      });
      loadBanks();
    }
  };

  const handleExport = async (id: number, name: string) => {
    const questions = await exportBank(id);
    const dataStr = JSON.stringify(questions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>题库管理</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>导入、浏览和管理您的题库</p>
      </div>
      
      <BankImport onImportSuccess={loadBanks} />
      
      <div style={{ marginTop: '2rem', textAlign: 'right' }}>
        <button onClick={loadBanks} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer' }}>刷新列表</button>
      </div>

      <div className={styles.grid}>
        {banks.map(bank => (
          <div key={bank.id} className={styles.card}>
            <div className={styles.cardTitle}>{bank.name}</div>
            <div className={styles.cardMeta}>
              <span>题目数量: {bank.questionCount}</span>
              <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
            </div>
            <div className={styles.cardActions}>
              <Link href={`/bank/${bank.id}`} className={`${styles.actionBtn} ${styles.viewBtn}`}>
                浏览
              </Link>
              <button className={styles.actionBtn} onClick={() => handleExport(bank.id!, bank.name)}>
                导出
              </button>
              <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(bank.id!, bank.name)}>
                删除
              </button>
            </div>
          </div>
        ))}
        {banks.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
            暂无题库，请先导入
          </div>
        )}
      </div>
    </div>
  );
}
