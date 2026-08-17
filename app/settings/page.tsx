"use client";
import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import { useSettingsStore } from "@/stores/settings";
import { LLMConfig } from "@/lib/types";

const PROVIDER_TEMPLATES = {
  deepseek: { name: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  bailian: { name: "阿里云百炼 (通义千问)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  openai: { name: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  siliconflow: { name: "硅基流动 (SiliconFlow)", url: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  moonshot: { name: "月之暗面 (Moonshot)", url: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  gemini: { name: "Gemini (兼容接口)", url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-1.5-flash" }
};

export default function SettingsPage() {
  const { configs, loadConfigs, addConfig, updateConfig, deleteConfig, setActiveConfig } = useSettingsStore();
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState<Partial<LLMConfig>>({
    name: "", apiUrl: "", apiKey: "", model: "", maxTokens: 4096, temperature: 0.7, topP: 1, isActive: false
  });

  const [qaPrompt, setQaPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qaPrompt") || "你是一个专业的辅导老师，请解答用户的问题，可以分步骤讲解。";
    }
    return "你是一个专业的辅导老师，请解答用户的问题，可以分步骤讲解。";
  });

  const [analysisPrompt, setAnalysisPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("analysisPrompt") || "请分析这道题的考点，并解释为什么其他选项是错误的。";
    }
    return "请分析这道题的考点，并解释为什么其他选项是错误的。";
  });

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as keyof typeof PROVIDER_TEMPLATES;
    if (key && PROVIDER_TEMPLATES[key]) {
      const t = PROVIDER_TEMPLATES[key];
      setForm(prev => ({
        ...prev,
        name: t.name,
        apiUrl: t.url,
        model: t.model
      }));
    }
  };

  const handleSaveConfig = async () => {
    if (!form.name || !form.apiUrl || !form.apiKey || !form.model) {
      alert("请填写完整的配置信息");
      return;
    }
    
    if (form.id) {
      await updateConfig(form as LLMConfig);
    } else {
      await addConfig(form as Omit<LLMConfig, 'id'>);
    }
    setShowForm(false);
    setForm({ name: "", apiUrl: "", apiKey: "", model: "", maxTokens: 4096, temperature: 0.7, topP: 1, isActive: false });
  };

  const handleEdit = (c: LLMConfig) => {
    setForm(c);
    setShowForm(true);
  };

  const savePrompts = () => {
    localStorage.setItem('qaPrompt', qaPrompt);
    localStorage.setItem('analysisPrompt', analysisPrompt);
    alert("提示词保存成功");
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>系统设置</h1>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <span>AI 模型配置</span>
          {!showForm && <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ 新增配置</button>}
        </div>

        {showForm ? (
          <div style={{ border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>提供商模板</label>
              <select className={styles.select} onChange={handleTemplateChange} defaultValue="">
                <option value="">自定义</option>
                {Object.entries(PROVIDER_TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>配置名称</label>
              <input className={styles.input} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="例如: DeepSeek V3" />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>API URL (Base URL)</label>
              <input className={styles.input} value={form.apiUrl} onChange={e => setForm({...form, apiUrl: e.target.value})} placeholder="例如: https://api.deepseek.com/v1" />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>API Key</label>
              <input className={styles.input} type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} placeholder="sk-..." />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>模型名称 (Model)</label>
              <input className={styles.input} value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="例如: deepseek-chat" />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Max Tokens</label>
              <input className={styles.input} type="number" value={form.maxTokens || 2000} onChange={e => setForm({...form, maxTokens: parseInt(e.target.value, 10) || 2000})} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Temperature: {form.temperature}</label>
              <input className={styles.slider} type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={e => setForm({...form, temperature: parseFloat(e.target.value)})} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Top P: {form.topP}</label>
              <input className={styles.slider} type="range" min="0" max="1" step="0.05" value={form.topP} onChange={e => setForm({...form, topP: parseFloat(e.target.value)})} />
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={handleSaveConfig}>保存配置</button>
              <button className={styles.btn} onClick={() => setShowForm(false)}>取消</button>
            </div>
          </div>
        ) : (
          <div className={styles.configList}>
            {configs.map(c => (
              <div key={c.id} className={`${styles.configCard} ${c.isActive ? styles.configCardActive : ""}`}>
                <div className={styles.configInfo}>
                  <h4>{c.name} {c.isActive && <span className={styles.badge}>当前使用</span>}</h4>
                  <div className={styles.configMeta}>{c.model} • {c.apiUrl}</div>
                </div>
                <div className={styles.actions}>
                  {!c.isActive && <button className={styles.btn} onClick={() => setActiveConfig(c.id!)}>设为默认</button>}
                  <button className={styles.btn} onClick={() => handleEdit(c)}>编辑</button>
                  <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => { if(confirm("确定删除此配置吗？")) deleteConfig(c.id!); }}>删除</button>
                </div>
              </div>
            ))}
            {configs.length === 0 && <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1rem' }}>暂无模型配置，请新增。</div>}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>自定义提示词 (Prompt)</div>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>答疑提示词</label>
          <textarea className={styles.textarea} value={qaPrompt} onChange={e => setQaPrompt(e.target.value)} />
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>错题分析提示词</label>
          <textarea className={styles.textarea} value={analysisPrompt} onChange={e => setAnalysisPrompt(e.target.value)} />
        </div>

        <button className={styles.btnPrimary} onClick={savePrompts}>保存提示词</button>
      </section>
    </div>
  );
}
