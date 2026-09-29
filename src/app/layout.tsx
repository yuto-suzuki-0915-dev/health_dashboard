import type { Metadata } from "next";
import "./globals.css";
import "./features.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "DAYFRAME | 今日を予定通りに",
  description: "予定と実績を比べ、今日の優先事項と週の主要目標を確認するダッシュボード",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
