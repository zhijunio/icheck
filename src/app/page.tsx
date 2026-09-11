import Link from "next/link";

const highlights = [
  ["01", "模板智能生成", "描述门店类型、巡检场景和检查重点，快速生成可编辑模板。"],
  ["02", "现场 AI 辅助", "批量上传区域图片，AI 自动匹配巡检项目并辅助判断，最终结果由巡检人确认。"],
  ["03", "整改闭环", "不合格项目自动生成整改任务，AI 提供整改建议并对比整改前后图片。"],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-teal-700">爱巡店 / AI 门店巡检</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">巡检有 AI，整改有闭环</h1>
      <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-600">面向所有门店场景的智能巡检解决方案。用一句话生成按区域组织的巡检模板；上传现场图片，AI 辅助匹配巡检项目、识别问题并生成整改建议，巡检人确认后沉淀可追溯的巡检结果。</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800" href="/templates">创建巡检模板</Link>
        <Link className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50" href="/tasks">开始巡检任务</Link>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {highlights.map(([number, title, description]) => (
          <div className="rounded-xl border border-slate-200 bg-white p-5" key={number}>
            <span className="text-sm font-semibold text-teal-700">{number}</span><h2 className="mt-8 text-lg font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
