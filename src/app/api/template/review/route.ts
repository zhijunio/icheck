import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxCategoryCount = 100;
const maxItemCount = 500;

const systemPrompt = `你是爱巡店的巡检模板质量审核助手。请审核用户提供的门店巡检模板，帮助用户在保存前发现质量问题。

请检查：
- 是否存在重复或高度相似的巡检项目；
- 项目是否含糊、不可观察、缺少明确判断标准；
- 项目是否适合通过门店现场图片辅助判断；
- 是否缺少与门店类型和巡检场景明显相关的关键区域或分类；
- 是否存在与门店类型或场景明显无关的项目；
- 分类是否只有一级，区域和项目是否足够清晰。

规则：
- 只根据输入模板和场景判断，不要补充输入中没有的门店事实。
- 质量审核是建议，不能阻止用户保存模板。
- 没有问题时 issues 返回空数组，overall 返回 good。
- issue 的 type 只能是 duplicate、ambiguous、not_image_verifiable、missing_category、irrelevant、structure；severity 只能是 high、medium、low。
- category 和 item 没有对应对象时返回空字符串。
- 只能输出合法 JSON，不要输出 Markdown、代码围栏、解释文字或额外字段。

输出结构：
{
  "overall": "good",
  "summary": "模板质量总结。",
  "issues": [
    {
      "type": "ambiguous",
      "severity": "medium",
      "category": "卖场区",
      "item": "现场保持良好",
      "message": "问题说明。",
      "suggestion": "修改建议。"
    }
  ]
}`;

type TemplateInput = {
  name: string;
  scenario: string;
  categories: Array<{ name: string; items: string[] }>;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

export async function POST(request: Request) {
  const config = getAiConfig();
  if ("error" in config) return NextResponse.json({ error: config.error }, { status: 500 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  }
  if (!isTemplateInput(input)) return NextResponse.json({ error: "巡检模板数据无效。" }, { status: 400 });
  const itemCount = input.categories.reduce((count, category) => count + category.items.length, 0);
  if (input.categories.length === 0 || input.categories.length > maxCategoryCount || itemCount === 0 || itemCount > maxItemCount) return NextResponse.json({ error: `模板最多支持 ${maxCategoryCount} 个分类和 ${maxItemCount} 个巡检项目。` }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify(input) }], max_completion_tokens: 3_000 }),
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json({ error: "AI 模板质量检查服务暂时不可用，请稍后重试。" }, { status: 502 });
    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "AI 未返回有效模板检查结果。" }, { status: 502 });
    const review = parseReview(content);
    if (!review) return NextResponse.json({ error: "AI 返回的模板检查格式无效，请重试。" }, { status: 502 });
    return NextResponse.json(review);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 模板质量检查超时，请稍后重试。" : "AI 模板质量检查服务暂时不可用，请检查服务配置。";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function isTemplateInput(value: unknown): value is TemplateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<TemplateInput>;
  return typeof input.name === "string" && input.name.length > 0 && input.name.length <= 200 && typeof input.scenario === "string" && input.scenario.length <= 200 && Array.isArray(input.categories) && input.categories.every((category) => category && typeof category.name === "string" && category.name.length > 0 && category.name.length <= 200 && Array.isArray(category.items) && category.items.length > 0 && category.items.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500));
}

function parseReview(content: string) {
  const jsonContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(jsonContent) as Partial<{ overall: unknown; summary: unknown; issues: unknown }>;
    if (value.overall !== "good" && value.overall !== "needs_revision") return null;
    if (typeof value.summary !== "string" || !value.summary.trim() || !Array.isArray(value.issues)) return null;
    const issues = value.issues.map((issue) => {
      if (!issue || typeof issue !== "object") return null;
      const candidate = issue as Partial<Record<"type" | "severity" | "category" | "item" | "message" | "suggestion", unknown>>;
      const types = ["duplicate", "ambiguous", "not_image_verifiable", "missing_category", "irrelevant", "structure"];
      const severities = ["high", "medium", "low"];
      if (typeof candidate.type !== "string" || !types.includes(candidate.type) || typeof candidate.severity !== "string" || !severities.includes(candidate.severity) || typeof candidate.category !== "string" || typeof candidate.item !== "string" || typeof candidate.message !== "string" || !candidate.message.trim() || typeof candidate.suggestion !== "string" || !candidate.suggestion.trim()) return null;
      return { type: candidate.type, severity: candidate.severity, category: candidate.category.trim(), item: candidate.item.trim(), message: candidate.message.trim(), suggestion: candidate.suggestion.trim() };
    });
    return issues.every((issue) => issue !== null) ? { overall: value.overall, summary: value.summary.trim(), issues } : null;
  } catch {
    return null;
  }
}
