"use client";
import React, { useEffect, useState, use } from "react";
import styles from "./page.module.css";
import { db, getQuestions } from "@/lib/db";
import { Question, QuestionBank } from "@/lib/types";

export default function BankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bankId = parseInt(resolvedParams.id, 10);
  
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const loadData = React.useCallback(() => {
    (async () => {
      const b = await db.banks.get(bankId);
      if (b) setBank(b);
      const qs = await getQuestions(bankId);
      setQuestions(qs);
      if (b && b.questionCount !== qs.length) {
        await db.banks.update(bankId, { questionCount: qs.length });
        setBank({ ...b, questionCount: qs.length });
      }
    })();
  }, [bankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = questions.filter(q => q.question.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: number) => {
    if (confirm("确定删除此题目吗？")) {
      await db.questions.delete(id);
      loadData();
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.question || !editForm.answer) {
      alert("题目和答案为必填项");
      return;
    }
    
    const cleanAns = (editForm.answer || '').replace(/\s+/g, '').toUpperCase();
    const isMulti = editForm.type === 'multi' || cleanAns.length > 1;

    const payload = {
      ...editForm,
      bankId,
      answer: cleanAns,
      type: isMulti ? 'multi' : 'single',
      options: editForm.options || {},
    } as Question;

    if (editingId === "new") {
      await db.questions.add(payload);
    } else {
      await db.questions.put({ ...payload, id: editingId as number });
    }
    
    setEditingId(null);
    loadData();
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id!);
    setEditForm(q);
  };

  const startNew = () => {
    setEditingId("new");
    setEditForm({ question: "", options: { "A": "", "B": "", "C": "", "D": "" }, answer: "", type: "single" });
  };

  const handleOptionChange = (key: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      options: { ...prev.options, [key]: value }
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{bank ? bank.name : "加载中..."}</h1>
      </div>

      <div className={styles.controls}>
        <input 
          type="text" 
          placeholder="搜索题目..." 
          className={styles.search}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <button className={styles.addBtn} onClick={startNew}>新增题目</button>
      </div>

      {editingId === "new" && (
        <div className={styles.questionItem} style={{ marginBottom: '1rem', border: '2px solid var(--color-success)' }}>
          <h3>新增题目</h3>
          <div className={styles.editForm}>
            <textarea className={styles.textarea} placeholder="题干" value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className={styles.input} placeholder="选项A" value={editForm.options?.A || ""} onChange={e => handleOptionChange("A", e.target.value)} />
              <input className={styles.input} placeholder="选项B" value={editForm.options?.B || ""} onChange={e => handleOptionChange("B", e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className={styles.input} placeholder="选项C" value={editForm.options?.C || ""} onChange={e => handleOptionChange("C", e.target.value)} />
              <input className={styles.input} placeholder="选项D" value={editForm.options?.D || ""} onChange={e => handleOptionChange("D", e.target.value)} />
            </div>
            <input className={styles.input} placeholder="正确答案 (例如 A 或 AB)" value={editForm.answer} onChange={e => setEditForm({...editForm, answer: e.target.value.toUpperCase()})} />
            <textarea className={styles.textarea} placeholder="解析" value={editForm.explanation || ""} onChange={e => setEditForm({...editForm, explanation: e.target.value})} />
            <div className={styles.actions}>
              <button className={styles.btn} onClick={handleSaveEdit} style={{ background: 'var(--color-primary)', color: 'white' }}>保存</button>
              <button className={styles.btn} onClick={() => setEditingId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {paginated.map(q => (
          <div key={q.id} className={styles.questionItem}>
            {editingId === q.id ? (
              <div className={styles.editForm}>
                <textarea className={styles.textarea} value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} />
                {Object.keys(editForm.options || {}).map(k => (
                  <input key={k} className={styles.input} placeholder={`选项${k}`} value={editForm.options?.[k] || ""} onChange={e => handleOptionChange(k, e.target.value)} />
                ))}
                <input className={styles.input} placeholder="正确答案" value={editForm.answer} onChange={e => setEditForm({...editForm, answer: e.target.value.toUpperCase()})} />
                <textarea className={styles.textarea} placeholder="解析" value={editForm.explanation || ""} onChange={e => setEditForm({...editForm, explanation: e.target.value})} />
                <div className={styles.actions}>
                  <button className={styles.btn} onClick={handleSaveEdit} style={{ background: 'var(--color-primary)', color: 'white' }}>保存</button>
                  <button className={styles.btn} onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.qHeader}>
                  <div className={styles.qText}>
                    <span style={{ color: 'var(--color-text-secondary)', marginRight: '8px' }}>
                      {q.number ? `${q.number}.` : ""} {q.tag ? `[${q.tag}]` : ""}
                    </span>
                    {q.question}
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={() => setExpanded({...expanded, [q.id!]: !expanded[q.id!]})}>
                      {expanded[q.id!] ? "收起" : "展开"}
                    </button>
                    <button className={styles.btn} onClick={() => startEdit(q)}>编辑</button>
                    <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => handleDelete(q.id!)}>删除</button>
                  </div>
                </div>
                
                {expanded[q.id!] && (
                  <div className={styles.options}>
                    {Object.entries(q.options || {}).map(([k, v]) => (
                      <div key={k} className={`${styles.option} ${q.answer.includes(k) ? styles.correctOption : ""}`}>
                        <strong>{k}.</strong> {v}
                      </div>
                    ))}
                    {q.explanation && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '4px' }}>
                        <strong>解析：</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {paginated.length === 0 && <div style={{ textAlign: 'center', padding: '2rem' }}>无符合条件的题目</div>}
      </div>

      <div className={styles.pagination}>
        <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一页</button>
        <span>{page} / {totalPages}</span>
        <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
      </div>
    </div>
  );
}
