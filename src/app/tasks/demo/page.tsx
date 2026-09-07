"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Analysis, useDemoTask } from "../../demo-task-context";
import { AreaSortMode, areaSortModeLabels, defaultInspectionAreas, sortAreaIndexes } from "../../demo-data";
import { formatShanghaiTime } from "../../time";

const maxAreaPhotoCount = 20;
const maxItemPhotoCount = 5;
const maxPhotoSize = 10 * 1024 * 1024;

export default function TaskExecutionPage() {
  const [areaIndex, setAreaIndex] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [sortMode, setSortMode] = useState<AreaSortMode>("default");
  const analysisVersion = useRef(0);
  const rectificationVersion = useRef(0);
  const { hydrated, currentTask, photos, itemPhotos, completedAreas, analyses, areaVisitCounts, storageWarning, setAnalysis, clearAnalysis, completeArea: completeAreaForIndex, reopenArea, addPhotos, removePhoto, addItemPhotos, removeItemPhoto, recordAreaVisit, setCurrentTask } = useDemoTask();
  const areas = currentTask?.areas ?? defaultInspectionAreas;
  const area = areas[areaIndex] ?? areas[0];
  const areaPhotos = photos[areaIndex] ?? [];
  const taskStore = currentTask?.store ?? "示例门店";
  const taskScenario = currentTask?.scenario ?? "关店前巡检";
  const taskAssignee = currentTask?.assignee ?? "张三";
  const taskExecutionTime = currentTask?.executionTime;
  const taskStatus = currentTask?.status ?? "待执行";
  const readOnly = taskStatus === "已完成";
  const routeKey = currentTask?.template ?? "服装门店巡检";
  const orderedAreaIndexes = sortAreaIndexes(areas, sortMode, areaVisitCounts[routeKey]);
  const areaAnalyses = area.items.map((_, itemIndex) => analyses[inspectionItemKey(areaIndex, itemIndex)]);
  const areaAnalysisReady = area.items.length > 0 && areaAnalyses.every((analysis) => Boolean(analysis?.confidence));
  const matchedAreaPhotoIndexes = new Set(areaAnalyses.flatMap((analysis) => analysis?.confidence ? analysis.photoIndexes ?? [] : []));
  const unmatchedAreaPhotoCount = areaAnalysisReady ? areaPhotos.filter((_, index) => !matchedAreaPhotoIndexes.has(index)).length : 0;
  const completedItemCount = areas.reduce((count, itemArea, currentAreaIndex) => count + itemArea.items.filter((_, itemIndex) => analyses[inspectionItemKey(currentAreaIndex, itemIndex)]?.confirmed).length, 0);
  const totalItemCount = areas.reduce((count, itemArea) => count + itemArea.items.length, 0);
  const progress = Math.round((completedAreas.length / areas.length) * 100);
  const allCompleted = completedAreas.length === areas.length;
  const canCompleteArea = areaAnalyses.every((analysis) => Boolean(analysis?.confirmed));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  /* Starting execution is the moment the user opens a pending task. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentTask?.status === "待执行") setCurrentTask(currentTask);
  }, [currentTask, setCurrentTask]);

  useEffect(() => {
    const startedAt = currentTask?.startedAt;
    const completedAt = currentTask?.completedAt;
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => setElapsedSeconds(elapsedSecondsBetween(startedAt, completedAt));
    updateElapsed();
    if (currentTask.status !== "执行中") return;
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [currentTask?.completedAt, currentTask?.startedAt, currentTask?.status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Auto-advance after the current area's final item is confirmed. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!canCompleteArea || completedAreas.includes(areaIndex)) return;
    completeAreaForIndex(areaIndex);
    const nextAreaIndex = orderedAreaIndexes.find((index) => index !== areaIndex && !completedAreas.includes(index));
    if (nextAreaIndex === undefined) return;
    invalidateAnalysis();
    setAreaIndex(nextAreaIndex);
    recordAreaVisit(routeKey, nextAreaIndex);
    setPhotoError("");
  }, [areaIndex, canCompleteArea, completedAreas, completeAreaForIndex, orderedAreaIndexes, recordAreaVisit, routeKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => {
    analysisVersion.current += 1;
  }, []);

  /* Reset view-local state when the selected task changes. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    analysisVersion.current += 1;
    rectificationVersion.current += 1;
    setAnalyzing(false);
    setAreaIndex(0);
    setSortMode("default");
    setPhotoError("");
  }, [currentTask?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function uploadAreaPhotos(event: ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.target.value = "";
    invalidateAnalysis();
    const uploadVersion = analysisVersion.current;
    setPhotoError("");
    const acceptedFiles = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (acceptedFiles.length !== files.length) setPhotoError("仅支持 JPG、PNG 或 WebP 图片。");
    const validFiles = acceptedFiles.filter((file) => file.size <= maxPhotoSize);
    if (validFiles.length !== acceptedFiles.length) setPhotoError("单张图片不能超过 10 MB。");
    const availableCount = maxAreaPhotoCount - areaPhotos.length;
    if (validFiles.length > availableCount) setPhotoError(`每个区域最多上传 ${maxAreaPhotoCount} 张图片。`);
    const filesToUpload = validFiles.slice(0, Math.max(availableCount, 0));
    const uploadedPhotos = (await Promise.all(filesToUpload.map((file) => fileToDataUrl(file).then(compressImage).catch(() => null)))).filter((photo): photo is string => photo !== null);
    if (analysisVersion.current !== uploadVersion) return;
    if (uploadedPhotos.length !== filesToUpload.length) setPhotoError("部分图片读取失败，请重新选择后上传。");
    if (!uploadedPhotos.length) return;
    addPhotos(areaIndex, uploadedPhotos);
    reopenArea(areaIndex);
    area.items.forEach((_, itemIndex) => clearAnalysis(inspectionItemKey(areaIndex, itemIndex)));
  }

  async function uploadItemPhotos(itemIndex: number, event: ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.target.value = "";
    invalidateAnalysis();
    const uploadVersion = analysisVersion.current;
    setPhotoError("");
    const acceptedFiles = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (acceptedFiles.length !== files.length) setPhotoError("仅支持 JPG、PNG 或 WebP 图片。");
    const validFiles = acceptedFiles.filter((file) => file.size <= maxPhotoSize);
    if (validFiles.length !== acceptedFiles.length) setPhotoError("单张图片不能超过 10 MB。");
    const key = inspectionItemKey(areaIndex, itemIndex);
    const currentPhotos = itemPhotos[key] ?? [];
    const availableCount = maxItemPhotoCount - currentPhotos.length;
    if (validFiles.length > availableCount) setPhotoError(`每个巡检项最多上传 ${maxItemPhotoCount} 张图片。`);
    const filesToUpload = validFiles.slice(0, Math.max(availableCount, 0));
    const uploadedPhotos = (await Promise.all(filesToUpload.map((file) => fileToDataUrl(file).then(compressImage).catch(() => null)))).filter((photo): photo is string => photo !== null);
    if (analysisVersion.current !== uploadVersion) return;
    if (uploadedPhotos.length !== filesToUpload.length) setPhotoError("部分图片读取失败，请重新选择后上传。");
    if (!uploadedPhotos.length) return;
    const nextPhotos = [...currentPhotos, ...uploadedPhotos];
    addItemPhotos(key, uploadedPhotos);
    reopenArea(areaIndex);
    setAnalysis(key, { result: "UNKNOWN", reason: "已上传现场图片，请由巡检人直接判断。", photoIndexes: nextPhotos.map((_, index) => index) });
  }

  function deleteAreaPhoto(photoIndex: number) {
    if (readOnly) return;
    invalidateAnalysis();
    removePhoto(areaIndex, photoIndex);
    reopenArea(areaIndex);
    area.items.forEach((_, itemIndex) => clearAnalysis(inspectionItemKey(areaIndex, itemIndex)));
    setPhotoError("");
  }

  function deleteItemPhoto(itemIndex: number, photoIndex: number) {
    if (readOnly) return;
    invalidateAnalysis();
    const key = inspectionItemKey(areaIndex, itemIndex);
    removeItemPhoto(key, photoIndex);
    reopenArea(areaIndex);
    const nextPhotos = (itemPhotos[key] ?? []).filter((_, index) => index !== photoIndex);
    if (nextPhotos.length) setAnalysis(key, { result: "UNKNOWN", reason: "已上传现场图片，请由巡检人直接判断。", photoIndexes: nextPhotos.map((_, index) => index) });
    else clearAnalysis(key);
    setPhotoError("");
  }

  async function analyze() {
    if (readOnly || !areaPhotos.length) return;
    await analyzePhotos(areaIndex, [...areaPhotos]);
  }

  async function analyzePhotos(analyzedAreaIndex: number, analyzedPhotos: string[]) {
    if (readOnly || !analyzedPhotos.length) return;
    const analyzedArea = areas[analyzedAreaIndex];
    if (!analyzedArea) return;
    reopenArea(analyzedAreaIndex);
    analyzedArea.items.forEach((_, itemIndex) => clearAnalysis(inspectionItemKey(analyzedAreaIndex, itemIndex)));
    rectificationVersion.current += 1;
    const version = ++analysisVersion.current;
    setAnalyzing(true);
    setPhotoError("");
    try {
      const response = await fetch("/api/inspection/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: { name: analyzedArea.name }, items: analyzedArea.items.map((text, itemIndex) => ({ item_index: itemIndex, text })), photos: analyzedPhotos.map((image, photoIndex) => ({ photo_index: photoIndex, image })) }) });
      const data = await response.json() as { error?: string; summary?: string; results?: Array<{ item_index: number; photo_indexes: number[]; result: Analysis["result"]; reason: string; confidence: NonNullable<Analysis["confidence"]> }> };
      if (!response.ok) throw new Error(data.error || "AI 图片分析失败，请稍后重试。");
      if (analysisVersion.current !== version) return;
      if (!Array.isArray(data.results) || data.results.length !== analyzedArea.items.length) throw new Error("AI 未返回完整分析结果，请重试。");
      data.results.forEach((item) => setAnalysis(inspectionItemKey(analyzedAreaIndex, item.item_index), { result: item.result, reason: item.reason, photoIndexes: item.photo_indexes, confidence: item.confidence }));
    } catch (error) {
      if (analysisVersion.current === version) setPhotoError(error instanceof Error ? error.message : "AI 图片分析失败，请稍后重试。");
    } finally {
      if (analysisVersion.current === version) setAnalyzing(false);
    }
  }

  function invalidateAnalysis() {
    analysisVersion.current += 1;
    rectificationVersion.current += 1;
    setAnalyzing(false);
  }

  function confirm(itemIndex: number, result: "PASS" | "FAIL") {
    if (readOnly) return;
    const key = inspectionItemKey(areaIndex, itemIndex);
    const evidencePhotos = itemPhotos[key] ?? [];
    const analysis = analyses[key];
    const aiEvidencePhotos = analysis?.photoIndexes?.map((photoIndex) => areaPhotos[photoIndex]).filter((photo): photo is string => Boolean(photo)) ?? [];
    const allEvidencePhotos = [...new Set([...aiEvidencePhotos, ...evidencePhotos])].slice(0, 5);
    const hasEvidence = allEvidencePhotos.length > 0;
    if (!analysis || !hasEvidence) return;
    const requestVersion = ++rectificationVersion.current;
    const confirmation = { ...analysis, confirmed: result, confirmedBy: taskAssignee, confirmedAt: new Date().toISOString(), rectificationSuggestion: result === "FAIL" ? createSuggestion(area.name, area.items[itemIndex], analysis.reason) : undefined };
    setAnalysis(key, confirmation);
    if (result === "FAIL") {
      void fetchRectificationSuggestion({ store: taskStore, scenario: taskScenario, area: area.name, item: area.items[itemIndex], aiReason: analysis.reason, photos: allEvidencePhotos, humanResult: "FAIL" }).then((suggestion) => {
        if (rectificationVersion.current !== requestVersion) return;
        setAnalysis(key, { ...confirmation, rectificationSuggestion: suggestion.suggestion, rectificationPriority: suggestion.priority, rectificationDeadline: suggestion.deadline, rectificationAcceptanceCriteria: suggestion.acceptanceCriteria });
      }).catch(() => {
        // The local suggestion remains available when the store network is slow or unavailable.
      });
    }
  }

  if (!hydrated) {
    return <TaskLoadingState />;
  }

  if (!currentTask) {
    return <EmptyTaskState />;
  }

  if (currentTask?.status === "已取消") {
    return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-slate-500">任务已取消</p><h1 className="mt-3 text-2xl font-semibold text-slate-950">无法继续执行该巡检任务</h1><p className="mt-3 text-sm leading-6 text-slate-500">“{currentTask.store}”的巡检任务已被取消，当前记录已保留。</p><Link className="mt-6 inline-flex rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href="/tasks">返回任务列表</Link></section></main>;
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><div>{storageWarning && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">{storageWarning}</div>}{readOnly && <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">本次巡检已完成，当前页面仅供查看。如需处理整改，请前往“结果”页面。</div>}{allCompleted && <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4"><p className="font-semibold text-teal-900">本次巡检已完成</p><p className="mt-1 text-sm text-teal-700">所有巡检项目均已由巡检人判定，请在页面底部查看结果总结。</p></div>}<p className="text-sm font-semibold text-teal-700">任务执行 · {taskScenario}</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">{currentTask?.template ?? "服装门店巡检"}</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500"><span>{taskStore} · 执行人：{taskAssignee}{taskExecutionTime && ` · 执行时间：${formatTaskTime(taskExecutionTime)}`} · 状态：{taskStatus}</span>{currentTask.startedAt && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${taskStatus === "执行中" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{taskStatus === "执行中" ? "已耗时" : "实际耗时"} {formatElapsedTime(elapsedSeconds)}</span>}</div><p className="mt-2 text-xs text-slate-400">本任务同时支持：区域图片“上传后统一 AI 分析”，以及每个巡检项单独上传图片</p></div><div className="mt-8 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} /></div><span className="shrink-0 text-sm font-medium text-slate-600">{completedAreas.length} / {areas.length} 区域 · {completedItemCount} / {totalItemCount} 项目</span></div><div className="mt-8 grid gap-6 lg:grid-cols-[17rem_1fr]"><aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">巡检区域</p><span className="text-xs text-slate-400">可自由选择</span></div><label className="text-xs font-medium text-slate-500">区域排序<select aria-label="区域排序方式" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-500 focus:bg-white" onChange={(event) => setSortMode(event.target.value as AreaSortMode)} value={sortMode}>{(Object.keys(areaSortModeLabels) as AreaSortMode[]).map((mode) => <option key={mode} value={mode}>{areaSortModeLabels[mode]}</option>)}</select></label><p className="text-xs leading-5 text-slate-400">{sortMode === "frequent" && !Object.values(areaVisitCounts[routeKey] ?? {}).some((count) => count > 0) ? "暂无历史记录，当前使用默认顺序。" : sortMode === "ai" ? "根据区域名称和巡检逻辑生成的 Demo 推荐路径。" : sortMode === "frequent" ? "根据当前模板的历史进入次数排序。" : "按照模板中的默认顺序展示。"}</p></div><ol className="mt-4 space-y-2">{orderedAreaIndexes.map((index, routePosition) => { const item = areas[index]; const done = completedAreas.includes(index); const active = index === areaIndex; return <li key={`${item.name}-${index}`}><button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => { if (index === areaIndex) return; invalidateAnalysis(); setAreaIndex(index); recordAreaVisit(routeKey, index); setPhotoError(""); }} type="button"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-teal-600 text-white" : active ? "bg-white text-teal-700 ring-1 ring-teal-200" : "bg-slate-100 text-slate-400"}`}>{done ? "✓" : routePosition + 1}</span><span className="flex-1">{item.name}</span>{active && <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />}</button></li>; })}</ol></aside><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-400">区域 {areaIndex + 1} / {areas.length}</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">{area.name}</h2></div><span className={`rounded-full px-3 py-1.5 text-xs ${completedAreas.includes(areaIndex) ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{completedAreas.includes(areaIndex) ? "已完成" : "待巡检"}</span></div><div className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">本区域巡检项目</h3><p className="mt-1 text-xs text-slate-400">每个巡检项都需要图片。可上传区域图片后统一 AI 分析，也可在当前项目下单独上传图片。</p></div><span className="text-xs text-slate-400">每个项目最多上传 {maxItemPhotoCount} 张</span></div><div className="mt-3 space-y-3">{area.items.map((item, itemIndex) => <ProjectItem analysis={areaAnalyses[itemIndex]} item={item} itemIndex={itemIndex} itemPhotos={itemPhotos[inspectionItemKey(areaIndex, itemIndex)] ?? []} onConfirm={(result) => confirm(itemIndex, result)} onDeletePhoto={(photoIndex) => deleteItemPhoto(itemIndex, photoIndex)} onUploadPhoto={(event) => uploadItemPhotos(itemIndex, event)} photos={areaPhotos} readOnly={readOnly} key={`${areaIndex}:${itemIndex}`} />)}</div></div><AreaPhotoPanel analyzed={areaAnalysisReady} unmatchedCount={unmatchedAreaPhotoCount} areaName={area.name} analyzing={analyzing} error={photoError} maxCount={maxAreaPhotoCount} onAnalyze={analyze} onDelete={deleteAreaPhoto} onUpload={uploadAreaPhotos} photos={areaPhotos} readOnly={readOnly} /></section></div>{!allCompleted && <p className="mt-4 text-right text-xs text-slate-400">可自由选择区域，不要求按照建议路线执行。</p>}{allCompleted && <div className="mt-6 flex justify-end"><Link className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800" href="/results">查看本次巡检结果</Link></div>}</main>;
}

function EmptyTaskState() {
  return <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-xl text-teal-700">✓</span><h1 className="mt-5 text-2xl font-semibold text-slate-950">请先选择巡检任务</h1><p className="mt-3 text-sm leading-6 text-slate-500">巡检执行需要关联门店、模板和执行人。请先从任务列表进入一条待执行或执行中的任务。</p><Link className="mt-6 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href="/tasks">前往任务列表</Link></section></main>;
}

function TaskLoadingState() {
  return <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8"><section aria-live="polite" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /><p className="mt-5 text-sm text-slate-500">正在恢复巡检任务...</p></section></main>;
}

function AreaPhotoPanel({ analyzed, areaName, analyzing, error, maxCount, onAnalyze, onDelete, onUpload, photos, readOnly, unmatchedCount }: { analyzed: boolean; areaName: string; analyzing: boolean; error: string; maxCount: number; onAnalyze: () => void; onDelete: (photoIndex: number) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; photos: string[]; readOnly: boolean; unmatchedCount: number }) {
  return <div aria-busy={analyzing} className="mt-8 border-t border-slate-100 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">本区域现场图片</h3><p className="mt-1 text-xs text-slate-400">先上传本区域的多张图片，再点击“开始 AI 分析”统一关联巡检项目。无关图片不会强行分配。</p></div><div className="flex items-center gap-2"><label className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${photos.length >= maxCount || analyzing || readOnly ? "cursor-not-allowed border-slate-200 text-slate-400" : "cursor-pointer border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"}`}><span>＋ 上传图片</span><input accept="image/jpeg,image/png,image/webp" className="hidden" disabled={photos.length >= maxCount || analyzing || readOnly} multiple onChange={onUpload} type="file" /></label><button className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!photos.length || analyzing || readOnly} onClick={onAnalyze} type="button">{analyzing ? "AI 分析中…" : analyzed ? "重新 AI 分析" : "开始 AI 分析"}</button></div></div>{analyzing && <p className="mt-3 text-xs text-teal-700">图片已保存，正在分析图片对应的巡检项目，请稍候。</p>}{error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}<p className="mt-3 text-xs text-slate-400">支持 JPG、PNG、WebP，单张不超过 10 MB；当前区域 {photos.length}/{maxCount} 张。{analyzed && ` 已完成 AI 分析，${unmatchedCount} 张图片未关联到巡检项目。`}</p>{photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{photos.map((photo, index) => <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100" key={`${photo}-${index}`}><Image alt={`${areaName}现场图片 ${index + 1}`} className="h-full w-full object-cover" height={320} src={photo} unoptimized width={320} /><button aria-label={`删除第 ${index + 1} 张现场图片`} className="absolute right-2 top-2 rounded-md bg-slate-950/70 px-2 py-1 text-xs text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={analyzing || readOnly} onClick={() => onDelete(index)} type="button">删除</button></div>)}</div>}</div>;
}

function ProjectItem({ analysis, item, itemIndex, itemPhotos, onConfirm, onDeletePhoto, onUploadPhoto, photos, readOnly }: { analysis?: Analysis; item: string; itemIndex: number; itemPhotos: string[]; onConfirm: (result: "PASS" | "FAIL") => void; onDeletePhoto: (photoIndex: number) => void; onUploadPhoto: (event: ChangeEvent<HTMLInputElement>) => void; photos: string[]; readOnly: boolean }) {
  const displayResult = analysis?.confirmed ?? analysis?.result;
  const labels = { PASS: "建议合格", FAIL: "建议不合格", UNKNOWN: "无法判断" };
  const colors = { PASS: "bg-teal-50 text-teal-700", FAIL: "bg-rose-50 text-rose-700", UNKNOWN: "bg-amber-50 text-amber-700" };
  const matchedPhotos = analysis?.photoIndexes?.map((index) => photos[index]).filter((photo): photo is string => Boolean(photo)) ?? [];
  const hasEvidence = itemPhotos.length > 0 || matchedPhotos.length > 0;
  const displayLabel = analysis?.confirmed ? `已判定${analysis.confirmed === "PASS" ? "合格" : "不合格"}` : analysis ? labels[analysis.result] : "待上传图片";

  return <div className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-start gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-500" /><p className="text-sm text-slate-700">{item}</p></div>{analysis && <p className="mt-2 text-xs leading-5 text-slate-500">{analysis.confidence ? `AI 辅助 · ${confidenceLabel(analysis.confidence)}` : "巡检记录"}：{analysis.reason}</p>}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${displayResult ? colors[displayResult] : "bg-slate-100 text-slate-500"}`}>{displayLabel}</span></div><div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-400">本项目手动图片 · {itemPhotos.length}/{maxItemPhotoCount} 张</p><p className="mt-1 text-[11px] text-slate-400">此处上传的图片仅作为人工取证，不调用 AI</p></div><label className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium ${itemPhotos.length >= maxItemPhotoCount || readOnly ? "cursor-not-allowed border-slate-200 text-slate-400" : "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"}`}><span>＋ 上传图片</span><input accept="image/jpeg,image/png,image/webp" className="hidden" disabled={itemPhotos.length >= maxItemPhotoCount || readOnly} multiple onChange={onUploadPhoto} type="file" /></label></div>{itemPhotos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{itemPhotos.map((photo, index) => <div className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200" key={`${photo}-${index}`}><Image alt={`${item}现场图片 ${index + 1}`} className="h-full w-full object-cover" height={64} src={photo} unoptimized width={64} /><button aria-label={`删除${item}第 ${index + 1} 张图片`} className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-50" disabled={readOnly} onClick={() => onDeletePhoto(index)} type="button">删除</button></div>)}</div>}</div>{analysis?.confidence && <div className="mt-3">{matchedPhotos.length > 0 ? <><p className="text-xs text-slate-400">AI 关联图片 · {matchedPhotos.length} 张</p><div className="mt-2 flex flex-wrap gap-2">{matchedPhotos.map((photo, index) => <Image alt={`${item}关联图片 ${index + 1}（巡检项 ${itemIndex + 1}）`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" height={64} key={`${photo}-${index}`} src={photo} unoptimized width={64} />)}</div></> : <p className="text-xs leading-5 text-amber-700">AI 未关联到支持本巡检项的图片，请补充本区域图片后重新分析。</p>}</div>}{analysis?.confirmed ? <p className="mt-3 text-xs text-slate-400">已由{analysis.confirmedBy ?? "巡检人"}判定{analysis.confirmedAt ? ` · ${formatTaskTime(analysis.confirmedAt)}` : ""}</p> : analysis && !readOnly && hasEvidence ? <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50" onClick={() => onConfirm("PASS")} type="button">判定合格</button><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => onConfirm("FAIL")} type="button">判定不合格</button></div> : <p className="mt-3 text-xs text-slate-500">{readOnly ? "本次巡检已完成，结果仅供查看。" : analysis && !hasEvidence ? "没有图片证据，暂不能判定。" : "请先上传图片。"}</p>}</div>;
}
function inspectionItemKey(areaIndex: number, itemIndex: number) {
  return `${areaIndex}:${itemIndex}`;
}

function confidenceLabel(confidence: NonNullable<Analysis["confidence"]>) {
  return { high: "高置信度", medium: "中置信度", low: "低置信度" }[confidence];
}

function createSuggestion(area: string, item: string, reason: string) {
  return `请立即处理“${area} · ${item}”问题：${reason}完成整改后清理现场，并上传复核图片。`;
}

type RectificationSuggestion = {
  suggestion: string;
  priority: "high" | "medium" | "low";
  deadline: string;
  acceptanceCriteria: string;
};

async function fetchRectificationSuggestion(input: { store: string; scenario: string; area: string; item: string; aiReason: string; photos: string[]; humanResult: "FAIL" }): Promise<RectificationSuggestion> {
  const response = await fetch("/api/rectification/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json() as Partial<RectificationSuggestion> & { error?: string };
  if (!response.ok) throw new Error(data.error || "AI 整改建议生成失败。");
  if (typeof data.suggestion !== "string" || !["high", "medium", "low"].includes(data.priority ?? "") || typeof data.deadline !== "string" || typeof data.acceptanceCriteria !== "string") throw new Error("AI 未返回有效整改建议。");
  return { suggestion: data.suggestion, priority: data.priority as RectificationSuggestion["priority"], deadline: data.deadline, acceptanceCriteria: data.acceptanceCriteria };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl: string) {
  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", 0.78));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function formatTaskTime(value: string) {
  return formatShanghaiTime(value);
}

function elapsedSecondsBetween(startAt: string, endAt?: string) {
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

function formatElapsedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours > 0 ? `${hours}小时 ` : ""}${minutes}分${String(remainingSeconds).padStart(2, "0")}秒`;
}
