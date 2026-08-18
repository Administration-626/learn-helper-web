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

import { DEFAULT_QA_SYSTEM_PROMPT } from "@/components/AIChat";

export const DEFAULT_ANALYSIS_SYSTEM_PROMPT = `你是一名权威的考试辅导名师与学科专家。请结合本次模考的得分与错题分布，按知识领域深度剖析薄弱考点，采用【多维错因归因】（概念混淆/审题偏差/逻辑推导/知识盲区/计算应用）总结高频失分点，并给出针对性的题眼识别技巧、解题套路与提分备考建议。回答需逻辑清晰、直击考点、拒绝废话。`;

export interface PromptPreset {
  id: string;
  name: string;
  desc: string;
  qaPrompt: string;
  analysisPrompt: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "general",
    name: "通用考试名师（全科通用）",
    desc: "适用于公考、软考、考研、资格认证、期末考试等各类客观题与主观题",
    qaPrompt: DEFAULT_QA_SYSTEM_PROMPT,
    analysisPrompt: DEFAULT_ANALYSIS_SYSTEM_PROMPT,
  },
  {
    id: "gwy",
    name: "国家公务员考试·行测申论名师",
    desc: "专精国考/省考行测（常识、言语、判断推理、数量资料）与申论命题逻辑",
    qaPrompt: `你是一名权威的国家公务员录用考试（国考/省考行测与申论）辅导名师。回答请严谨、精炼、直击公考命题逻辑。

【解题与考点解析规范】：
1. 严禁生硬套话，直击公考行测核心秒杀套路与命题思维。
2. 解题技巧按以下维度结构化输出：
   - 【题眼定位与秒杀特征】：指出常识/言语/判断/数量中的关键题眼或题干逻辑漏洞。
   - 【选项对比与干扰项排除】：分析正确项的直接依据，逐一指出错误项的常见陷阱（如扩大范围、偷换概念、无中生有、过度推断）。
   - 【行测速解技巧】：给出该类题型的速算技巧、逻辑推导模型或类比推理速判法。
3. 【错因剖析与提分要点】：明确错因（审题马虎/知识盲区/逻辑漏洞/时间分配不当），并给出考场提速与提分建议。
4. 【排版规范】：结构清晰，关键结论与秒杀词加粗，逻辑公式规范表达。`,
    analysisPrompt: `你是一名资深的公务员考试（行测与申论）辅导名师。请结合本次行测模拟的得分与各模块（常识判断、言语理解、判断推理、数量关系、资料分析）错题分布，深度剖析薄弱模块，按【思维漏洞与审题陷阱】总结失分规律，并针对性给出公考提速技巧、刷题策略与临考提分建议。`,
  },
  {
    id: "ruankao",
    name: "国家软考·计算机专业名师",
    desc: "专精系统架构设计师、软件设计师、网络工程师等软考资格考试",
    qaPrompt: `你是一名国家软考（系统架构设计师/软件设计师/网络工程师）辅导名师。回答请严谨、精炼、直击软考大纲考点。

【解题与考点解析规范】：
1. 严禁编造生拼硬凑的打油诗或谐音口诀。
2. 解题技巧按以下维度结构化输出：
   - 【题眼识别与特征词】：提取技术概念中最具辨识度的关键词。
   - 【架构/技术对比表】：针对易混淆技术（如各种架构风格、设计模式、数据库分级、安全级别），用 Markdown 表格对比。
   - 【避坑与排除法】：指出出题人设坑套路（如强行捆绑、概念嫁接、绝对化断言）。
3. 【错题四维归因】：归类为 [概念混淆] / [审题偏差] / [计算应用失误] / [知识盲区]，给出提分点。
4. 【排版规范】：技术专有名词与核心加粗，算法与公式使用 LaTeX 规范。`,
    analysisPrompt: `你是一名国家软考辅导名师。请结合本次模考的得分与错题分布，按计算机知识领域剖析薄弱考点，采用【四维错因归因】（概念混淆/审题偏差/计算应用/知识盲区）总结高频失分点，并给出针对性的题眼识别技巧与提分备考建议。`,
  },
  {
    id: "academic",
    name: "学术考研·专业课深研导师",
    desc: "注重学术原理解析、底层逻辑推导与深入概念辨析",
    qaPrompt: `你是一名资深的学术导师与研究生入学考试辅导名师。回答请注重底层原理与学科体系推导。

【解析规范】：
1. 【原理溯源】：阐述题目背后的底层学科原理、核心定理或理论框架。
2. 【严密推导】：给出 step-by-step 逻辑推导或数学证明过程，拒绝跳步。
3. 【概念辨析与拓展】：横向对比相关经典概念，指出学术争议点或常见理解误区。
4. 【学术建议】：提供该知识点的进阶阅读方向或解题方法论。`,
    analysisPrompt: `你是一名资深的研究生专业课导师。请结合本次测试的错题分布，对考生的学科知识网络进行深度诊断，指出知识断层与理解偏差，并给出阶段性进阶学习路线。`,
  }
];

export default function SettingsPage() {
  const { configs, loadConfigs, addConfig, updateConfig, deleteConfig, setActiveConfig } = useSettingsStore();
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState<Partial<LLMConfig>>({
    name: "", apiUrl: "", apiKey: "", model: "", maxTokens: 8192, temperature: 0.7, topP: 1, isActive: false
  });

  const [qaPrompt, setQaPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qaPrompt") || DEFAULT_QA_SYSTEM_PROMPT;
    }
    return DEFAULT_QA_SYSTEM_PROMPT;
  });

  const [analysisPrompt, setAnalysisPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("analysisPrompt") || DEFAULT_ANALYSIS_SYSTEM_PROMPT;
    }
    return DEFAULT_ANALYSIS_SYSTEM_PROMPT;
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
    setForm({ name: "", apiUrl: "", apiKey: "", model: "", maxTokens: 8192, temperature: 0.7, topP: 1, isActive: false });
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
              <label className={styles.label}>
                Max Tokens（单次最大生成长度，建议 8192）
              </label>
              <input
                className={styles.input}
                type="number"
                min="1024"
                max="32768"
                step="1024"
                value={form.maxTokens || 8192}
                onChange={e => setForm({...form, maxTokens: parseInt(e.target.value, 10) || 8192})}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                深度思考/推理模型（Reasoning Models）的思考过程会消耗额外 Token，建议设置 8192 或更高以防长解析被截断。
              </span>
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
        <div className={styles.sectionTitle}>
          <span>自定义提示词 (Prompt)</span>
        </div>

        <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <label className={styles.label} style={{ marginBottom: '0.5rem', display: 'block' }}>
            快速套用名师预设模板
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {PROMPT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.btn}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  setQaPrompt(preset.qaPrompt);
                  setAnalysisPrompt(preset.analysisPrompt);
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text)' }}>
                  {preset.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>
            AI 答疑系统提示词 (QA System Prompt)
          </label>
          <textarea
            className={styles.textarea}
            rows={8}
            value={qaPrompt}
            onChange={e => setQaPrompt(e.target.value)}
            placeholder="自定义单题答疑时的 AI 角色设定、解题规范与输出格式..."
          />
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>
            模考/错题系统分析提示词 (Analysis System Prompt)
          </label>
          <textarea
            className={styles.textarea}
            rows={5}
            value={analysisPrompt}
            onChange={e => setAnalysisPrompt(e.target.value)}
            placeholder="自定义整套试卷/错题本智能分析时的 AI 诊断维度与建议格式..."
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={styles.btnPrimary} onClick={savePrompts}>保存提示词</button>
          <button 
            className={styles.btn} 
            onClick={() => {
              if (confirm("确定要恢复默认通用名师提示词吗？")) {
                setQaPrompt(DEFAULT_QA_SYSTEM_PROMPT);
                setAnalysisPrompt(DEFAULT_ANALYSIS_SYSTEM_PROMPT);
                localStorage.removeItem('qaPrompt');
                localStorage.removeItem('analysisPrompt');
                alert("已恢复默认通用名师提示词！");
              }
            }}
          >
            恢复默认提示词
          </button>
        </div>
      </section>
    </div>
  );
}
