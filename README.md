# LearnHelper Web - 刷题助手 (Web 版)

> **极简 · 高性能 · 本地优先（Local-First）** 的现代化智能备考刷题与 AI 深度辅导系统。  
> 纯前端驱动，数据 100% 本地存储于浏览器 IndexedDB，零后端依赖，保护隐私与秒级响应。

---

## 📐 核心架构设计

```mermaid
graph TD
    User([学生用户]) --> UI[Next.js 16 + React 19 UI]
    UI --> KaTeX[KaTeX LaTeX 数学公式引擎]
    UI --> Engine[Quiz Engine 判题与乱序算法]
    UI --> TagEngine[知识领域智能分类与薄弱点透视]
    UI --> Zustand[Zustand 会话状态机]
    UI --> AI[AI 深度思考与流式答疑模块]
    
    Zustand <--> Dexie[(IndexedDB - Dexie.js)]
    Dexie --> Banks[(banks 题库)]
    Dexie --> Questions[(questions 题目)]
    Dexie --> Mistakes[(mistakes 错题)]
    Dexie --> LLMConfig[(llmConfigs 模型配置)]
    Dexie --> ChatHistory[(chatMessages 会话记录)]

    AI --> Proxy[/api/chat 安全代理路由]
    Proxy --> Upstream[OpenAI / DeepSeek / 阿里百炼 / 硅基流动 / 月之暗面]
```

---

## 🎯 刷题模式设计规范

基于认知心理学中的 **“检索提取练习（Retrieval Practice）”** 与 **“即时强化反馈”** 理论，系统提供 5 大练习形态：

| 模式 | 交互形态 | 反馈机制 | 认知目的 |
|:---|:---|:---|:---|
| **顺序练习** (`sequential`) | 单选即点即判，多选提交后判题 | **即时反馈**（立即呈现对错、标准答案与官方解析） | 主力攻坚阶段，即刻纠正认知盲区。 |
| **随机练习** (`random`) | 基于随机数种子（Seed）乱序抽题 | **即时反馈** | 打破顺序记忆惯性，杜绝“按题号死记答案”。 |
| **全真模考** (`exam`) | 答题时不锁死选项，随时可修改与翻题 | **延迟反馈**（做题中不揭晓答案，交卷后统一出具成绩单与全解析） | 考前模拟真实考场压力，检验综合实战水平。 |
| **背诵模式** (`recite`) | 题目下方直接常驻展开正确答案与官方解析 | **免答直接看** | 零基础扫盲阶段快速通读考点大纲。 |
| **错题复习专场** (`mistakes`) | 错题本一键发起独立会话 | **闭环专练**（答对自动移出错题本） | 针对做错题目反复盲做，直至彻底掌握。 |

---

## 📐 LaTeX 公式与富文本全景渲染

- **双渲染通道**：集成 `remark-math` 与 `rehype-katex`，完美支持行内公式（`$E=mc^2$`）与块级公式（`$$\int f(x)dx$$`）。
- **全场景覆盖**：题干、选项、官方解析、自定义解析编辑器以及 AI 答疑流式面板均统一支持 LaTeX 公式排版。
- **排版增强**：自动规范 CJK 中文引号与标点在 Markdown 加粗语法下的渲染兼容。

---

## 🤖 AI 答疑与交互架构

### 1. 左右双栏分屏布局（Side-by-Side Split）
- **桌面端默认双栏**：左侧为题目卡片（题干、选项、操作控制），右侧为 AI 辅导面板，对照阅读零遮挡；
- **自适应形态**：支持 `[ 🗖 分屏 | 🗕 底部 | 🗗 抽屉 ]` 自由切换，偏好自动持久化。

### 2. 深度思考推理流（Thinking Streaming）
- 完整支持 DeepSeek-R1 等推理模型的 `reasoning_content` 流式输出；
- 配备专属折叠面板与实时耗时计时器，解题思路全透明。

### 3. 多轮对话与解析采纳闭环
- **解析采纳状态机**：支持将 AI 回答一键「采纳为题目解析」或「追加到现有解析」；
- **防误触撤销回滚**：提供 500ms 冷却保护与一键还原机制；
- **长文本截断检测**：超出 Token 限制自动提示并提供「继续生成」按钮拼接回答；
- **Markdown 笔记导出**：一键将当前题目、选项、答案与 AI 答疑内容导出为结构化 Markdown 本地笔记。

### 4. 动态上下文注入（Zero-Prompt Overhead）
每次对话，系统自动将当前题目的全景数据注入 System Prompt：
- 题干内容与知识领域分类
- 选项列表（A/B/C/D）
- 标准正确答案
- 学生当前选择（含对错标识）
- 官方与用户自定义解析

---

## 📊 知识领域智能分类与薄弱点透视

- **自动打标与领域归类**：智能聚类题库知识领域；
- **刷题防剧透**：做题过程中自动隐藏分类标签，交卷或查看解析时才展示；
- **薄弱点雷达**：错题本与模考结果页提供按领域分类统计，快速定位复习死角。

---

## 💾 数据存储架构（IndexedDB Schema）

```typescript
// 数据库版本: LearnHelperDB v1
db.version(1).stores({
  questions: '++id, bankId, type',
  banks: '++id, name, createdAt',
  mistakes: '++id, questionId, bankId, createdAt',
  llmConfigs: '++id, name, isActive',
  chatMessages: '++id, questionId, createdAt'
});
```

---

## 🛠️ 技术栈

- **框架**：Next.js 16.3.1 (Turbopack, App Router)
- **UI 运行时**：React 19.2 + CSS Modules (零冗余依赖，极致轻量)
- **状态管理**：Zustand 5 (带 localStorage 持久化)
- **本地存储**：Dexie.js 4 (IndexedDB 包装层)
- **公式与富文本**：KaTeX + react-markdown + remark-math + rehype-katex + remark-gfm
- **内置题库**：历年系统架构设计师真题（609 题，100% 完整答案）

---

## 🚀 启动与构建

```bash
# 1. 进入 web 目录
cd learn-helper-web

# 2. 安装依赖
npm install

# 3. 启动本地开发
npm run dev

# 4. 代码规范检查 (0 警告 0 报错)
npm run lint

# 5. 生产构建打包
npm run build
```
