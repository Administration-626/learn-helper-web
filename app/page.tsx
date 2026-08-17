import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  const actions = [
    {
      title: "开始刷题",
      description: "进入题库，随机或按顺序刷题",
      icon: "✏️",
      href: "/quiz",
    },
    {
      title: "错题复习",
      description: "回顾历史错题，巩固薄弱知识点",
      icon: "📓",
      href: "/mistakes",
    },
    {
      title: "管理题库",
      description: "导入题库，查看题库列表",
      icon: "📚",
      href: "/bank",
    },
    {
      title: "配置设置",
      description: "偏好设置，AI助手配置",
      icon: "⚙️",
      href: "/settings",
    }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>欢迎使用 LearnHelper</h1>
        <p className={styles.subtitle}>您的专属智能刷题助手，让学习更高效。</p>
      </header>
      
      <div className={styles.grid}>
        {actions.map((action, i) => (
          <Link href={action.href} key={i} className={styles.card}>
            <div className={styles.icon}>{action.icon}</div>
            <h2 className={styles.cardTitle}>{action.title}</h2>
            <p className={styles.cardDesc}>{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
