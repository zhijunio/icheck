"use client";

import Link from "next/link";
import { useState } from "react";
import { DemoTemplate } from "../demo-data";
import { useDemoTask } from "../demo-task-context";

export default function TemplateList({ onDelete, onEdit }: { onDelete: (template: DemoTemplate) => void; onEdit: (template: DemoTemplate) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { templates, removeTemplate } = useDemoTask();

  return <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">已有模板</h2><p className="mt-1 text-sm text-slate-500">查看已保存的模板，了解区域和巡检项目。</p></div><span className="text-sm text-slate-400">共 {templates.length} 个</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{templates.map((template) => <TemplateCard key={template.id} template={template} selected={selectedId === template.id} onDelete={() => { if (window.confirm(`确定删除“${template.name}”吗？`)) { removeTemplate(template.id); onDelete(template); setSelectedId(null); } }} onEdit={() => onEdit(template)} onToggle={() => setSelectedId(selectedId === template.id ? null : template.id)} />)}</div></section>;
}

function TemplateCard({ template, selected, onDelete, onEdit, onToggle }: { template: DemoTemplate; selected: boolean; onDelete: () => void; onEdit: () => void; onToggle: () => void }) {
  const itemCount = template.categories.reduce((count, category) => count + category.items.length, 0);
  const isCustom = template.id.startsWith("custom-");

  return <article className={`rounded-2xl border bg-white p-5 shadow-sm transition ${selected ? "border-teal-300 ring-2 ring-teal-50" : "border-slate-200 hover:border-teal-200"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{template.name}</h3><p className="mt-1 text-sm text-slate-500">{template.scenario}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isCustom ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{isCustom ? "自定义" : "示例"}</span></div><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400"><span>{template.categories.length} 个区域</span><span>{itemCount} 个项目</span><span>可直接使用</span></div><div className="mt-4 flex flex-wrap gap-3"><button className="text-sm font-medium text-teal-700 hover:text-teal-900" onClick={onToggle} type="button">{selected ? "收起模板内容" : "查看模板内容"}</button><button className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={onEdit} type="button">编辑</button>{isCustom && <button className="text-sm font-medium text-rose-600 hover:text-rose-700" onClick={onDelete} type="button">删除</button>}<Link className="text-sm font-medium text-slate-600 hover:text-slate-900" href={`/tasks?template=${template.id}`}>使用此模板</Link></div>{selected && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">{template.categories.map((category, categoryIndex) => <div key={`${category.name}-${categoryIndex}`}><p className="text-sm font-medium text-slate-800">{category.name}</p><ul className="mt-1 space-y-1">{category.items.map((item, itemIndex) => <li className="text-sm text-slate-500" key={`${categoryIndex}:${itemIndex}`}>· {item}</li>)}</ul></div>)}</div>}</article>;
}
