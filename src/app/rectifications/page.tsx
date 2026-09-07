"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { RectificationItem, useDemoTask } from "../demo-task-context";
import { formatShanghaiTime } from "../time";
import { ImagePreview } from "../image-preview";

type StatusFilter = "全部" | "待整改" | "整改中" | "已完成";
type PriorityFilter = "全部" | "high" | "medium" | "low";

export default function RectificationsPage() {
  const { currentTask, rectifications, setCurrentTask, tasks } = useDemoTask();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("全部");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("全部");
  const priorityCounts = useMemo(() => rectifications.reduce((counts, item) => {
    const priority = item.priority ?? "medium";
    counts[priority] += 1;
    return counts;
  }, { high: 0, medium: 0, low: 0 } as Record<Exclude<PriorityFilter, "全部">, number>), [rectifications]);
  const filteredItems = useMemo(() => rectifications.filter((item) => {
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [item.store, item.scenario, item.area, item.item, item.assignee].some((value) => value.toLowerCase().includes(keyword));
    const matchesPriority = priorityFilter === "全部" || (item.priority ?? "medium") === priorityFilter;
    return matchesQuery && (statusFilter === "全部" || item.status === statusFilter) && matchesPriority;
  }), [priorityFilter, query, rectifications, statusFilter]);

  function openTask(item: RectificationItem) {
    const task = tasks.find((candidate) => candidate.id === item.taskId);
    if (task) {
      setCurrentTask(task);
    }
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">问题闭环</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">整改项目</h1><p className="mt-3 text-slate-600">集中跟进巡检人判定不合格的项目，整改建议由 AI 辅助生成。</p></div><div className="flex flex-wrap gap-2 text-xs"><PrioritySummary priority="high" count={priorityCounts.high} /><PrioritySummary priority="medium" count={priorityCounts.medium} /><PrioritySummary priority="low" count={priorityCounts.low} /></div></div><div className="mt-8 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">搜索整改项目</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setQuery(event.target.value)} placeholder="搜索门店、区域、项目或执行人" value={query} /></label><label className="sm:w-40"><span className="sr-only">整改状态</span><select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}><option value="全部">全部状态</option><option value="待整改">待整改</option><option value="整改中">整改中</option><option value="已完成">已完成</option></select></label><label className="sm:w-40"><span className="sr-only">整改优先级</span><select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)} value={priorityFilter}><option value="全部">全部优先级</option><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option></select></label></div>{rectifications.length === 0 ? <EmptyState /> : filteredItems.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">没有符合条件的整改项目，请调整搜索词或筛选条件。</div> : <div className="mt-4 space-y-3"><p className="text-xs text-slate-400">显示 {filteredItems.length} / {rectifications.length} 个整改项目</p>{filteredItems.map((item) => <RectificationCard currentTaskId={currentTask?.id} item={item} key={`${item.taskId}-${item.itemKey}`} onOpenTask={openTask} />)}</div>}</main>;
}

function RectificationCard({ currentTaskId, item, onOpenTask }: { currentTaskId?: number; item: RectificationItem; onOpenTask: (item: RectificationItem) => void }) {
  const isCurrentTask = currentTaskId === item.taskId;
  const statusStyle = item.status === "已完成" ? "bg-teal-50 text-teal-700" : item.status === "整改中" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700";
  const priority = item.priority ?? "medium";
  const suggestionText = item.suggestion ?? (item.suggestionStatus === "generating" ? "正在根据巡检项目要求和现场图片生成整改建议…" : item.suggestionError ?? "AI 整改建议暂未生成，请重新执行不合格判定。");
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-rose-700">{item.store} · {item.area}</p><div className="mt-1 flex items-center gap-2"><PriorityIcon priority={priority} /><h2 className="font-semibold text-slate-900">{item.item}</h2></div><p className="mt-1 text-xs text-slate-400">{item.scenario} · 执行人：{item.assignee} · 优先级：{priorityLabel(priority)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${statusStyle}`}>{item.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-rose-50/70 p-4"><p className="text-xs font-medium text-rose-700">现场问题</p><p className="mt-1 text-sm leading-6 text-slate-700">{item.reason}</p></div><div className="rounded-xl bg-teal-50/70 p-4"><p className="text-xs font-medium text-teal-700">AI 整改建议</p><p className="mt-1 text-sm leading-6 text-slate-700">{suggestionText}</p>{!item.suggestion && <p className="mt-2 text-xs text-amber-700">该内容需由 AI 根据巡检项目要求和现场图片生成。</p>}</div></div>{(item.deadline || item.acceptanceCriteria) && <p className="mt-3 text-xs leading-5 text-slate-500">{item.deadline && `完成时限：${item.deadline}`}{item.acceptanceCriteria && ` · 验收：${item.acceptanceCriteria}`}</p>}{isCurrentTask ? <RectificationEditor item={item} /> : <div className="mt-4 flex justify-end"><button className="rounded-lg border border-teal-200 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50" onClick={() => onOpenTask(item)} type="button">切换任务并处理</button></div>}</article>;
}

function priorityLabel(priority: NonNullable<RectificationItem["priority"]>) {
  return priority === "high" ? "高" : priority === "medium" ? "中" : "低";
}

function PriorityIcon({ priority }: { priority?: RectificationItem["priority"] }) {
  const config = priority === "high"
    ? { label: "高优先级", symbol: "⚑", className: "bg-rose-100 text-rose-700" }
    : priority === "medium"
      ? { label: "中优先级", symbol: "⚑", className: "bg-amber-100 text-amber-700" }
      : priority === "low"
        ? { label: "低优先级", symbol: "⚑", className: "bg-teal-100 text-teal-700" }
        : { label: "未设置优先级", symbol: "—", className: "bg-slate-100 text-slate-400" };
  return <span aria-label={config.label} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${config.className}`} title={config.label}>{config.symbol}</span>;
}

function PrioritySummary({ priority, count }: { priority: NonNullable<RectificationItem["priority"]>; count: number }) {
  return <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600"><PriorityIcon priority={priority} /><span>{priorityLabel(priority)} {count}</span></div>;
}

function RectificationEditor({ item }: { item: RectificationItem }) {
  const { setRectification } = useDemoTask();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const status = item.status ?? "待整改";
  const note = item.note;

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const availableCount = 5 - item.photos.length;
    if (availableCount <= 0) {
      setPhotoError("整改后图片最多上传 5 张。 ");
      return;
    }
    const selectedFiles = files.slice(0, availableCount);
    setPhotoUploading(true);
    setPhotoError("");
    setVerificationError("");
    try {
      const selectedPhotos = await Promise.all(selectedFiles.map(async (file) => ({ name: file.name, photo: await fileToDataUrl(file).then(compressImage) })));
      const photos = [...item.photos, ...selectedPhotos.map((selected) => selected.photo)];
      const photoNames = [...item.photoNames, ...selectedPhotos.map((selected) => selected.name)];
      setRectification(item.itemKey, {
        rectificationPhotoNames: photoNames,
        rectificationPhotos: photos,
        rectificationPhotoName: photoNames[0],
        rectificationPhoto: photos[0],
        rectificationVerification: undefined,
      });
      if (files.length > availableCount) setPhotoError("最多保留 5 张整改后图片，超出部分未添加。 ");
    } catch {
      setPhotoError("图片读取失败，请重新选择图片。");
    } finally {
      setPhotoUploading(false);
    }
  }

  function removePhoto(index: number) {
    const photos = item.photos.filter((_, photoIndex) => photoIndex !== index);
    const photoNames = item.photoNames.filter((_, photoIndex) => photoIndex !== index);
    setVerificationError("");
    setRectification(item.itemKey, {
      rectificationPhotoNames: photoNames,
      rectificationPhotos: photos,
      rectificationPhotoName: photoNames[0],
      rectificationPhoto: photos[0],
      rectificationVerification: undefined,
    });
  }

  async function completeRectification() {
    if (!item.photos.length || !note.trim() || photoUploading || verifying) return;
    const originalPhotos = item.originalPhotos;
    const rectificationPhotos = item.photos;
    setVerifying(true);
    setVerificationError("");
    try {
      const aiOriginalPhotos = await Promise.all(originalPhotos.map(preparePhotoForAi));
      const aiRectificationPhotos = await Promise.all(rectificationPhotos.map(preparePhotoForAi));
      const response = await fetch("/api/rectification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.item, reason: item.reason, acceptanceCriteria: item.acceptanceCriteria ?? "巡检项目要求已达到，整改问题不再存在。", originalPhotos: aiOriginalPhotos, rectificationPhotos: aiRectificationPhotos }),
      });
      const data = await response.json() as { result?: "PASS" | "FAIL" | "UNKNOWN"; summary?: string; recommendation?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI 整改复核失败，请稍后重试。");
      if (!["PASS", "FAIL", "UNKNOWN"].includes(data.result ?? "") || !data.summary || !data.recommendation) throw new Error("AI 未返回有效复核结果，请重试。");
      setRectification(item.itemKey, {
        rectificationStatus: "已完成",
        rectificationVerification: { result: data.result as "PASS" | "FAIL" | "UNKNOWN", summary: data.summary, recommendation: data.recommendation, verifiedAt: new Date().toISOString() },
      });
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "AI 整改复核失败，请稍后重试。");
    } finally {
      setVerifying(false);
    }
  }

  return <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">处理整改</p><p className="mt-1 text-xs text-slate-400">提交时由 AI 根据巡检问题、项目要求和整改后图片进行验收</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${status === "已完成" ? "bg-teal-50 text-teal-700" : status === "整改中" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{status}</span></div><EvidenceCompare originalPhotos={item.originalPhotos} rectificationPhotos={item.photos} />{status === "待整改" && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-sm text-amber-800">确认开始后，才能上传整改后的复核图片。</p><button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700" onClick={() => setRectification(item.itemKey, { rectificationStatus: "整改中" })} type="button">开始整改</button></div>}{status === "整改中" && <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4"><textarea className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setRectification(item.itemKey, { rectificationNote: event.target.value })} placeholder="填写本项目整改说明" value={note} /><div className="mt-3 flex flex-wrap items-center gap-3"><label className={`rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 ${photoUploading ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-slate-50"}`}><span>{photoUploading ? "正在读取图片…" : "继续上传整改图片"}</span><input accept="image/*" className="hidden" disabled={photoUploading} multiple onChange={selectPhoto} type="file" /></label><span className="text-xs text-slate-500">已上传 {item.photos.length} / 5 张</span>{photoError && <span className="text-xs text-rose-600">{photoError}</span>}</div>{item.photos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.photos.map((photo, index) => <div className="relative" key={`${photo}-${index}`}><EvidenceThumbnail alt={`整改后复核图片 ${index + 1}`} borderClass="border-teal-100" src={photo} /><button aria-label={`删除整改后图片 ${index + 1}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs text-white shadow-sm hover:bg-slate-950" onClick={() => removePhoto(index)} type="button">×</button></div>)}</div>}<div className="mt-4 flex justify-end"><button className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!note.trim() || item.photos.length === 0 || photoUploading || verifying} onClick={completeRectification} type="button">{verifying ? "AI 验收并提交中…" : "提交整改完成"}</button></div>{verificationError && <p className="mt-3 text-xs text-rose-600">{verificationError}</p>}</div>}{status === "已完成" && <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-800">整改已完成，以下保留整改图片和 AI 验收记录，供后续复核。</div>}{item.verification && <VerificationResult verification={item.verification} />}</div>;
}

function EvidenceCompare({ originalPhotos, rectificationPhotos }: { originalPhotos: string[]; rectificationPhotos: string[] }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-rose-700">巡检现场</p><span className="text-[11px] text-rose-500">{originalPhotos.length} 张</span></div>{originalPhotos.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{originalPhotos.map((photo, index) => <EvidenceThumbnail alt={`巡检现场图片 ${index + 1}`} borderClass="border-rose-100" key={`${photo}-${index}`} src={photo} />)}</div> : <div className="mt-3 flex min-h-20 items-center justify-center rounded-lg border border-dashed border-rose-200 bg-white/70 px-3 text-center text-xs text-rose-500">暂无巡检现场图片，将根据问题描述和整改后图片验收</div>}</div><div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-teal-700">整改后</p><span className="text-[11px] text-teal-500">{rectificationPhotos.length} 张复核图片</span></div>{rectificationPhotos.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{rectificationPhotos.map((photo, index) => <EvidenceThumbnail alt={`整改后复核图片 ${index + 1}`} borderClass="border-teal-100" key={`${photo}-${index}`} src={photo} />)}</div> : <div className="mt-3 flex min-h-20 items-center justify-center rounded-lg border border-dashed border-teal-200 bg-white/70 px-3 text-center text-xs text-teal-600">开始整改后上传复核图片</div>}</div></div>;
}

function EvidenceThumbnail({ alt, borderClass, src }: { alt: string; borderClass: string; src: string }) {
  return <div className={`relative size-20 shrink-0 overflow-hidden rounded-lg border ${borderClass}`}><ImagePreview alt={alt} buttonClassName="block size-full cursor-zoom-in" className="object-cover" fill sizes="80px" src={src} /></div>;
}

function preparePhotoForAi(dataUrl: string) {
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(dataUrl) ? Promise.resolve(dataUrl) : compressImage(dataUrl);
}

function VerificationResult({ verification }: { verification: NonNullable<RectificationItem["verification"]> }) {
  const config = verification.result === "PASS"
    ? { label: "AI 建议通过", className: "border-teal-100 bg-teal-50 text-teal-800" }
    : verification.result === "FAIL"
      ? { label: "AI 建议不通过", className: "border-rose-100 bg-rose-50 text-rose-800" }
      : { label: "AI 无法判断", className: "border-amber-100 bg-amber-50 text-amber-800" };
  return <div className={`mt-4 rounded-xl border p-4 ${config.className}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">AI 整改验收结果</p><p className="mt-1 text-[11px] opacity-70">复核时间：{formatShanghaiTime(verification.verifiedAt)}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium">{config.label}</span></div><p className="mt-3 text-sm leading-6">{verification.summary}</p><p className="mt-2 text-xs leading-5">下一步建议：{verification.recommendation}</p></div>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxSize = 1280;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("无法处理图片"));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", 0.78));
    };
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = dataUrl;
  });
}

function EmptyState() {
  return <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><p className="font-medium text-slate-700">暂无整改项目</p><p className="mt-2 text-sm text-slate-500">当巡检人判定项目不合格并完成巡检后，整改项目会出现在这里。</p><Link className="mt-5 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href="/tasks">查看巡检任务</Link></div>;
}
