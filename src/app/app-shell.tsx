"use client";

import Link from "next/link";
import { useAuth } from "./auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, logout } = useAuth();

  return <>{authenticated && <header className="site-header border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link className="flex items-center gap-2 font-semibold tracking-tight text-slate-950" href="/"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">AI</span>爱巡店</Link><div className="flex min-w-0 items-center gap-2"><nav className="flex items-center gap-1 overflow-x-auto text-sm font-medium text-slate-500"><Link className="shrink-0 rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-slate-900" href="/templates">模板</Link><Link className="shrink-0 rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-slate-900" href="/tasks">任务</Link><Link className="shrink-0 rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-slate-900" href="/rectifications">整改</Link><Link className="shrink-0 rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-slate-900" href="/results">结果</Link></nav><button className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900" onClick={logout} type="button">退出</button></div></div></header>}{children}</>;
}
