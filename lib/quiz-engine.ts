import { Question, QuizMode } from '@/lib/types';

// Deterministic random shuffle using seed
export function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let currentSeed = seed;
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateQuestionOrder(total: number, mode: QuizMode, seed?: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  if (mode === 'random' && seed !== undefined) {
    return shuffleWithSeed(indices, seed);
  }
  return indices;
}

export function isMultiBlankQuestion(question?: Question | Partial<Question> | null): boolean {
  if (!question || !question.options) return false;
  return Object.keys(question.options).some(k => /^\(\d+\)/.test(k));
}

export function isMultiChoiceQuestion(question?: Question | Partial<Question> | null): boolean {
  if (!question) return false;
  if (question.type === 'multi') return true;
  if (isMultiBlankQuestion(question)) return true;
  const cleanAns = (question.answer || '').replace(/[^A-Za-z0-9]/g, '');
  return cleanAns.length > 1;
}

/** Parses selected answer string into an array of option keys */
export function parseSelectedOptions(answerStr: string | null | undefined): string[] {
  if (!answerStr) return [];
  const trimmed = answerStr.trim();
  if (!trimmed) return [];
  if (trimmed.includes(',') || trimmed.includes(' ') || trimmed.startsWith('(')) {
    const matches = trimmed.match(/\(\d+\)[A-Za-z0-9]|[A-Za-z0-9]/g);
    return matches || [];
  }
  return trimmed.split('');
}

/** Formats an array of option keys back into an answer string */
export function formatSelectedOptions(options: string[]): string {
  if (!options || options.length === 0) return '';
  const isMultiBlank = options.some(k => /^\(\d+\)/.test(k));
  if (isMultiBlank) {
    const sorted = [...options].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return sorted.join(',');
  }
  return [...options].sort().join('');
}

/** Formats any answer string into a human-readable display label (e.g. "(1) C  (2) D" or "A, B, C") */
export function formatReadableAnswer(answerStr: string | null | undefined, question?: Question | Partial<Question> | null): string {
  if (!answerStr) return "未作答";
  const raw = answerStr.trim();
  if (!raw) return "未作答";

  const isMultiBlank = isMultiBlankQuestion(question) || /^\(\d+\)/.test(raw) || /\(\d+\)/.test(raw);

  if (isMultiBlank) {
    const blankMap = new Map<number, string>();
    
    // 1. Try extracting "(1)A" or "1A" style pairs (including legacy scrambled strings like "((2)D)1C")
    const regexWithParen = /(?:\((\d+)\)|(\d+))\s*([A-Za-z0-9])/g;
    let match: RegExpExecArray | null;
    let foundPairs = false;
    while ((match = regexWithParen.exec(raw)) !== null) {
      foundPairs = true;
      const group = parseInt(match[1] || match[2], 10);
      const letter = match[3].toUpperCase();
      blankMap.set(group, letter);
    }

    // 2. If raw is just pure letters e.g. "CC" or "ABCD" for a multi-blank question
    if (!foundPairs) {
      const cleanLetters = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      for (let i = 0; i < cleanLetters.length; i++) {
        blankMap.set(i + 1, cleanLetters[i]);
      }
    }

    if (blankMap.size > 0) {
      const sortedGroups = Array.from(blankMap.keys()).sort((a, b) => a - b);
      return sortedGroups.map(g => `(${g}) ${blankMap.get(g)}`).join('  ');
    }
  }

  // If standard multi-choice with multiple letters: e.g. "ABC" -> "A, B, C"
  const cleanLetters = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanLetters.length > 1 && !isMultiBlank) {
    return cleanLetters.split('').join(', ');
  }

  return raw.toUpperCase();
}

export function isOptionSelected(optKey: string, selectedAnswer: string | null | undefined): boolean {
  const list = parseSelectedOptions(selectedAnswer);
  return list.includes(optKey);
}

export function isOptionCorrect(optKey: string, question?: Question | Partial<Question> | null): boolean {
  if (!question || !question.answer) return false;
  const cleanCorrect = question.answer.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const groupMatch = optKey.match(/^\((\d+)\)([A-Za-z0-9])$/);
  if (groupMatch) {
    const groupNum = parseInt(groupMatch[1], 10);
    const letter = groupMatch[2].toUpperCase();
    const correctLetter = cleanCorrect[groupNum - 1];
    return letter === correctLetter;
  }

  return cleanCorrect.includes(optKey.toUpperCase());
}

export function toggleOptionSelection(currentAnswer: string, optKey: string): string {
  const currentList = parseSelectedOptions(currentAnswer);
  const isMultiBlank = /^\((\d+)\)/.test(optKey);

  if (isMultiBlank) {
    const groupMatch = optKey.match(/^\((\d+)\)/);
    const groupPrefix = groupMatch ? groupMatch[0] : "";
    
    if (currentList.includes(optKey)) {
      const nextList = currentList.filter(k => k !== optKey);
      return formatSelectedOptions(nextList);
    } else {
      const nextList = currentList.filter(k => !k.startsWith(groupPrefix)).concat(optKey);
      return formatSelectedOptions(nextList);
    }
  } else {
    if (currentList.includes(optKey)) {
      const nextList = currentList.filter(k => k !== optKey);
      return formatSelectedOptions(nextList);
    } else {
      const nextList = [...currentList, optKey];
      return formatSelectedOptions(nextList);
    }
  }
}

export function checkAnswer(userAnswer: string, correctAnswer: string, type?: 'single' | 'multi'): boolean {
  const cleanCorrect = (correctAnswer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const selected = parseSelectedOptions(userAnswer);

  if (selected.some(k => /^\(\d+\)/.test(k))) {
    const blankMap = new Map<number, string>();
    for (const item of selected) {
      const m = item.match(/^\((\d+)\)([A-Za-z0-9])$/);
      if (m) blankMap.set(parseInt(m[1], 10), m[2].toUpperCase());
    }
    const maxGroup = Math.max(...Array.from(blankMap.keys()), cleanCorrect.length);
    let extracted = "";
    for (let i = 1; i <= maxGroup; i++) {
      extracted += blankMap.get(i) || " ";
    }
    return extracted.trim() === cleanCorrect;
  }

  const cleanUser = (userAnswer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const isMulti = type === 'multi' || cleanCorrect.length > 1;
  if (!isMulti) {
    return cleanUser === cleanCorrect;
  }
  
  const sortedUser = cleanUser.split('').sort().join('');
  const sortedCorrect = cleanCorrect.split('').sort().join('');
  return sortedUser === sortedCorrect;
}

export function calculateStats(answers: Record<number, string>, questions: Question[]) {
  let correct = 0;
  let incorrect = 0;
  const incorrectQuestions: Question[] = [];

  for (const [idStr, userAnswer] of Object.entries(answers)) {
    const qId = parseInt(idStr, 10);
    const question = questions.find(q => q.id === qId);
    
    if (question) {
      const isCorrect = checkAnswer(userAnswer, question.answer, question.type || 'single');
      if (isCorrect) {
        correct++;
      } else {
        incorrect++;
        incorrectQuestions.push(question);
      }
    }
  }

  const total = Object.keys(answers).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    total,
    correct,
    incorrect,
    accuracy,
    incorrectQuestions
  };
}

export function classifyQuestion(q: Question | Partial<Question>): string {
  if (q.tag && q.tag.trim()) return q.tag.trim();

  const qNumber = q.number ?? 0;
  const qStem = (q.question || '').toLowerCase();
  const text = (qStem + ' ' + JSON.stringify(q.options || {}) + ' ' + (q.explanation || '')).toLowerCase();

  // 1. 专业英语 (71-75)
  if (qNumber >= 71 && qNumber <= 75 && /^[a-zA-Z\s\(\)\_\,\.\-\;\:\?\!\'\"]+/.test((q.question || '').trim())) {
    return '专业英语';
  }

  // 2. 法律法规与知识产权
  if (/(著作权|专利权|专利法|专利申请|外观设计|发明创造|职务发明|商标权|商标法|商业秘密|职务作品|署名权|发表权|修改权|侵权|知识产权|开源许可|gpl|mit|bsd|标准化|国家标准|gb\/t|iso\/iec)/i.test(text)) {
    return '法律法规与知识产权';
  }

  // 3. 数学与运筹优化
  if (/(排列|组合|概率|期望|线性规划|最大流|最小生成树|最短路径|博弈|运筹|决策树|后悔值|悲观主义|乐观主义|折中主义|状态转移方程|动态规划|矩阵乘法|前趋图|二叉树|哈夫曼|平衡二叉树|图的遍历|图论|蒙特卡洛|不等式|容斥|集合运算|求导|极值)/i.test(text) && !/(架构风格|设计模式|进程调度)/i.test(qStem)) {
    return '数学与运筹优化';
  }

  // 4. 数据库系统
  if (/(关系模式|函数依赖|候选码|候选键|主键|主码|外键|范式|1nf|2nf|3nf|bcnf|4nf|无损连接|保持函数依赖|关系代数|元组演算|领域演算|投影|选择|自然连接|笛卡尔积|除运算|交集|并集|sql|事务|acid|原子性|一致性|隔离性|持久性|并发控制|封锁协议|排他锁|共享锁|两段锁|死锁|恢复技术|日志文件|checkpoint|nosql|mongodb|redis|分布式数据库|两阶段提交|2pc|cap定理|base理论|数据仓库|olap|etl|数据挖掘|e-r图|er图|概念模型|三级模式|内模式|外模式|概念模式|聚簇索引|索引|视图|关系运算)/i.test(text)) {
    return '数据库系统';
  }

  // 5. 操作系统
  if (/(操作系统|进程|线程|临界区|互斥|同步|信号量|pv操作|死锁|死锁预防|死锁避免|银行家算法|死锁检测|进程调度|fcfs|sjf|rr|时间片轮转|优先级调度|页式存储|段式存储|段页式|快表|tlb|页面置换|fifo|lru|opt|缺页中断|抖动|虚拟内存|文件系统|inode|逻辑块号|物理块号|索引节点|索引分配|位示图|目录结构|设备管理|spooling|磁盘调度|c-scan|scan|sstf|磁盘写回|掉电|目录文件)/i.test(text)) {
    return '操作系统';
  }

  // 6. 系统架构设计 (核心大类)
  if (/(架构风格|体系结构风格|架构评估|atam|cbam|saam|质量属性|敏感点|权衡点|风险点|非风险点|设计模式|创建型|结构型|行为型|singleton|factory|observer|adapter|bridge|composite|decorator|facade|proxy|strategy|template method|中间件|corba|dcom|soa|微服务|服务网格|构件|连接件|absdm|4\+1视图|逻辑视图|开发视图|物理视图|进程视图|用例视图|基于架构的软件开发|架构复审|架构演化|领域驱动设计|ddd|架构描述语言|adl|dssa|特定领域软件架构|架构复用|软件复用|机会复用|系统性复用|c\/s架构|b\/s架构|三层架构|企业应用集成|eai|wsdl|soap|restful|web服务|可修改性|可用性|安全性|可扩展性|性能架构|遗留系统)/i.test(text)) {
    return '系统架构设计';
  }

  // 7. 信息安全
  if (/(加密|解密|对称加密|非对称加密|rsa|des|3des|aes|sha|md5|数字签名|数字证书|ca认证|pki|ssl|tls|https|ipsec|防火墙|入侵检测|ids|ips|dos攻击|ddos|sql注入|xss|跨站脚本|木马|病毒|访问控制|rbac|dac|mac|鉴别|kerberos|pgp|s\/mime|流量分析|重放攻击|网闸|安全设备|灾难恢复|灾备中心|容灾|安全体系|信息安全)/i.test(text)) {
    return '信息安全';
  }

  // 8. 计算机网络
  if (/(osi|tcp|udp|ip地址|子网掩码|子网划分|cidr|vlan|路由协议|ospf|bgp|rip|dns|dhcp|snmp|smtp|pop3|imap|http|ftp|arp|rarp|交换机|路由器|以太网|sdn|广域网|三层交换|无线局域网|802\.11|网络规划|网络互联|网络延迟|5g网络|局域网|传输速率|交换方式)/i.test(text)) {
    return '计算机网络';
  }

  // 9. 信息化与项目管理
  if (/(项目管理|范围管理|进度管理|甘特图|关键路径|cpm|pert|总时差|自由时差|成本管理|挣值分析|evm|进度偏差|成本偏差|cv|sv|cpi|spi|风险管理|风险识别|风险应对|规避|转移|减轻|接受|配置管理|基线|变更管理|变更控制|ccb|质量保证|qa|cmmi|过程改进|pdca|组织信息化|电子政务|企业信息化|erp|crm|供应链|scm|商业智能|bi|信息系统战略|企业架构|togaf|企业数字化|数字化转型|智慧城市|两化融合|数据资产)/i.test(text)) {
    return '信息化与项目管理';
  }

  // 10. 计算机系统与性能
  if (/(计算机体系结构|cpu|gpu|控制器|运算器|指令系统|cisc|risc|流水线|吞吐率|加速比|存储层次|cache|命中率|虚拟存储|总线|可靠性计算|串联系统|并联系统|失效率|mttf|mtbf|mttr|raid|raid 0|raid 1|raid 5|校验码|奇偶校验|海明码|crc|性能指标|性能评估|基准测试|benchmark|响应时间|吞吐量|压力测试|负载测试|双机热备|容错系统|采样频率|奈奎斯特)/i.test(text)) {
    return '计算机系统与性能';
  }

  // 11. 软件工程
  if (/(软件工程|开发模型|瀑布模型|原型模型|螺旋模型|v模型|喷泉模型|敏捷开发|scrum|xp|极限编程|看板|统一过程|rup|需求工程|需求获取|需求分析|需求规格说明|srs|需求陈述|需求验证|需求变更|结构化分析|dfd|数据字典|uml|用例图|类图|时序图|顺序图|状态机图|活动图|构件图|部署图|软件测试|黑盒测试|白盒测试|边界值分析|等价类划分|路径测试|单元测试|集成测试|系统测试|验收测试|a\/b测试|自动化测试|数据驱动测试|软件维护|改正性维护|适应性维护|完善性维护|预防性维护|逆向工程|再工程|净室工程|耦合|内聚|mccabe|复杂性度量|模块化|软件文档|n版本)/i.test(text)) {
    return '软件工程';
  }

  // 12. 嵌入式系统
  if (/(嵌入式|rtos|实时系统|微控制器|mcu|mpu|dsp|soc|片上系统|arm|cortex|交叉编译|板级支持包|bsp|嵌入式linux|vxworks|freertos|中断处理|看门狗|watchdog|can总线|i2c|spi|uart)/i.test(text)) {
    return '嵌入式系统';
  }

  // 13. 前沿技术与人工智能
  if (/(云计算|iaas|paas|saas|大数据|物联网|边缘计算|区块链|人工智能|深度学习|机器学习|专家系统|协同过滤)/i.test(text)) {
    return '前沿技术与人工智能';
  }

  return '综合基础与前沿';
}

/**
 * 考点掌握度加权算法（借鉴 DeepTutor 掌握度模型）
 * 越近的做题记录权重越高，结合置信度封顶，返回 0~1 的掌握度得分
 */
export function computeMastery(correctness: boolean[]): number {
  if (!correctness.length) return 0;
  const weights = [0.5, 0.7, 0.85, 0.95, 1.0].slice(-correctness.length);
  const recent = correctness.slice(-weights.length);
  const score = recent.reduce((sum, c, i) => sum + (c ? weights[i] : 0), 0) / weights.reduce((a, b) => a + b, 0);
  const cap = correctness.length === 1 ? 0.5 : correctness.length === 2 ? 0.8 : 1.0;
  return Math.min(score, cap);
}

/**
 * 艾宾浩斯间隔复习计算器（借鉴 DeepTutor Spaced Repetition）
 * 计算下一次复习时间戳与间隔阶梯
 */
const SRS_INTERVAL_DAYS = [1, 2, 4, 7, 15, 30];
export function computeNextReview(intervalIndex: number, isCorrect: boolean): { nextIntervalIndex: number; nextReviewAt: number } {
  let nextIndex = intervalIndex;
  if (isCorrect) {
    nextIndex = Math.min(intervalIndex + 1, SRS_INTERVAL_DAYS.length - 1);
  } else {
    nextIndex = Math.max(0, intervalIndex - 1);
  }
  const days = SRS_INTERVAL_DAYS[nextIndex];
  const nextReviewAt = Date.now() + days * 86400 * 1000;
  return { nextIntervalIndex: nextIndex, nextReviewAt };
}
