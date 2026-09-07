"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { DemoTemplate, demoTemplates, InspectionArea } from "./demo-data";

export type Analysis = {
  result: "PASS" | "FAIL" | "UNKNOWN";
  reason: string;
  confidence?: "high" | "medium" | "low";
  photoIndexes?: number[];
  confirmed?: "PASS" | "FAIL";
  confirmedBy?: string;
  confirmedAt?: string;
  confirmationNote?: string;
  rectificationSuggestion?: string;
  rectificationPriority?: "high" | "medium" | "low";
  rectificationDeadline?: string;
  rectificationAcceptanceCriteria?: string;
  rectificationStatus?: "待整改" | "整改中" | "已完成";
  rectificationNote?: string;
  rectificationPhotoName?: string;
  rectificationPhoto?: string;
  rectificationVerification?: {
    result: "PASS" | "FAIL" | "UNKNOWN";
    summary: string;
    recommendation: string;
    verifiedAt: string;
  };
};

export type AiReport = {
  summary: string;
  efficiency: string;
  path: string;
  issues: string;
  improvements: string;
};

export type DemoTask = {
  id: number;
  template: string;
  store: string;
  scenario: string;
  assignee: string;
  executionTime: string;
  status: "待执行" | "执行中" | "已完成" | "已取消";
  areas: InspectionArea[];
  startedAt?: string;
  completedAt?: string;
  inspectionResult?: "合格" | "不合格";
  rectificationCount?: number;
  aiReport?: AiReport;
  isDemo?: boolean;
};

export type RectificationItem = {
  taskId: number;
  store: string;
  scenario: string;
  assignee: string;
  area: string;
  item: string;
  itemKey: string;
  reason: string;
  suggestion: string;
  priority?: Analysis["rectificationPriority"];
  deadline?: string;
  acceptanceCriteria?: string;
  status: Analysis["rectificationStatus"];
  note: string;
  photoName: string;
  photo?: string;
  originalPhotos: string[];
  verification?: Analysis["rectificationVerification"];
};

type DemoTaskContextValue = {
  hydrated: boolean;
  currentTask: DemoTask | null;
  tasks: DemoTask[];
  rectifications: RectificationItem[];
  templates: DemoTemplate[];
  photos: Record<number, string[]>;
  itemPhotos: Record<string, string[]>;
  visitedAreas: number[];
  completedAreas: number[];
  analyses: Record<string, Analysis>;
  setAnalysis: (itemKey: string, analysis: Analysis) => void;
  clearAnalysis: (itemKey: string) => void;
  setRectification: (itemKey: string, updates: Partial<Pick<Analysis, "rectificationStatus" | "rectificationNote" | "rectificationPhotoName" | "rectificationPhoto" | "rectificationVerification">>) => void;
  completeArea: (areaIndex: number) => void;
  reopenArea: (areaIndex: number) => void;
  setCurrentTask: (task: DemoTask) => void;
  addTask: (task: DemoTask) => void;
  cancelTask: (taskId: number) => void;
  addTemplate: (template: DemoTemplate) => void;
  updateTemplate: (template: DemoTemplate) => void;
  removeTemplate: (templateId: string) => void;
  addPhotos: (areaIndex: number, photos: string[]) => void;
  removePhoto: (areaIndex: number, photoIndex: number) => void;
  addItemPhotos: (itemKey: string, photos: string[]) => void;
  removeItemPhoto: (itemKey: string, photoIndex: number) => void;
  areaVisitCounts: Record<string, Record<number, number>>;
  recordAreaVisit: (routeKey: string, areaIndex: number) => void;
  saveAiReport: (report: AiReport) => void;
  loadDemoCase: () => void;
  storageWarning: string;
};

type TaskProgress = {
  photos: Record<number, string[]>;
  itemPhotos: Record<string, string[]>;
  visitedAreas: number[];
  completedAreas: number[];
  analyses: Record<string, Analysis>;
};

const DemoTaskContext = createContext<DemoTaskContextValue | null>(null);
const storageKey = "icheck-demo-state";

export function DemoTaskProvider({ children }: { children: ReactNode }) {
  const [currentTask, setCurrentTask] = useState<DemoTask | null>(null);
  const [tasks, setTasks] = useState<DemoTask[]>([]);
  const [templates, setTemplates] = useState<DemoTemplate[]>(demoTemplates);
  const [photos, setPhotos] = useState<Record<number, string[]>>({});
  const [itemPhotos, setItemPhotos] = useState<Record<string, string[]>>({});
  const [visitedAreas, setVisitedAreas] = useState<number[]>([]);
  const [completedAreas, setCompletedAreas] = useState<number[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [progressByTask, setProgressByTask] = useState<Record<number, TaskProgress>>({});
  const [areaVisitCounts, setAreaVisitCounts] = useState<Record<string, Record<number, number>>>({});
  const [storageWarning, setStorageWarning] = useState("");
  const [hydrated, setHydrated] = useState(false);

  /* Restore client-only state after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const state = JSON.parse(stored) as Partial<DemoTaskContextValue> & { progressByTask?: Record<number, TaskProgress> };
        if (Array.isArray(state.tasks)) setTasks(state.tasks);
        if (Array.isArray(state.templates)) setTemplates(mergeTemplates(state.templates));
        if (state.progressByTask && typeof state.progressByTask === "object") setProgressByTask(state.progressByTask);
        if (state.areaVisitCounts && typeof state.areaVisitCounts === "object") setAreaVisitCounts(state.areaVisitCounts);
        if (state.currentTask && typeof state.currentTask === "object") {
          setCurrentTask(state.currentTask);
          const progress = state.progressByTask?.[state.currentTask.id];
          if (progress) {
            setPhotos(progress.photos);
            setItemPhotos(progress.itemPhotos ?? {});
            const savedVisitedAreas = progress.visitedAreas ?? [];
            setVisitedAreas(savedVisitedAreas.length > 0 ? savedVisitedAreas : [0]);
            setCompletedAreas(progress.completedAreas);
            setAnalyses(progress.analyses);
          } else {
            if (state.photos && typeof state.photos === "object") setPhotos(state.photos);
            if (state.itemPhotos && typeof state.itemPhotos === "object") setItemPhotos(state.itemPhotos);
            if (Array.isArray(state.visitedAreas)) setVisitedAreas(state.visitedAreas);
            if (Array.isArray(state.completedAreas)) setCompletedAreas(state.completedAreas);
            if (state.analyses && typeof state.analyses === "object") setAnalyses(state.analyses);
          }
        }
      }
    } catch {
      // Ignore malformed or unavailable local storage and start with demo data.
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* This effect synchronizes persistence failures with the UI. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return;
    try {
      const storedProgress = currentTask ? { ...progressByTask, [currentTask.id]: { photos, itemPhotos, visitedAreas, completedAreas, analyses } } : progressByTask;
      window.localStorage.setItem(storageKey, JSON.stringify({ currentTask, tasks, templates, progressByTask: storedProgress, areaVisitCounts }));
      setStorageWarning("");
    } catch {
      setStorageWarning("浏览器存储空间不足，当前会话仍可继续，但刷新后可能无法保留全部图片。");
    }
  }, [analyses, areaVisitCounts, completedAreas, currentTask, hydrated, itemPhotos, photos, progressByTask, tasks, templates, visitedAreas]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function setAnalysis(itemKey: string, analysis: Analysis) {
    setAnalyses((current) => ({ ...current, [itemKey]: analysis }));
  }

  function clearAnalysis(itemKey: string) {
    setAnalyses((current) => {
      const next = { ...current };
      delete next[itemKey];
      return next;
    });
  }

  function setRectification(itemKey: string, updates: Partial<Pick<Analysis, "rectificationStatus" | "rectificationNote" | "rectificationPhotoName" | "rectificationPhoto" | "rectificationVerification">>) {
    setAnalyses((current) => current[itemKey] ? { ...current, [itemKey]: { ...current[itemKey], ...updates } } : current);
  }

  function completeArea(areaIndex: number) {
    if (completedAreas.includes(areaIndex)) return;
    const nextCompletedAreas = [...completedAreas, areaIndex];
    setCompletedAreas(nextCompletedAreas);
    if (currentTask) {
      const inspectionCompleted = nextCompletedAreas.length === (currentTask.areas?.length || 5);
      const failedCount = Object.values(analyses).filter((analysis) => analysis.confirmed === "FAIL").length;
      const updatedTask = {
        ...currentTask,
        status: inspectionCompleted ? "已完成" as const : "执行中" as const,
        ...(inspectionCompleted ? { completedAt: new Date().toISOString(), inspectionResult: failedCount > 0 ? "不合格" as const : "合格" as const, rectificationCount: failedCount } : {}),
      };
      setCurrentTask(updatedTask);
      setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
    }
  }

  function reopenArea(areaIndex: number) {
    setCompletedAreas((current) => current.filter((index) => index !== areaIndex));
  }

  function addTask(task: DemoTask) {
    setTasks((current) => [task, ...current]);
    setCurrentTask(task);
    setCompletedAreas([]);
    setAnalyses({});
    setPhotos({});
    setItemPhotos({});
    setVisitedAreas([]);
    setProgressByTask((current) => {
      const next = { ...current, [task.id]: { photos: {}, itemPhotos: {}, visitedAreas: [], completedAreas: [], analyses: {} } };
      if (currentTask) next[currentTask.id] = { photos, itemPhotos, visitedAreas, completedAreas, analyses };
      return next;
    });
  }

  function cancelTask(taskId: number) {
    setTasks((current) => current.map((task) => task.id === taskId && task.status !== "已完成" ? { ...task, status: "已取消" as const } : task));
    setCurrentTask((current) => current?.id === taskId && current.status !== "已完成" ? { ...current, status: "已取消" } : current);
  }

  function selectTask(task: DemoTask) {
    const selectedTask = task.status === "待执行" ? { ...task, status: "执行中" as const } : task;
    const taskWithStart = selectedTask.status === "执行中" && !selectedTask.startedAt ? { ...selectedTask, startedAt: new Date().toISOString() } : selectedTask;
    if (currentTask?.id === taskWithStart.id && currentTask.status === taskWithStart.status && currentTask.startedAt === taskWithStart.startedAt) return;
    if (currentTask) {
      setProgressByTask((current) => ({ ...current, [currentTask.id]: { photos, itemPhotos, visitedAreas, completedAreas, analyses } }));
    }
    const progress = progressByTask[taskWithStart.id];
    setCurrentTask(taskWithStart);
    setTasks((current) => current.map((item) => item.id === taskWithStart.id ? taskWithStart : item));
    setPhotos(progress?.photos ?? {});
    setItemPhotos(progress?.itemPhotos ?? {});
    const savedVisitedAreas = progress?.visitedAreas ?? [];
    setVisitedAreas(savedVisitedAreas.length > 0 ? savedVisitedAreas : [0]);
    setCompletedAreas(progress?.completedAreas ?? []);
    setAnalyses(progress?.analyses ?? {});
  }

  function addTemplate(template: DemoTemplate) {
    setTemplates((current) => [template, ...current]);
  }

  function updateTemplate(template: DemoTemplate) {
    setTemplates((current) => current.map((item) => item.id === template.id ? template : item));
  }

  function removeTemplate(templateId: string) {
    if (!templateId.startsWith("custom-")) return;
    setTemplates((current) => current.filter((template) => template.id !== templateId));
  }

  function addPhotos(areaIndex: number, newPhotos: string[]) {
    setPhotos((current) => ({ ...current, [areaIndex]: [...(current[areaIndex] ?? []), ...newPhotos] }));
  }

  function removePhoto(areaIndex: number, photoIndex: number) {
    setPhotos((current) => ({ ...current, [areaIndex]: (current[areaIndex] ?? []).filter((_, index) => index !== photoIndex) }));
  }

  function addItemPhotos(itemKey: string, newPhotos: string[]) {
    setItemPhotos((current) => ({ ...current, [itemKey]: [...(current[itemKey] ?? []), ...newPhotos] }));
  }

  function removeItemPhoto(itemKey: string, photoIndex: number) {
    setItemPhotos((current) => ({ ...current, [itemKey]: (current[itemKey] ?? []).filter((_, index) => index !== photoIndex) }));
  }

  function recordAreaVisit(routeKey: string, areaIndex: number) {
    setAreaVisitCounts((current) => ({
      ...current,
      [routeKey]: {
        ...(current[routeKey] ?? {}),
        [areaIndex]: (current[routeKey]?.[areaIndex] ?? 0) + 1,
      },
    }));
    setVisitedAreas((current) => current.includes(areaIndex) ? current : [...current, areaIndex]);
  }

  function saveAiReport(report: AiReport) {
    if (!currentTask) return;
    const updatedTask = { ...currentTask, aiReport: report };
    setCurrentTask(updatedTask);
    setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
  }

  function loadDemoCase() {
    const task: DemoTask = {
      id: 900001,
      template: "服装门店巡检 · 演示案例",
      store: "爱巡店体验门店",
      scenario: "营业中巡检",
      assignee: "演示巡检员",
      executionTime: new Date().toISOString(),
      status: "已完成",
      areas: demoTemplates[0].categories.map((area) => ({ ...area, items: [...area.items] })),
      startedAt: new Date(Date.now() - 9 * 60 * 1000 - 18 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 12 * 1000).toISOString(),
      inspectionResult: "不合格",
      rectificationCount: 1,
      isDemo: true,
      aiReport: {
        summary: "本次演示完成 4 个巡检项目，巡检人员确认 3 项合格、1 项不合格，整体结果为不合格。",
        efficiency: "本次演示总耗时约 9 分钟，2 个区域均完成取证和人工确认。",
        path: "门店入口 → 卖场区域。实际执行顺序来自本次演示记录。",
        issues: "商品陈列区发现商品陈列存在异常，需要及时整理。",
        improvements: "优先整理商品陈列并上传复核图片；后续可继续使用区域批量拍照减少逐项上传操作。",
      },
    };
    const analyses: Record<string, Analysis> = {};
    const demoPhotos: Record<number, string[]> = {};
    task.areas.forEach((area, areaIndex) => {
      demoPhotos[areaIndex] = [demoPhoto(area.name, areaIndex)];
      area.items.forEach((item, itemIndex) => {
        const failed = areaIndex === 1 && itemIndex === 0;
        analyses[`${areaIndex}:${itemIndex}`] = {
          result: failed ? "FAIL" : "PASS",
          reason: failed ? "图片中可见商品陈列不整齐，存在明显空缺。" : "图片清晰显示该巡检项目符合要求，未发现明显异常。",
          confidence: "high",
          photoIndexes: [0],
          confirmed: failed ? "FAIL" : "PASS",
          confirmedBy: task.assignee,
          confirmedAt: task.completedAt,
          ...(failed ? { rectificationSuggestion: "立即补齐并整理商品陈列，完成后上传覆盖货架正面的复核图片。", rectificationPriority: "medium" as const, rectificationDeadline: "当天处理", rectificationAcceptanceCriteria: "商品陈列整齐，无明显空缺，货架区域保持清晰整洁。" } : {}),
        };
      });
    });
    setTasks((current) => [task, ...current.filter((item) => !item.isDemo)]);
    setCurrentTask(task);
    setPhotos(demoPhotos);
    setItemPhotos({});
    setVisitedAreas(task.areas.map((_, index) => index));
    setCompletedAreas(task.areas.map((_, index) => index));
    setAnalyses(analyses);
    setProgressByTask((current) => ({ ...current, [task.id]: { photos: demoPhotos, itemPhotos: {}, visitedAreas: task.areas.map((_, index) => index), completedAreas: task.areas.map((_, index) => index), analyses } }));
  }

  const rectifications = tasks.flatMap((task) => {
    if (task.status !== "已完成") return [];
    const taskAnalyses = currentTask?.id === task.id ? analyses : progressByTask[task.id]?.analyses ?? {};
    const taskPhotos = currentTask?.id === task.id ? photos : progressByTask[task.id]?.photos ?? {};
    const taskItemPhotos = currentTask?.id === task.id ? itemPhotos : progressByTask[task.id]?.itemPhotos ?? {};
    return task.areas.flatMap((area, areaIndex) => area.items.flatMap((item, itemIndex) => {
      const itemKey = `${areaIndex}:${itemIndex}`;
      const analysis = taskAnalyses[itemKey];
      if (analysis?.confirmed !== "FAIL") return [];
      const originalPhotos = [...new Set([
        ...(analysis.photoIndexes?.map((photoIndex) => taskPhotos[areaIndex]?.[photoIndex]).filter((photo): photo is string => Boolean(photo)) ?? []),
        ...(taskItemPhotos[itemKey] ?? []),
      ])].slice(0, 5);
      return [{
        taskId: task.id,
        store: task.store,
        scenario: task.scenario,
        assignee: task.assignee,
        area: area.name,
        item,
        itemKey,
        reason: analysis.reason,
        suggestion: analysis.rectificationSuggestion ?? "请处理现场问题，完成整改后上传复核图片。",
        // Older localStorage records were created before priority was added.
        priority: analysis.rectificationPriority ?? "medium",
        deadline: analysis.rectificationDeadline,
        acceptanceCriteria: analysis.rectificationAcceptanceCriteria,
        status: analysis.rectificationStatus ?? "待整改",
        note: analysis.rectificationNote ?? "",
        photoName: analysis.rectificationPhotoName ?? "",
        photo: analysis.rectificationPhoto,
        originalPhotos,
        verification: analysis.rectificationVerification,
      } satisfies RectificationItem];
    }));
  });

  return <DemoTaskContext.Provider value={{ hydrated, currentTask, tasks, rectifications, templates, photos, itemPhotos, visitedAreas, completedAreas, analyses, areaVisitCounts, storageWarning, setAnalysis, clearAnalysis, setRectification, completeArea, reopenArea, setCurrentTask: selectTask, addTask, cancelTask, addTemplate, updateTemplate, removeTemplate, addPhotos, removePhoto, addItemPhotos, removeItemPhoto, recordAreaVisit, saveAiReport, loadDemoCase }}>{children}</DemoTaskContext.Provider>;
}

function demoPhoto(area: string, index: number) {
  const colors = ["#dff7f2", "#e4f0ff", "#fff1d6", "#ffe5e5", "#eee8ff"];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><rect width="800" height="520" fill="${colors[index % colors.length]}"/><rect x="42" y="42" width="716" height="436" rx="24" fill="#ffffff" opacity=".82"/><text x="400" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#334155">${area}</text><text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">爱巡店演示图片 ${index + 1}</text></svg>`)}`;
}

function mergeTemplates(storedTemplates: DemoTemplate[]) {
  const removedTemplateIds = new Set(["3"]);
  const builtInTemplateIds = new Set(demoTemplates.map((template) => template.id));
  const customTemplates = storedTemplates.filter((template) => !builtInTemplateIds.has(template.id) && !removedTemplateIds.has(template.id));
  return [...demoTemplates, ...customTemplates];
}

export function useDemoTask() {
  const context = useContext(DemoTaskContext);
  if (!context) throw new Error("useDemoTask must be used inside DemoTaskProvider");
  return context;
}
