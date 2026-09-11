import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxImageDataLength = 8_000_000;

const systemPrompt = `你是爱巡店的门店整改建议助手。请根据巡检项目要求和现场图片，针对一次巡检中的具体不合格项目，生成可以直接执行的整改方案。

规则：
- “item” 是巡检项目的原始要求，不是普通标题；整改方案必须直接回应这条要求。
- 必须同时参考巡检项目要求、AI 图片分析结果和提供的现场图片；先核对图片中可见的具体问题，再给出与巡检项目要求对应的整改动作。
- 必须说明整改动作如何使该巡检项目重新达到要求，不能只重复现场问题或给出通用清洁建议。
- 现场图片优先于文字描述；如果文字描述与图片不一致，只采纳图片中确实可见的内容，并说明证据限制。
- 只根据输入中的信息生成建议，不得臆测设备、责任人或不存在的现场事实。
- 图片证据不足或无法确认时，要在建议中明确说明需要补充什么现场证据，不要编造图片中不可见的事实。
- 巡检人的最终判定为不合格，AI 只负责建议整改动作。
- 建议要具体，优先说明立即处理动作、风险控制和复核方式。
- priority 只能是 high、medium、low；安全、消防、食品安全、用电、燃气和通道阻塞等问题通常为 high。
- deadline 使用简短中文，例如“立即处理”或“24 小时内”。
- acceptance_criteria 必须是可观察、可验收的标准。
- 只能输出合法 JSON，不要输出 Markdown、代码围栏、解释文字或额外字段。

输出结构：
{
  "suggestion": "具体整改措施。",
  "priority": "high",
  "deadline": "建议完成时限。",
  "acceptance_criteria": "整改完成后的验收标准。"
}`;

type SuggestionInput = {
  store: string;
  scenario: string;
  area: string;
  item: string;
  aiReason: string;
  photos: string[];
  humanResult: "FAIL";
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
  if (!isSuggestionInput(input)) return NextResponse.json({ error: "整改项目数据无效。" }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const requestBody = JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: [{ type: "text", text: JSON.stringify({ store: input.store, scenario: input.scenario, area: input.area, item: input.item, itemRequirement: input.item, aiReason: input.aiReason, humanResult: input.humanResult, photoCount: input.photos.length, evidenceRule: "请逐张查看以下现场图片，并只依据图片中可见内容生成整改建议。" }) }, ...input.photos.map((image) => ({ type: "image_url", image_url: { url: image } }))] }], max_completion_tokens: 1_000 });
    const response = await fetchWithRetry(config.apiUrl, config.apiKey, requestBody, controller.signal);
    if (!response.ok) return NextResponse.json({ error: "AI 整改建议服务暂时不可用，请稍后重试。" }, { status: 502 });
    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "AI 未返回有效整改建议。" }, { status: 502 });
    const suggestion = parseSuggestion(content);
    if (!suggestion) return NextResponse.json({ error: "AI 返回的整改建议格式无效，请重试。" }, { status: 502 });
    return NextResponse.json(suggestion);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 整改建议生成超时，请稍后重试。" : "AI 整改建议服务暂时不可用，请检查服务配置。";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string, apiKey: string, body: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal,
    });
    if (response.ok || !isRetryableStatus(response.status) || attempt >= 1) return response;
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isSuggestionInput(value: unknown): value is SuggestionInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<SuggestionInput>;
  return [input.store, input.scenario, input.area, input.item, input.aiReason].every((field) => typeof field === "string" && field.length > 0 && field.length <= 1_000) && input.humanResult === "FAIL" && Array.isArray(input.photos) && input.photos.length > 0 && input.photos.length <= 5 && input.photos.every((photo) => typeof photo === "string" && photo.length <= maxImageDataLength && /^data:image\/(?:jpeg|png|webp);base64,/i.test(photo));
}

function parseSuggestion(content: string) {
  const jsonContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(jsonContent) as Partial<{ suggestion: unknown; priority: unknown; deadline: unknown; acceptance_criteria: unknown }>;
    if (typeof value.suggestion !== "string" || !value.suggestion.trim() || typeof value.priority !== "string" || !["high", "medium", "low"].includes(value.priority) || typeof value.deadline !== "string" || !value.deadline.trim() || typeof value.acceptance_criteria !== "string" || !value.acceptance_criteria.trim()) return null;
    return { suggestion: value.suggestion.trim(), priority: value.priority, deadline: value.deadline.trim(), acceptanceCriteria: value.acceptance_criteria.trim() };
  } catch {
    return null;
  }
}
