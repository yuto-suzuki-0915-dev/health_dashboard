import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAYFRAME | 今日を予定通りに",
  description: "今日の時間割を決め、実行し、振り返る個人用ダッシュボード",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
