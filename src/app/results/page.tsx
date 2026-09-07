"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AiReport, Analysis, DemoTask, useDemoTask } from "../demo-task-context";
import { defaultInspectionAreas, InspectionArea } from "../demo-data";
import { formatShanghaiTime } from "../time";

const results = [
  { area: "入口及前场", item: "入口通道是否畅通", result: "PASS", detail: "未发现明显障碍物。", areaIndex: 0, itemIndex: 0 },
  { area: "入口及前场", item: "地面是否存在明显垃圾或积水", result: "PASS", detail: "未发现明显异常。", areaIndex: 0, itemIndex: 1 },
  { area: "商品陈列区", item: "商品陈列是否整齐", result: "UNKNOWN", detail: "图片清晰度不足，建议补充正面照片。", areaIndex: 1, itemIndex: 0 },
  { area: "商品陈列区", item: "货架和商品表面是否清洁", result: "UNKNOWN", detail: "图片清晰度不足，建议补充正面照片。", areaIndex: 1, itemIndex: 1 },
  { area: "设备区", item: "设备外观是否存在明显破损", result: "PASS", detail: "未发现明显异常。", areaIndex: 2, itemIndex: 0 },
  { area: "设备区", item: "设备运行是否存在明显异常", result: "PASS", detail: "未发现明显异常。", areaIndex: 2, itemIndex: 1 },
  { area: "仓储区", item: "仓库通道是否被货物占用", result: "FAIL", detail: "发现纸箱占用仓库通道。", areaIndex: 3, itemIndex: 0 },
  { area: "仓储区", item: "商品堆放是否稳固", result: "FAIL", detail: "发现纸箱占用通道，存在堆放风险。", areaIndex: 3, itemIndex: 1 },
  { area: "消防及安全区", item: "消防通道是否畅通", result: "PASS", detail: "未发现明显异常。", areaIndex: 4, itemIndex: 0 },
  { area: "消防及安全区", item: "消防设施是否被遮挡", result: "PASS", detail: "未发现明显异常。", areaIndex: 4, itemIndex: 1 },
] as const;

type ResultItem = {
  area: string;
  item: string;
  result: Analysis["result"];
  detail: string;
  areaIndex: number;
  itemIndex: number;
  photos: string[];
  confirmed?: Analysis["confirmed"];
  confirmedBy?: string;
  confirmedAt?: string;
  rectificationSuggestion?: string;
  rectificationPriority?: Analysis["rectificationPriority"];
  rectificationDeadline?: string;
  rectificationAcceptanceCriteria?: string;
  rectificationPhoto?: string;
  aiAssisted: boolean;
};

export default function ResultsPage() {
  const { hydrated, currentTask, photos, itemPhotos, visitedAreas, analyses, tasks, setCurrentTask, saveAiReport } = useDemoTask();
  const completedTasks = tasks.filter((task) => task.status === "已完成");
  const areas: InspectionArea[] = currentTask?.areas ?? defaultInspectionAreas;
  const taskStore = currentTask?.store ?? "示例门店";
  const taskScenario = currentTask?.scenario ?? "关店前巡检";
  const taskAssignee = currentTask?.assignee ?? "张三";
  const taskExecutionTime = currentTask?.executionTime;
  const totalDuration = formatDuration(currentTask?.startedAt, currentTask?.completedAt);
  const visitedAreaNames = visitedAreas.map((areaIndex) => areas[areaIndex]?.name).filter((name): name is string => Boolean(name));
  const taskStatus = currentTask?.status ?? "待执行";
  const inspectedResults: ResultItem[] = areas.flatMap((area, areaIndex) => area.items.map((item, itemIndex) => {
    const fallback = results.find((result) => result.areaIndex === areaIndex && result.itemIndex === itemIndex);
    const analysis = analyses[`${areaIndex}:${itemIndex}`];
    const areaPhotos = photos[areaIndex] ?? [];
    const manualPhotos = itemPhotos[`${areaIndex}:${itemIndex}`] ?? [];
    const itemAiAssisted = Boolean(analysis?.confidence);
    const aiPhotos = itemAiAssisted ? analysis?.photoIndexes?.map((photoIndex) => areaPhotos[photoIndex]).filter((photo): photo is string => Boolean(photo)) ?? [] : [];
    const matchedPhotos = [...new Set([...aiPhotos, ...manualPhotos])].slice(0, 5);
    const fallbackResult = fallback?.result ?? mockResult(area.name, itemIndex);
    return {
      area: area.name,
      item,
      result: analysis?.result ?? fallbackResult,
      detail: analysis?.reason ?? fallback?.detail ?? mockReason(fallbackResult),
      areaIndex,
      itemIndex,
      photos: matchedPhotos,
      confirmed: analysis?.confirmed,
      confirmedBy: analysis?.confirmedBy,
      confirmedAt: analysis?.confirmedAt,
      rectificationSuggestion: analysis?.rectificationSuggestion,
      rectificationPriority: analysis?.rectificationPriority,
      rectificationDeadline: analysis?.rectificationDeadline,
      rectificationAcceptanceCriteria: analysis?.rectificationAcceptanceCriteria,
      rectificationPhoto: analysis?.rectificationPhoto,
      aiAssisted: itemAiAssisted,
    };
  }));
  const confirmedCount = inspectedResults.filter((item) => item.confirmed).length;
  const passed = inspectedResults.filter((item) => item.confirmed === "PASS");
  const failed = inspectedResults.filter((item) => item.confirmed === "FAIL");
  const unknown = inspectedResults.filter((item) => !item.confirmed);
  const inspectionResult = currentTask?.inspectionResult ?? (failed.length > 0 ? "不合格" : "合格");
  const areaGroups = [...new Map(inspectedResults.map((item) => [item.areaIndex, item.area]))];
  const [aiReport, setAiReport] = useState<AiReport | null>(currentTask?.aiReport ?? null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState("");
  const [reportAttempt, setReportAttempt] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated || !currentTask || currentTask.status !== "已完成") return;
    let cancelled = false;
    if (currentTask.aiReport) {
      setAiReport(currentTask.aiReport);
      setAiReportError("");
      setAiReportLoading(false);
      return () => { cancelled = true; };
    }
    setAiReport(null);
    setAiReportError("");
    setAiReportLoading(true);
    const controller = new AbortController();
    const input = {
      store: taskStore,
      scenario: taskScenario,
      assignee: taskAssignee,
      durationSeconds: getDurationSeconds(currentTask.startedAt, currentTask.completedAt),
      visitedAreas: visitedAreaNames,
      items: inspectedResults.map((item) => {
        const analysis = analyses[`${item.areaIndex}:${item.itemIndex}`];
        return { area: item.area, item: item.item, aiResult: analysis?.confidence ? analysis.result : null, aiReason: analysis?.confidence ? analysis.reason : null, humanResult: item.confirmed ?? null, confidence: analysis?.confidence ?? null, photoCount: item.photos.length };
      }),
    };
    void fetch("/api/results/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as AiReport & { error?: string };
        if (!response.ok) throw new Error(data.error || "AI 结果分析失败。");
        if (!data.summary || !data.efficiency || !data.path || !data.issues || !data.improvements) throw new Error("AI 未返回完整结果分析。");
        if (!cancelled) {
          setAiReport(data);
          saveAiReport(data);
        }
      })
      .catch((error) => {
        if (!cancelled) setAiReportError(error instanceof Error ? error.message : "AI 结果分析失败。");
      })
      .finally(() => {
        if (!cancelled) setAiReportLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
    // This report is generated once when a completed task is opened, or when the user retries it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentTask?.id, reportAttempt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function printReport() {
    window.print();
  }

  function exportCsv() {
    const hasAiAnalysis = inspectedResults.some((item) => item.aiAssisted);
    const headers = ["门店", "场景", "执行人", "执行时间", "区域", "巡检项目", ...(hasAiAnalysis ? ["AI判断", "AI分析"] : ["图片证据", "巡检记录"]), "巡检人最终判定", "判定时间", "整改建议", "整改状态"];
    const rows = inspectedResults.map((item) => {
      const analysis = analyses[`${item.areaIndex}:${item.itemIndex}`];
      return [
        taskStore,
        taskScenario,
        taskAssignee,
        taskExecutionTime ? formatTaskTime(taskExecutionTime) : "",
        item.area,
        item.item,
        item.aiAssisted ? resultLabel(item.result) : "",
        item.detail,
        item.confirmed ? resultLabel(item.confirmed) : "",
        item.confirmedAt ? formatTaskTime(item.confirmedAt) : "",
        item.rectificationSuggestion ?? "",
        analysis?.rectificationStatus ?? (item.confirmed === "FAIL" ? "待整改" : ""),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `爱巡店-巡检报告-${safeFileName(taskStore)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) return <ResultLoadingState />;

  if (currentTask?.status !== "已完成") return <EmptyResults canContinue={Boolean(currentTask && currentTask.status !== "已取消")} completedTasks={completedTasks} onSelectTask={setCurrentTask} status={currentTask ? taskStatus : "未选择任务"} />;

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
    <header>
      <p className="text-sm font-semibold text-teal-700">结果与整改</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-slate-950">本次巡检结果</h1><p className="mt-2 text-sm text-slate-500">{taskStore} · {taskScenario} · 执行人：{taskAssignee}{taskExecutionTime && ` · 计划执行时间：${formatTaskTime(taskExecutionTime)}`}</p><p className="mt-1 text-xs text-slate-400">{currentTask.startedAt ? `实际开始：${formatTaskTime(currentTask.startedAt)}` : "实际开始：暂无记录"}{currentTask.completedAt ? ` · 实际完成：${formatTaskTime(currentTask.completedAt)}` : " · 实际完成：进行中"}</p></div><div className="flex flex-wrap items-center gap-3"><ResultBanner result={inspectionResult} status={taskStatus} /><div className="flex gap-2 print:hidden"><button className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700" onClick={printReport} type="button">打印报告</button><button className="rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-teal-800" onClick={exportCsv} type="button">导出 CSV</button></div></div></div>
    </header>
    {completedTasks.length > 1 && <ResultTaskPicker currentTaskId={currentTask.id} onSelectTask={setCurrentTask} tasks={completedTasks} />}

    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Stat label="巡检项目" value={String(inspectedResults.length)} tone="slate" /><Stat label="巡检人判定合格" value={String(passed.length)} tone="teal" /><Stat label="巡检人判定不合格" value={String(failed.length)} tone="rose" /><Stat label="已判定进度" value={`${confirmedCount} / ${inspectedResults.length}`} tone="amber" /><Stat label="总计花费时间" value={totalDuration} tone="slate" /></section>
    <AIAnalysis aiReport={aiReport} aiReportError={aiReportError} aiReportLoading={aiReportLoading} duration={totalDuration} failed={failed} onRetry={() => setReportAttempt((attempt) => attempt + 1)} path={visitedAreaNames} passedCount={passed.length} total={inspectedResults.length} unknownCount={unknown.length} />

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">项目结果</h2><p className="mt-1 text-sm text-slate-500">巡检过程中已由巡检人逐项判定，以下为最终结果。</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{confirmedCount} / {inspectedResults.length} 已判定</span></div><div className="mt-6 space-y-6">{areaGroups.map(([areaIndex, area]) => <div key={areaIndex}><div className="flex items-center gap-3"><h3 className="font-semibold text-slate-900">{area}</h3><span className="h-px flex-1 bg-slate-100" /></div><div className="mt-3 space-y-3">{inspectedResults.filter((item) => item.areaIndex === areaIndex).map((item) => <ResultItemCard item={item} key={`${item.areaIndex}:${item.itemIndex}`} />)}</div></div>)}</div></section>

    {failed.length > 0 && <section className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/50 p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-rose-700">整改闭环</p><h2 className="mt-1 text-xl font-semibold text-slate-950">已创建 {failed.length} 个整改项目</h2><p className="mt-2 text-sm text-slate-600">不合格项目已进入整改页面，整改建议由 AI 辅助生成。</p></div><Link className="shrink-0 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-800" href="/rectifications">进入整改页面</Link></div></section>}
  </main>;
}

function EmptyResults({ canContinue, completedTasks, onSelectTask, status }: { canContinue: boolean; completedTasks: DemoTask[]; onSelectTask: (task: DemoTask) => void; status: string }) {
  const actionHref = canContinue ? "/tasks/demo" : "/tasks";
  const actionLabel = canContinue ? "继续执行巡检" : "前往任务列表";
  return <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">○</span><h1 className="mt-5 text-2xl font-semibold text-slate-950">暂无可查看的巡检结果</h1><p className="mt-3 text-sm leading-6 text-slate-500">当前任务状态为“{status}”。完成所有区域的逐项巡检人判定后，系统会自动生成本次巡检总结和 AI 分析。</p>{completedTasks.length > 0 ? <ResultTaskPicker currentTaskId={undefined} onSelectTask={onSelectTask} tasks={completedTasks} /> : <Link className="mt-6 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href={actionHref}>{actionLabel}</Link>}</section></main>;
}

function ResultLoadingState() {
  return <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8"><section aria-live="polite" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /><p className="mt-5 text-sm text-slate-500">正在恢复巡检结果...</p></section></main>;
}

function ResultTaskPicker({ currentTaskId, onSelectTask, tasks }: { currentTaskId?: number; onSelectTask: (task: DemoTask) => void; tasks: DemoTask[] }) {
  return <div className="mt-6 space-y-2 text-left"><p className="text-xs font-medium text-slate-500">选择已完成任务</p>{tasks.map((task) => <button className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${currentTaskId === task.id ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-teal-50"}`} key={task.id} onClick={() => onSelectTask(task)} type="button"><span className="min-w-0 truncate">{task.store} · {task.template}</span><span className="ml-3 shrink-0 text-xs text-teal-700">查看结果</span></button>)}</div>;
}

function ResultBanner({ result, status }: { result: "合格" | "不合格"; status: string }) {
  const isPassed = result === "合格";
  return <div className={`rounded-xl border px-4 py-3 ${isPassed ? "border-teal-100 bg-teal-50" : "border-rose-100 bg-rose-50"}`}><p className={`text-xs ${isPassed ? "text-teal-700" : "text-rose-700"}`}>巡检结论</p><p className={`mt-1 text-lg font-semibold ${isPassed ? "text-teal-900" : "text-rose-900"}`}>{result}</p><p className="mt-1 text-xs text-slate-500">任务状态：{status}</p></div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "teal" | "amber" | "rose" }) {
  const colors = { slate: "text-slate-900", teal: "text-teal-700", amber: "text-amber-600", rose: "text-rose-600" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><strong className={`mt-2 block text-2xl ${colors[tone]}`}>{value}</strong></div>;
}

function AIAnalysis({ aiReport, aiReportError, aiReportLoading, duration, failed, onRetry, path, passedCount, total, unknownCount }: { aiReport: AiReport | null; aiReportError: string; aiReportLoading: boolean; duration: string; failed: ResultItem[]; onRetry: () => void; path: string[]; passedCount: number; total: number; unknownCount: number }) {
  const [expanded, setExpanded] = useState(true);
  const message = failed.length > 0 ? `本次共完成 ${total} 个巡检项目，其中 ${failed.length} 个项目被巡检人判定不合格，整体判定为不合格。` : `本次共完成 ${total} 个巡检项目，${passedCount} 个项目被巡检人判定合格，暂未发现需要整改的问题。`;
  const issues = failed.length > 0 ? failed.map((item) => `${item.area} · ${item.item}`).join("、") : unknownCount > 0 ? "仍有项目缺少最终判定。" : "本次未发现需要整改的问题。";
  const improvements = failed.length > 0 ? "优先处理不合格项目，完成整改后上传复核图片，并在下一次巡检中重点复查。" : unknownCount > 0 ? "补充缺失图片证据并完成剩余项目判定，避免结果形成空缺。" : "保持当前巡检标准，保留现场图片和确认记录，持续对比巡检效率。";
  const pathSummary = path.length > 0 ? path.join(" → ") : "暂无实际路径记录。";
  return <section className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-6 sm:p-8"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-sm font-semibold text-teal-700">AI</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-slate-950">AI 巡检分析</h2><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-teal-700">从效率、路径、问题和改进建议总结</span></div><button aria-controls="ai-analysis-content" aria-expanded={expanded} className="rounded-lg border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-white" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "收起分析" : "展开分析"}<span aria-hidden="true" className="ml-1.5">{expanded ? "⌃" : "⌄"}</span></button></div>{expanded && <div id="ai-analysis-content">{aiReportLoading && <p className="mt-3 text-sm text-teal-700">正在生成本次巡检分析…</p>}{aiReportError && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><span>AI 分析暂时不可用，当前展示本地统计结果：{aiReportError}</span><button className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-900" onClick={onRetry} type="button">重新生成分析</button></div>}<p className="mt-3 text-sm leading-6 text-slate-700">{aiReport?.summary ?? message}</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl border border-teal-100 bg-white/70 p-4"><p className="font-medium text-slate-800">巡检效率</p><p className="mt-1 leading-6 text-slate-600">{aiReport?.efficiency ?? `总计花费 ${duration}，已判定 ${passedCount + failed.length} / ${total} 个项目。`}</p></div><div className="rounded-xl border border-teal-100 bg-white/70 p-4"><p className="font-medium text-slate-800">巡检路径</p><p className="mt-1 break-words leading-6 text-slate-600">{aiReport?.path ?? pathSummary}</p></div><div className="rounded-xl border border-teal-100 bg-white/70 p-4"><p className="font-medium text-slate-800">巡检问题</p><p className="mt-1 leading-6 text-slate-600">{aiReport?.issues ?? issues}</p></div><div className="rounded-xl border border-teal-100 bg-white/70 p-4"><p className="font-medium text-slate-800">改进建议</p><p className="mt-1 leading-6 text-slate-600">{aiReport?.improvements ?? improvements}</p></div></div></div>}</div></div></section>;
}

function ResultItemCard({ item }: { item: ResultItem }) {
  return <article className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-medium text-slate-800">{item.item}</h4><p className="mt-2 text-sm leading-6 text-slate-500">{item.aiAssisted ? "AI 辅助分析" : "巡检记录"}：{item.detail}</p><PhotoGallery photos={item.photos} /></div><ResultBadge result={item.confirmed ?? item.result} /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>{item.confirmed ? `巡检人判定：${item.confirmed === "PASS" ? "合格" : "不合格"}` : "尚未由巡检人判定"}</span>{item.confirmedBy && <span>巡检人：{item.confirmedBy}</span>}{item.confirmedAt && <span>判定时间：{formatTaskTime(item.confirmedAt)}</span>}</div></article>;
}

function ResultBadge({ result }: { result: string }) {
  const labels: Record<string, string> = { PASS: "合格", FAIL: "不合格", UNKNOWN: "无法判断" };
  const colors: Record<string, string> = { PASS: "bg-teal-50 text-teal-700", FAIL: "bg-rose-50 text-rose-700", UNKNOWN: "bg-amber-50 text-amber-700" };
  return <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${colors[result] ?? "bg-slate-100 text-slate-600"}`}>{labels[result] ?? result}</span>;
}

function resultLabel(result: string) {
  const labels: Record<string, string> = { PASS: "合格", FAIL: "不合格", UNKNOWN: "无法判断" };
  return labels[result] ?? result;
}

function csvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function getDurationSeconds(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return null;
  const elapsedSeconds = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000);
  return Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : null;
}

function formatDuration(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return "暂无记录";
  const elapsedSeconds = Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000));
  if (!Number.isFinite(elapsedSeconds)) return "暂无记录";
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  return `${hours > 0 ? `${hours}小时 ` : ""}${minutes}分${seconds}秒`;
}

function PhotoGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{photos.map((photo, index) => <Image alt={`现场图片 ${index + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" height={64} key={`${photo}-${index}`} src={photo} unoptimized width={64} />)}</div>;
}

function mockResult(area: string, itemIndex: number): Analysis["result"] {
  if (area === "仓储区" && itemIndex === 0) return "FAIL";
  if (area === "商品陈列区" && itemIndex === 0) return "UNKNOWN";
  return "PASS";
}

function mockReason(result: Analysis["result"]) {
  if (result === "FAIL") return "图片中发现现场存在需要处理的异常。";
  if (result === "UNKNOWN") return "图片清晰度不足，无法确认全部情况。";
  return "图片中未发现明显异常。";
}

function formatTaskTime(value: string) {
  return formatShanghaiTime(value);
}
