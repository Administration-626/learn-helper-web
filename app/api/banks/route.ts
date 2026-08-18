import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface ServerBankItem {
  id: string;
  filename: string;
  name: string;
  count: number;
  url: string;
  sizeBytes: number;
}

const FRIENDLY_NAMES: Record<string, string> = {
  "questions.json": "系统架构设计师·历年真题",
  "gwy_xingce_bank.json": "国家公务员录用考试·行测精选真题",
};

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const banksDir = path.join(publicDir, "banks");
    const results: ServerBankItem[] = [];

    // 1. 扫描根目录 public/questions.json
    const rootQuestions = path.join(publicDir, "questions.json");
    if (fs.existsSync(rootQuestions)) {
      try {
        const stats = fs.statSync(rootQuestions);
        const content = fs.readFileSync(rootQuestions, "utf-8");
        const data = JSON.parse(content);
        const count = Array.isArray(data) ? data.length : (data.questions?.length || 0);
        results.push({
          id: "questions.json",
          filename: "questions.json",
          name: FRIENDLY_NAMES["questions.json"] || "系统架构设计师·真题题库",
          count,
          url: "/questions.json",
          sizeBytes: stats.size,
        });
      } catch (e) {
        console.error("Error reading public/questions.json:", e);
      }
    }

    // 2. 扫描 public/banks 目录下的所有 .json 文件
    if (fs.existsSync(banksDir)) {
      const files = fs.readdirSync(banksDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(banksDir, file);
          try {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(content);
            const count = Array.isArray(data) ? data.length : (data.questions?.length || 0);
            
            let bankName = "";
            if (!Array.isArray(data) && data.name) {
              bankName = data.name;
            } else if (FRIENDLY_NAMES[file]) {
              bankName = FRIENDLY_NAMES[file];
            } else {
              bankName = file.replace(/\.json$/, "").replace(/[_-]/g, " ");
            }

            results.push({
              id: file,
              filename: file,
              name: bankName,
              count,
              url: `/banks/${file}`,
              sizeBytes: stats.size,
            });
          } catch (e) {
            console.error(`Error reading ${filePath}:`, e);
          }
        }
      }
    }

    return NextResponse.json({ banks: results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to scan banks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
