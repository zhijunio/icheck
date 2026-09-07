"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import Link from "next/link";
import { DemoTemplate, InspectionArea } from "../demo-data";
import { useDemoTask } from "../demo-task-context";

type Category = { name: string; items: string[] };
type InputMode = "describe" | "manuscript" | "edit";
type TemplateReview = {
  overall: "good" | "needs_revision";
  summary: string;
  issues: Array<{ type: string; severity: "high" | "medium" | "low"; category: string; item: string; message: string; suggestion: string }>;
};

const maxManuscriptSize = 10 * 1024 * 1024;

const promptExamples = [
  { title: "便利店开店前", prompt: "生成一份便利店开店前巡检模板，只设置 2 个区域、共 4 个巡检项目：入口及前场、商品陈列区，重点检查卫生、陈列和通道。" },
  { title: "服装店营业中", prompt: "生成一份服装店营业中巡检模板，只设置 2 个区域、共 4 个巡检项目：门店入口、卖场区域，重点检查陈列、卫生和顾客通道。" },
];

export default function TemplateEditor({ editingTemplate, onCancelEdit }: { editingTemplate: DemoTemplate | null; onCancelEdit: () => void }) {
  const [request, setRequest] = useState("");
  const [templateName, setTemplateName] = useState(editingTemplate?.name ?? "");
  const [templateScenario, setTemplateScenario] = useState(editingTemplate?.scenario ?? "");
  const [categories, setCategories] = useState<Category[]>(editingTemplate ? cloneCategories(editingTemplate.categories) : []);
  const [saved, setSaved] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(editingTemplate?.id ?? null);
  const [manuscriptName, setManuscriptName] = useState("");
  const [manuscriptPreview, setManuscriptPreview] = useState("");
  const [manuscriptError, setManuscriptError] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [review, setReview] = useState<TemplateReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>(editingTemplate ? "edit" : "describe");
  const [dirty, setDirty] = useState(false);
  const generationVersion = useRef(0);
  const { addTemplate, updateTemplate } = useDemoTask();

  async function generate() {
    const prompt = request.trim();
    if (!prompt || generating) return;
    const version = ++generationVersion.current;
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await fetch("/api/template/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: prompt }) });
      const data = await response.json() as { error?: string; name?: string; scenario?: string; categories?: Category[] };
      if (!response.ok) throw new Error(data.error || "AI 模板生成失败，请稍后重试。");
      if (generationVersion.current !== version) return;
      if (!data.name || !data.scenario || !Array.isArray(data.categories) || data.categories.length === 0) throw new Error("AI 未返回有效模板，请重试。");
      setCategories(data.categories.map((category) => ({ name: category.name, items: [...category.items] })));
      setTemplateName(data.name);
      setTemplateScenario(data.scenario);
      setSaved(false);
      setSavedTemplateId(null);
      setDirty(true);
      clearReview();
    } catch (error) {
      if (generationVersion.current === version) setGenerationError(error instanceof Error ? error.message : "AI 模板生成失败，请稍后重试。");
    } finally {
      if (generationVersion.current === version) setGenerating(false);
    }
  }

  function uploadManuscript(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setManuscriptError("");
    setGenerationError("");
    if (!file.type.startsWith("image/")) {
      setManuscriptError("请上传图片格式的巡检模板手稿。");
      return;
    }
    if (file.size > maxManuscriptSize) {
      setManuscriptError("手稿图片不能超过 10 MB。");
      return;
    }
    fileToDataUrl(file).then(compressImage).then((preview) => {
      setManuscriptName(file.name);
      setManuscriptPreview(preview);
      setSaved(false);
      setSavedTemplateId(null);
      setDirty(false);
    }).catch(() => setManuscriptError("手稿图片读取失败，请重新上传。"));
  }

  async function generateFromManuscript() {
    if (!manuscriptPreview || recognizing) return;
    const version = ++generationVersion.current;
    setRecognizing(true);
    setGenerationError("");
    setManuscriptError("");
    try {
      const response = await fetch("/api/template/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: "请识别图片中的巡检模板手稿，提取模板名称、巡检场景、一级分类和巡检项目。保持原意，整理为可执行的门店巡检模板。", image: manuscriptPreview }) });
      const data = await response.json() as { error?: string; name?: string; scenario?: string; categories?: Category[] };
      if (!response.ok) throw new Error(data.error || "AI 手稿识别失败，请稍后重试。");
      if (generationVersion.current !== version) return;
      if (!data.name || !data.scenario || !Array.isArray(data.categories) || data.categories.length === 0) throw new Error("AI 未返回有效模板，请重试。");
      setCategories(data.categories.map((category) => ({ name: category.name, items: [...category.items] })));
      setRequest("根据巡检模板手稿生成模板");
      setTemplateName(data.name);
      setTemplateScenario(data.scenario);
      setSaved(false);
      setSavedTemplateId(null);
      setDirty(true);
      clearReview();
    } catch (error) {
      if (generationVersion.current === version) setManuscriptError(error instanceof Error ? error.message : "AI 手稿识别失败，请稍后重试。");
    } finally {
      if (generationVersion.current === version) setRecognizing(false);
    }
  }

  function saveTemplate() {
    const name = templateName.trim();
    const normalizedCategories = categories.map((category) => ({ name: category.name.trim(), items: category.items.map((item) => item.trim()).filter(Boolean) })).filter((category) => category.name && category.items.length);
    if (!name || !normalizedCategories.length || saved) return;
    const scenario = templateScenario.trim() || (/开店/.test(request) ? "开店前巡检" : /营业/.test(request) ? "营业中巡检" : /关店/.test(request) ? "关店前巡检" : "通用门店巡检");
    const id = editingTemplate?.id ?? `custom-${Date.now()}`;
    const template = { id, name, scenario, categories: normalizedCategories };
    if (editingTemplate) updateTemplate(template);
    else addTemplate(template);
    setSavedTemplateId(id);
    setSaved(true);
    setDirty(false);
  }

  function updateCategory(index: number, name: string) {
    setCategories((current) => current.map((category, i) => i === index ? { ...category, name } : category));
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function updateItem(categoryIndex: number, itemIndex: number, value: string) {
    setCategories((current) => current.map((category, i) => i === categoryIndex ? { ...category, items: category.items.map((item, j) => j === itemIndex ? value : item) } : category));
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function removeItem(categoryIndex: number, itemIndex: number) {
    setCategories((current) => current.map((category, i) => i === categoryIndex ? { ...category, items: category.items.filter((_, j) => j !== itemIndex) } : category));
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function addCategory() {
    setCategories((current) => [...current, { name: "新区域", items: ["新巡检项目"] }]);
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function removeCategory(categoryIndex: number) {
    if (!window.confirm(`确定删除“${categories[categoryIndex]?.name || "此区域"}”吗？`)) return;
    setCategories((current) => current.filter((_, index) => index !== categoryIndex));
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function addItem(categoryIndex: number) {
    setCategories((current) => current.map((category, i) => i === categoryIndex ? { ...category, items: [...category.items, "新巡检项目"] } : category));
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function moveCategory(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= categories.length) return;
    setCategories((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
    setDirty(true);
    clearReview();
  }

  function clearResult() {
    setRequest("");
    setTemplateName("");
    setTemplateScenario("");
    setCategories([]);
    setSaved(false);
    setSavedTemplateId(null);
    setDirty(false);
    setManuscriptName("");
    setManuscriptPreview("");
    setManuscriptError("");
    setGenerationError("");
    generationVersion.current += 1;
    clearReview();
  }

  function clearReview() {
    setReview(null);
    setReviewError("");
  }

  async function reviewTemplate() {
    if (!hasValidTemplate || reviewing) return;
    setReviewing(true);
    setReviewError("");
    try {
      const scenario = templateScenario.trim() || (/开店/.test(request) ? "开店前巡检" : /关店/.test(request) ? "关店前巡检" : "通用门店巡检");
      const payload = { name: templateName.trim(), scenario, categories: categories.map((category) => ({ name: category.name.trim(), items: category.items.map((item) => item.trim()).filter(Boolean) })).filter((category) => category.name && category.items.length) };
      const response = await fetch("/api/template/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as TemplateReview & { error?: string };
      if (!response.ok) throw new Error(data.error || "AI 模板质量检查失败，请稍后重试。");
      if ((data.overall !== "good" && data.overall !== "needs_revision") || !data.summary || !Array.isArray(data.issues)) throw new Error("AI 未返回完整模板检查结果。");
      setReview(data);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "AI 模板质量检查失败，请稍后重试。");
    } finally {
      setReviewing(false);
    }
  }

  function cancelEdit() {
    if (dirty && !window.confirm("当前内容还没有保存，确定离开吗？")) return;
    if (editingTemplate) onCancelEdit();
    else clearResult();
  }

  const itemCount = categories.reduce((count, category) => count + category.items.length, 0);
  const hasValidTemplate = Boolean(templateName.trim() && categories.some((category) => category.name.trim() && category.items.some((item) => item.trim())));

  return (
    <>
      <section className="relative mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_-24px_rgba(15,118,110,0.35)] sm:p-8" id="template-editor">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-50 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">AI Template Builder</p><h2 className="mt-2 text-xl font-semibold text-slate-950">{editingTemplate ? "编辑巡检模板" : "创建巡检模板"}</h2></div><span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500 sm:inline-block">先生成，再校对保存</span></div>
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-100 pb-3" role="tablist" aria-label="模板生成方式"><button aria-selected={inputMode === "describe"} className={inputMode === "describe" ? "rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white" : "rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"} onClick={() => setInputMode("describe")} role="tab" type="button">文字描述生成</button><button aria-selected={inputMode === "manuscript"} className={inputMode === "manuscript" ? "rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white" : "rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"} onClick={() => setInputMode("manuscript")} role="tab" type="button">上传手稿生成</button>{editingTemplate && <button aria-selected={inputMode === "edit"} className={inputMode === "edit" ? "rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white" : "rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"} onClick={() => setInputMode("edit")} role="tab" type="button">直接编辑</button>}</div>
          {inputMode === "describe" && <div><textarea className="mt-6 min-h-44 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50" id="request" value={request} onChange={(event) => { generationVersion.current += 1; setRequest(event.target.value); setGenerationError(""); setSaved(false); }} placeholder="例如：生成一份商场服装店营业中巡检模板，区域包括入口、卖场、试衣间、收银区和仓库，重点检查卫生、陈列、消防和服务。" /><div className="mt-4"><p className="text-xs font-medium text-slate-500">试试这些示例</p><div className="mt-2 flex flex-wrap gap-2">{promptExamples.map((example) => <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800" key={example.title} onClick={() => { generationVersion.current += 1; setRequest(example.prompt); setGenerationError(""); setSaved(false); setSavedTemplateId(null); }} type="button">{example.title}</button>)}</div></div><div className="mt-4 flex flex-wrap items-center gap-3"><button aria-busy={generating} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-medium text-white shadow-sm shadow-teal-700/20 transition hover:-translate-y-0.5 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!request.trim() || generating} onClick={generate} type="button"><span className="text-base">{generating ? "…" : "✦"}</span> {generating ? "AI 生成中…" : editingTemplate ? "按描述重新生成" : "一键生成巡检模板"}</button><span className="text-xs text-slate-400">支持门店类型、场景、区域和巡检重点</span></div>{generationError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{generationError}</p>}</div>}
          {inputMode === "manuscript" && <div className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">上传巡检模板手稿</p><p className="mt-1 text-xs text-slate-400">AI 将识别手稿中的分类和巡检项目，生成后可继续编辑校对。</p></div><label className="inline-flex cursor-pointer items-center rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"><span>上传手稿图片</span><input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadManuscript} type="file" /></label></div>{manuscriptPreview && <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><Image alt="巡检模板手稿预览" className="h-24 w-24 rounded-lg object-cover" height={96} src={manuscriptPreview} unoptimized width={96} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{manuscriptName}</p><p className="mt-1 text-xs text-slate-400">图片已上传，点击识别生成可编辑模板。</p></div><button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={recognizing} onClick={generateFromManuscript} type="button">{recognizing ? "识别中…" : "识别并生成模板"}</button></div>}{manuscriptError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{manuscriptError}</p>}<p className="mt-3 text-xs text-slate-400">支持 JPG、PNG、WebP，单张不超过 10 MB。图片会发送至服务端 AI Router 进行识别。</p></div>}
          {inputMode === "edit" && <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">当前模板已载入下方编辑区。你可以直接修改模板名称、区域和巡检项目。</p>}
        </div>
      </section>

      {categories.length > 0 && <label className="mt-6 block text-sm font-medium text-slate-700">巡检场景<input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" value={templateScenario} onChange={(event) => { setTemplateScenario(event.target.value); setSaved(false); setDirty(true); clearReview(); }} placeholder="例如：营业中巡检" /></label>}

      {categories.length > 0 && <section className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">模板质量检查</p><p className="mt-1 text-xs text-slate-500">AI 会检查重复、模糊、无法通过图片判断和明显无关的巡检项目。检查结果仅供修改参考。</p></div><button className="rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={reviewing || !hasValidTemplate} onClick={reviewTemplate} type="button">{reviewing ? "AI 检查中…" : "AI 检查模板"}</button></div>{reviewError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{reviewError}</p>}{review && <TemplateReviewPanel review={review} />}</section>}

      {categories.length === 0 ? <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center sm:px-8"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-xl text-teal-700">✦</div><h2 className="mt-4 font-semibold text-slate-900">生成结果将在这里展示</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">输入一段巡检需求，AI 会按门店区域整理出可直接编辑的巡检项目。</p></section> : <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold text-slate-950">{editingTemplate ? "编辑模板" : "生成结果"}</h2><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">{editingTemplate ? "已保存模板" : "AI 生成结果"}</span>{dirty && <span className="text-xs font-medium text-amber-700">未保存修改</span>}</div><p className="mt-2 text-sm text-slate-500">按巡检路线排列 · {categories.length} 个区域 · {itemCount} 个巡检项目</p></div><div className="hidden gap-2 sm:flex"><button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700" onClick={cancelEdit} type="button">{editingTemplate ? "取消编辑" : "清空结果"}</button><button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={saved || !hasValidTemplate} onClick={saveTemplate} type="button">{saved ? "✓ 模板已保存" : editingTemplate ? "保存修改" : "保存模板"}</button></div></div><label className="mb-4 block text-sm font-medium text-slate-700">模板名称<input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" value={templateName} onChange={(event) => { setTemplateName(event.target.value); setSaved(false); setDirty(true); }} /></label><div className="mb-4 space-y-3">{categories.map((category, categoryIndex) => <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-[0_12px_35px_-24px_rgba(15,118,110,0.65)] sm:p-6" key={`category-${categoryIndex}`}><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">{String(categoryIndex + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><input className="w-full border-b border-transparent bg-transparent pb-1 text-lg font-semibold text-slate-900 outline-none transition focus:border-teal-500" value={category.name} onChange={(event) => updateCategory(categoryIndex, event.target.value)} /><p className="mt-1 text-xs text-slate-400">区域 {categoryIndex + 1} · {category.items.length} 个项目</p></div><div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100"><button className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:invisible" disabled={categoryIndex === 0} onClick={() => moveCategory(categoryIndex, -1)} type="button">↑</button><button className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:invisible" disabled={categoryIndex === categories.length - 1} onClick={() => moveCategory(categoryIndex, 1)} type="button">↓</button></div></div><div className="mt-4 space-y-2 border-l-2 border-slate-100 pl-11">{category.items.map((item, itemIndex) => <div className="flex items-center gap-2" key={`item-${categoryIndex}-${itemIndex}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" /><input className="min-w-0 flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:bg-white" value={item} onChange={(event) => updateItem(categoryIndex, itemIndex, event.target.value)} /><button className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" onClick={() => removeItem(categoryIndex, itemIndex)} type="button" aria-label={`删除${item}`}>删除</button></div>)}</div><button className="mt-4 ml-11 text-sm font-medium text-teal-700 transition hover:text-teal-900" onClick={() => addItem(categoryIndex)} type="button">+ 添加巡检项目</button><button className="mt-2 ml-11 text-sm font-medium text-rose-600 transition hover:text-rose-700" onClick={() => removeCategory(categoryIndex)} type="button">删除此区域</button></article>)}</div><button className="rounded-lg border border-teal-200 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50" onClick={addCategory} type="button">+ 添加巡检区域</button><div className="sticky bottom-4 z-10 mt-5 flex gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:hidden"><button className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={cancelEdit} type="button">{editingTemplate ? "取消编辑" : "清空结果"}</button><button className="flex-1 rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={saved || !hasValidTemplate} onClick={saveTemplate} type="button">{saved ? "已保存" : editingTemplate ? "保存修改" : "保存模板"}</button></div></section>}
      {saved && <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4"><div><p className="font-semibold text-teal-900">{editingTemplate ? "模板修改已保存" : "模板已保存"}，可以创建任务</p><p className="mt-1 text-sm text-teal-700">{editingTemplate ? "修改已同步到模板列表，创建任务时可直接选择。" : "当前模板已加入模板列表，创建任务时可直接选择。"}</p></div><Link className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href={savedTemplateId ? `/tasks?template=${savedTemplateId}` : "/tasks"}>创建巡检任务</Link></div>}
    </>
  );
}

function cloneCategories(categories: InspectionArea[]): Category[] {
  return categories.map((category) => ({ ...category, items: [...category.items] }));
}

function TemplateReviewPanel({ review }: { review: TemplateReview }) {
  return <div className={`mt-4 rounded-xl border p-4 ${review.overall === "good" ? "border-teal-100 bg-white/70" : "border-amber-100 bg-white/70"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">AI 模板检查结果</p><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${review.overall === "good" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>{review.overall === "good" ? "质量良好" : `建议调整 ${review.issues.length} 项`}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{review.summary}</p>{review.issues.length > 0 && <div className="mt-3 space-y-2">{review.issues.map((issue, index) => <div className="rounded-lg border border-slate-100 bg-white p-3" key={`${issue.type}-${issue.category}-${issue.item}-${index}`}><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[11px] font-medium ${issue.severity === "high" ? "bg-rose-100 text-rose-700" : issue.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{issue.severity === "high" ? "高" : issue.severity === "medium" ? "中" : "低"}</span><span className="text-xs text-slate-500">{[issue.category, issue.item].filter(Boolean).join(" · ") || "模板结构"}</span></div><p className="mt-2 text-sm text-slate-700">{issue.message}</p><p className="mt-1 text-xs leading-5 text-slate-500">建议：{issue.suggestion}</p></div>)}</div>}</div>;
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
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}
