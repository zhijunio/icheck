"use client";

import { useState } from "react";
import { DemoTemplate } from "../demo-data";
import TemplateEditor from "./template-editor";
import TemplateList from "./template-list";

export default function TemplatesPage() {
  const [editingTemplate, setEditingTemplate] = useState<DemoTemplate | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);

  function openEditor(template: DemoTemplate | null) {
    setEditingTemplate(template);
    setEditorVersion((version) => version + 1);
    window.requestAnimationFrame(() => document.getElementById("template-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-teal-700">模板</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">生成巡检模板</h1><p className="mt-3 text-slate-600">一次描述门店类型、巡检场景、区域和重点，一键生成区域巡检项目。</p></div>
        <button className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800" onClick={() => openEditor(null)} type="button">+ 新建模板</button>
      </div>
      <TemplateList onDelete={(template) => { if (editingTemplate?.id === template.id) setEditingTemplate(null); }} onEdit={openEditor} />
      <TemplateEditor key={`${editingTemplate?.id ?? "new-template"}-${editorVersion}`} editingTemplate={editingTemplate} onCancelEdit={() => setEditingTemplate(null)} />
    </main>
  );
}
