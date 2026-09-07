import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-teal-700">爱巡店 / AI 门店巡检</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">让每一次门店巡检，都有清晰的路线和结论。</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">从自然语言生成巡检模板，按区域执行任务，用图片辅助发现问题，由巡检人作出最终判定并形成整改闭环。</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800" href="/templates">生成巡检模板</Link>
        <Link className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50" href="/tasks">查看巡检任务</Link>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {[["01", "模板生成", "用一句话描述门店巡检需求"], ["02", "路线执行", "按门店区域逐步完成巡检"], ["03", "问题闭环", "巡检人判定不合格后生成整改任务"]].map(([number, title, description]) => (
          <div className="rounded-xl border border-slate-200 bg-white p-5" key={number}>
            <span className="text-sm font-semibold text-teal-700">{number}</span><h2 className="mt-8 text-lg font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
