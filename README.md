# LearnHelper Web - 刷题助手 (Web 版)

> **极简·高性能·本地优先（Local-First）** 的现代备考刷题与 AI 智能答疑系统。
> 配套 Android 版 LearnHelper，数据 100% 本地存储于浏览器 IndexedDB，零后端依赖，保护隐私与秒级响应。

---

## 📐 核心架构设计

```mermaid
graph TD
    User([学生用户]) --> UI[Next.js 16 + React 19 UI]
    UI --> Engine[Quiz Engine 判题与乱序算法]
    UI --> Zustand[Zustand 会话状态机]
    UI --> AI[AI 答疑双栏流式模块]
    
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

基于认知心理学中的 **“检索提取练习（Retrieval Practice）”** 与 **“即时强化反馈”** 理论，系统提供 4 大练习形态：

| 模式 | 交互形态 | 反馈机制 | 认知目的 |
|---|---|---|---|
| **顺序练习** (`sequential`) | 单选即点即判，多选提交后判题 | **即时反馈**（立即出红绿对错、标准答案与官方解析） | 主力攻坚阶段，趁大脑活跃即刻纠正认知盲区。 |
| **随机练习** (`random`) | 基于随机数种子（Seed）乱序抽题 | **即时反馈** | 打破顺序记忆惯性，防止“按顺序死记答案”。 |
| **全真模考** (`exam`) | 答题时不锁死选项，随时可修改与翻题 | **延迟反馈**（做题中不揭晓答案，点击“交卷”后统一出具成绩单与全解析） | 考前模拟真实考场压力，检验综合实战水平。 |
| **背诵模式** (`recite`) | 题目下方直接常驻展开正确答案与官方解析 | **免答直接看** | 零基础扫盲阶段快速通读大纲。 |
| **错题复习专场** (`mistakes`) | 错题本一键发起独立会话 | **闭环专练** | 针对做错题目反复盲做，直至彻底掌握。 |

---

## 🤖 AI 答疑与交互架构

### 1. 左右双栏分屏布局（Side-by-Side Split）
- **桌面端默认双栏**：左侧 60% 为题目卡片（题干、选项、操作控制），右侧 40% 为 AI 辅导面板，对照阅读零遮挡；
- **自适应切换**：支持 `[ 🗖 分屏 | 🗕 底部 | 🗗 抽屉 ]` 三种形态自由切换，偏好自动持久化。

### 2. 动态上下文注入（Zero-Prompt Overhead）
每次对话，系统自动将当前题目的全景数据注入 System Prompt：
- 题干内容
- 选项列表（A/B/C/D）
- 标准正确答案
- 学生当前选择（含对错标识）
- 官方解析（如有）

### 3. 一键快捷提问胶囊（Quick Prompt Chips）
- 💡 *为什么选这个答案？*
- 🔍 *逐个选项分析对错*
- 📖 *本题核心考点剖析*
- 🎯 *解题技巧与速记口诀*

### 4. 健壮流式控制
- **流式中断**：支持 `AbortController` 随时点击 `🛑 停止`；
- **一键清空**：支持独立清空当前题目的历史对话与上下文；
- **一键复制**：精准提取 Markdown 解析至剪贴板。

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
- **UI 运行时**：React 19.2 + CSS Modules (零多余依赖，极速加载)
- **状态管理**：Zustand (带 localStorage persist)
- **本地存储**：Dexie.js (IndexedDB 包装层)
- **Markdown 渲染**：`react-markdown`
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
