import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "刷题助手 | LearnHelper",
  description: "A clean and focused study application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <div className={styles.container}>
          <aside className={styles.sidebar}>
            <div className={styles.brand}>
              <Link href="/">
                <span className={styles.title}>LearnHelper</span>
              </Link>
            </div>
            <nav className={styles.nav}>
              <Link href="/" className={styles.navLink}>首页</Link>
              <Link href="/quiz" className={styles.navLink}>刷题</Link>
              <Link href="/mistakes" className={styles.navLink}>错题本</Link>
              <Link href="/bank" className={styles.navLink}>题库管理</Link>
              <Link href="/settings" className={styles.navLink}>设置</Link>
            </nav>
          </aside>
          <main className={styles.content}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
