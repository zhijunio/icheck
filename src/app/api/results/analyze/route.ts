import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxItemCount = 500;

const systemPrompt = `你是爱巡店的巡检结果分析助手。请根据用户提供的已完成巡检数据，生成简洁、客观、可执行的结果总结。

请严格遵守：
- 巡检人的最终判定是唯一的业务结论，AI 图片判断只能作为辅助信息，不能改写或质疑最终判定。
- 只能使用输入数据，不得臆测未提供的事实，不要编造门店情况、时间或问题。
- 巡检效率需要结合总耗时、项目数量和已判定数量进行分析；没有足够数据时明确说明。
- 巡检路径需要根据实际进入区域顺序分析，不要把模板默认顺序当成实际路径。
- 巡检问题只总结巡检人最终判定为不合格的项目，也可以指出仍未判定的项目。
- 改进建议要具体、优先级清晰，围绕问题、取证完整性和巡检效率给出建议。
- 输出简体中文，每个字段都是适合直接展示给用户的一到三句话。
- 只能输出合法 JSON，不要输出 Markdown、代码围栏、解释文字或额外字段。

输出结构必须是：
{
  "summary": "本次巡检的总体结论。",
  "efficiency": "巡检效率分析。",
  "path": "巡检路径分析。",
  "issues": "巡检问题总结。",
  "improvements": "改进建议。"
}`;

type ResultsInput = {
  store: string;
  scenario: string;
  assignee: string;
  durationSeconds: number | null;
  visitedAreas: string[];
  items: Array<{
    area: string;
    item: string;
    aiResult: "PASS" | "FAIL" | "UNKNOWN" | null;
    aiReason: string | null;
    humanResult: "PASS" | "FAIL" | null;
    confidence: "high" | "medium" | "low" | null;
    photoCount: number;
  }>;
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
  if (!isResultsInput(input)) return NextResponse.json({ error: "巡检结果数据无效。" }, { status: 400 });
  if (input.items.length === 0 || input.items.length > maxItemCount) return NextResponse.json({ error: `巡检项目数量必须在 1 到 ${maxItemCount} 个之间。` }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
        max_completion_tokens: 2_000,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json({ error: "AI 结果分析服务暂时不可用，请稍后重试。" }, { status: 502 });
    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "AI 未返回有效结果分析。" }, { status: 502 });
    const analysis = parseAnalysis(content);
    if (!analysis) return NextResponse.json({ error: "AI 返回的结果分析格式无效，请重试。" }, { status: 502 });
    return NextResponse.json(analysis);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 结果分析超时，请稍后重试。" : "AI 结果分析服务暂时不可用，请检查服务配置。";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function isResultsInput(value: unknown): value is ResultsInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ResultsInput>;
  return typeof input.store === "string" && input.store.length <= 200
    && typeof input.scenario === "string" && input.scenario.length <= 200
    && typeof input.assignee === "string" && input.assignee.length <= 100
    && (input.durationSeconds === null || (typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds) && input.durationSeconds >= 0))
    && Array.isArray(input.visitedAreas) && input.visitedAreas.length <= 500 && input.visitedAreas.every((area) => typeof area === "string" && area.length <= 200)
    && Array.isArray(input.items) && input.items.every((item) => item && typeof item.area === "string" && item.area.length <= 200 && typeof item.item === "string" && item.item.length > 0 && item.item.length <= 500 && (item.aiResult === null || ["PASS", "FAIL", "UNKNOWN"].includes(item.aiResult)) && (item.aiReason === null || (typeof item.aiReason === "string" && item.aiReason.length <= 1_000)) && (item.humanResult === null || ["PASS", "FAIL"].includes(item.humanResult)) && (item.confidence === null || ["high", "medium", "low"].includes(item.confidence)) && typeof item.photoCount === "number" && Number.isInteger(item.photoCount) && item.photoCount >= 0 && item.photoCount <= 20);
}

function parseAnalysis(content: string) {
  const jsonContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(jsonContent) as Partial<Record<"summary" | "efficiency" | "path" | "issues" | "improvements", unknown>>;
    const fields = ["summary", "efficiency", "path", "issues", "improvements"] as const;
    if (fields.some((field) => typeof value[field] !== "string" || !value[field]?.trim())) return null;
    return Object.fromEntries(fields.map((field) => [field, (value[field] as string).trim()])) as Record<(typeof fields)[number], string>;
  } catch {
    return null;
  }
}
