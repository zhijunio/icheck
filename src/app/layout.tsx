import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DemoTaskProvider } from "./demo-task-context";
import { AppShell } from "./app-shell";
import { AuthGate, AuthProvider } from "./auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "爱巡店 | AI 门店巡检",
  description: "按区域执行门店巡检，AI 辅助发现问题并形成整改闭环。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col"><AuthProvider><DemoTaskProvider><AuthGate><AppShell>{children}</AppShell></AuthGate></DemoTaskProvider></AuthProvider></body>
    </html>
  );
}
