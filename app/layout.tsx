import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "katex/dist/katex.min.css";
import styles from "./layout.module.css";

import { HomeIcon, PencilIcon, BookOpenIcon, LibraryIcon, SettingsIcon } from "@/components/Icons";

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
              <Link href="/" className={styles.navLink}>
                <HomeIcon size={18} />
                <span>首页</span>
              </Link>
              <Link href="/quiz" className={styles.navLink}>
                <PencilIcon size={18} />
                <span>刷题</span>
              </Link>
              <Link href="/mistakes" className={styles.navLink}>
                <BookOpenIcon size={18} />
                <span>错题本</span>
              </Link>
              <Link href="/bank" className={styles.navLink}>
                <LibraryIcon size={18} />
                <span>题库管理</span>
              </Link>
              <Link href="/settings" className={styles.navLink}>
                <SettingsIcon size={18} />
                <span>设置</span>
              </Link>
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
