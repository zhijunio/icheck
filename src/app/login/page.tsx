"use client";

import Link from "next/link";
import { Suspense, type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../auth-context";

export default function LoginPage() {
  return <Suspense fallback={<LoginLoadingState />}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, hydrated, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (login(username, password)) {
      const from = searchParams.get("from");
      router.replace(from?.startsWith("/") && from !== "/login" ? from : "/");
      return;
    }
    setError("用户名或密码错误，请重试。");
  }

  if (hydrated && authenticated) {
    router.replace("/");
    return null;
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"><div className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white">AI</span><p className="mt-5 text-sm font-semibold text-teal-700">爱巡店</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">登录爱巡店</h1><p className="mt-3 text-sm leading-6 text-slate-500">登录后开始创建模板、执行巡检和处理整改。</p></div><form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">用户名<input autoComplete="username" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50" onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="请输入用户名" required value={username} /></label><label className="block text-sm font-medium text-slate-700">密码<input autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50" onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="请输入密码" required type="password" value={password} /></label>{error && <p aria-live="polite" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<button className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-800" type="submit">登录</button></form><Link className="mt-6 block text-center text-xs text-slate-400 hover:text-teal-700" href="/">爱巡店 AI 门店巡检 Demo</Link></section></main>;
}

function LoginLoadingState() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><p className="text-sm text-slate-500">正在加载登录页面...</p></main>;
}
