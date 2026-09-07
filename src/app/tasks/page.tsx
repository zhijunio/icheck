"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { DemoTask, useDemoTask } from "../demo-task-context";
import { DemoTemplate } from "../demo-data";
import { formatShanghaiTime, toShanghaiInputValue, toShanghaiIso } from "../time";

const scenarios = ["开店前巡检", "营业中巡检", "关店前巡检", "交接班巡检", "专项安全巡检", "临时异常巡检"];

export default function TasksPage() {
  return <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><p className="text-sm text-slate-500">正在加载任务...</p></main>}><TasksPageContent /></Suspense>;
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTemplateId = searchParams.get("template");
  const { tasks, templates, addTask, cancelTask, setCurrentTask, loadDemoCase } = useDemoTask();
  const [templateId, setTemplateId] = useState(searchParams.get("template") ?? templates[0]?.id ?? "");
  const [store, setStore] = useState("示例门店");
  const [scenario, setScenario] = useState("关店前巡检");
  const [assignee, setAssignee] = useState("张三");
  const [executionTime, setExecutionTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("全部");

  /* Keep the task dialog aligned with a template selected from another page. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!executionTime) {
      setExecutionTime(toShanghaiInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    }
    if (requestedTemplateId && templates.some((template) => template.id === requestedTemplateId)) {
      setTemplateId(requestedTemplateId);
      const requestedTemplate = templates.find((template) => template.id === requestedTemplateId);
      if (requestedTemplate) setScenario(scenarioForTemplate(requestedTemplate));
      setIsOpen(true);
    } else {
      setTemplateId((currentTemplateId) => templates.some((template) => template.id === currentTemplateId) ? currentTemplateId : templates[0]?.id ?? "");
    }
  }, [executionTime, requestedTemplateId, templates]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0];
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [task.store, task.template, task.scenario, task.assignee].some((value) => value.toLowerCase().includes(keyword));
    const matchesStatus = statusFilter === "全部" || task.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [query, statusFilter, tasks]);

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedStore = store.trim();
    if (!trimmedStore || !executionTime || !selectedTemplate) return;
    addTask({
      id: Date.now(),
      template: selectedTemplate.name,
      store: trimmedStore,
      scenario,
      assignee,
      executionTime: toShanghaiIso(executionTime),
      status: "待执行",
      areas: selectedTemplate.categories.map((category) => ({ ...category, items: [...category.items] })),
    });
    setIsOpen(false);
  }

  function changeTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const nextTemplate = templates.find((template) => template.id === nextTemplateId);
    if (nextTemplate) setScenario(scenarioForTemplate(nextTemplate));
  }

  function openTask(task: DemoTask) {
    setCurrentTask(task);
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">任务中心</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">巡检任务</h1><p className="mt-3 text-slate-600">创建任务并分配给执行用户，开始一次具体的门店巡检。</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100" onClick={() => { loadDemoCase(); router.push("/results"); }} type="button">加载演示案例</button><button className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" onClick={() => setIsOpen(true)} type="button">＋ 创建巡检任务</button></div></div>
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">任务列表</h2><p className="mt-1 text-sm text-slate-500">当前浏览器会话中创建的巡检任务</p></div><span className="text-sm text-slate-400">显示 {filteredTasks.length} / {tasks.length} 个</span></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">搜索任务</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setQuery(event.target.value)} placeholder="搜索门店、模板、场景或执行人" value={query} /></label><label className="sm:w-40"><span className="sr-only">任务状态</span><select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" onChange={(event) => setStatusFilter(event.target.value as TaskStatusFilter)} value={statusFilter}><option>全部</option><option>待执行</option><option>执行中</option><option>已完成</option><option>已取消</option></select></label></div>{tasks.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">还没有任务，点击右上角创建第一条任务。</div> : filteredTasks.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">没有符合条件的任务，请调整搜索词或状态筛选。</div> : <div className="mt-4 space-y-3">{filteredTasks.map((task) => <TaskCard key={task.id} task={task} onCancel={() => { if (window.confirm(`确定取消“${task.store}”的巡检任务吗？`)) cancelTask(task.id); }} onOpen={() => openTask(task)} />)}</div>}</section>
    {isOpen && <CreateTaskDialog assignee={assignee} executionTime={executionTime} onAssigneeChange={setAssignee} onClose={() => setIsOpen(false)} onExecutionTimeChange={setExecutionTime} onScenarioChange={setScenario} onStoreChange={setStore} onSubmit={createTask} onTemplateChange={changeTemplate} scenario={scenario} store={store} templateId={templateId} templates={templates} />}
  </main>;
}

function TaskCard({ task, onCancel, onOpen }: { task: DemoTask; onCancel: () => void; onOpen: () => void }) {
  const completed = task.status === "已完成";
  const cancelled = task.status === "已取消";
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{task.store}</h3><span className={`rounded-full px-2.5 py-1 text-xs ${completed ? "bg-teal-50 text-teal-700" : cancelled ? "bg-slate-100 text-slate-500" : task.status === "执行中" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{task.status}</span>{task.isDemo && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">演示案例</span>}{task.inspectionResult && <span className={`rounded-full px-2.5 py-1 text-xs ${task.inspectionResult === "合格" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"}`}>巡检{task.inspectionResult}</span>}</div><p className="mt-2 text-sm text-slate-500">{task.template} · {task.scenario} · 执行人：{task.assignee}</p><p className="mt-1 text-xs text-slate-400">执行时间：{formatExecutionTime(task.executionTime)}{task.rectificationCount ? ` · ${task.rectificationCount} 个整改项目` : ""}</p></div><div className="flex items-center gap-3">{!completed && !cancelled && <button className="text-sm font-medium text-rose-600 hover:text-rose-700" onClick={onCancel} type="button">取消任务</button>}{completed ? <Link className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href="/results" onClick={onOpen}>查看总结</Link> : cancelled ? <span className="text-sm text-slate-400">已停止执行</span> : <Link className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800" href="/tasks/demo" onClick={onOpen}>进入执行</Link>}</div></div>;
}

type TaskStatusFilter = DemoTask["status"] | "全部";

function CreateTaskDialog({ assignee, executionTime, onAssigneeChange, onClose, onExecutionTimeChange, onScenarioChange, onStoreChange, onSubmit, onTemplateChange, scenario, store, templateId, templates }: { assignee: string; executionTime: string; onAssigneeChange: (value: string) => void; onClose: () => void; onExecutionTimeChange: (value: string) => void; onScenarioChange: (value: string) => void; onStoreChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onTemplateChange: (value: string) => void; scenario: string; store: string; templateId: string; templates: DemoTemplate[] }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 sm:items-center"><div aria-labelledby="create-task-title" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">新建任务</p><h2 className="mt-1 text-xl font-semibold text-slate-950" id="create-task-title">创建巡检任务</h2></div><button aria-label="关闭弹窗" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button">×</button></div><form className="mt-6 space-y-5" onSubmit={onSubmit}><label className="block text-sm font-medium text-slate-700">巡检模板<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-teal-500 focus:bg-white" onChange={(event) => onTemplateChange(event.target.value)} value={templateId}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">巡检门店<input className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-teal-500 focus:bg-white" value={store} onChange={(event) => onStoreChange(event.target.value)} required /></label><label className="block text-sm font-medium text-slate-700">巡检场景<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-teal-500 focus:bg-white" value={scenario} onChange={(event) => onScenarioChange(event.target.value)}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">执行用户<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-normal text-slate-700 outline-none focus:border-teal-500 focus:bg-white" value={assignee} onChange={(event) => onAssigneeChange(event.target.value)}><option>张三</option><option>李四</option><option>王五</option></select></label><label className="block text-sm font-medium text-slate-700">执行时间<input className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-teal-500 focus:bg-white" type="datetime-local" value={executionTime} onChange={(event) => onExecutionTimeChange(event.target.value)} required /></label><div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">执行任务时同时支持两种图片取证方式：上传区域图片并 AI 识别，或在单个巡检项下手动上传图片。两种方式均可使用。</div><div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={onClose} type="button">取消</button><button className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!store.trim() || !executionTime || !templates.length} type="submit">创建并分配任务</button></div></form></div></div>;
}

function formatExecutionTime(value: string) {
  return formatShanghaiTime(value);
}

function scenarioForTemplate(template: DemoTemplate) {
  if (/开店/.test(template.scenario)) return "开店前巡检";
  if (/营业/.test(template.scenario)) return "营业中巡检";
  if (/关店/.test(template.scenario)) return "关店前巡检";
  return "关店前巡检";
}
