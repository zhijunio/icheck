import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxImageDataLength = 8_000_000;

const systemPrompt = `你是爱巡店的整改复核助手。请根据巡检时发现的问题、巡检项目要求、验收标准和整改后现场照片，判断问题是否已经完成整改。

规则：
- “reason” 是巡检时已经发现的问题，必须围绕这个问题判断整改是否完成；不能只判断整改前后照片是否相似。
- “item” 是巡检项目要求，“acceptanceCriteria” 是验收标准；整改后照片可能有多张，必须逐张查看并综合判断。
- 巡检现场照片仅用于补充理解问题背景；即使没有巡检现场照片，也要根据问题描述、巡检项目要求、验收标准和整改后照片完成判断。
- 只根据输入中明确的信息和照片中可见内容判断，不得臆测照片中不可见的事实。
- result 为 PASS 表示整改后问题已解决且达到验收标准，FAIL 表示问题仍存在或未达到标准，UNKNOWN 表示整改后照片不足、模糊、角度不合适或无法确认。
- summary 必须说明整改后照片中观察到的事实、与原问题的对应关系和判断依据。
- recommendation 必须给出下一步建议；PASS 时说明可以通过验收，FAIL 或 UNKNOWN 时说明还需要处理什么或补充什么证据。
- 只能输出合法 JSON，不要输出 Markdown、代码围栏、解释文字或额外字段。

输出结构：
{
  "result": "PASS",
  "summary": "整改前后对比结论及判断依据。",
  "recommendation": "下一步处理建议。"
}`;

type VerificationInput = {
  item: string;
  reason: string;
  acceptanceCriteria: string;
  originalPhotos: string[];
  rectificationPhotos: string[];
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
  if (!isVerificationInput(input)) return NextResponse.json({ error: "整改复核数据无效。" }, { status: 400 });

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
          {
            role: "user",
            content: [
              { type: "text", text: `${JSON.stringify({ item: input.item, issueFoundDuringInspection: input.reason, acceptanceCriteria: input.acceptanceCriteria })}\n以下图片是巡检时的现场照片，用于补充理解原问题。` },
              ...input.originalPhotos.map((image) => ({ type: "image_url", image_url: { url: image } })),
              { type: "text", text: "以下是整改后现场照片。请以这些照片为主要证据，判断巡检时发现的问题是否已完成整改。" },
              ...input.rectificationPhotos.map((image) => ({ type: "image_url", image_url: { url: image } })),
            ],
          },
        ],
        max_completion_tokens: 1_000,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json({ error: "AI 整改复核服务暂时不可用，请稍后重试。" }, { status: 502 });
    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "AI 未返回有效复核结果。" }, { status: 502 });
    const result = parseVerification(content);
    if (!result) return NextResponse.json({ error: "AI 返回的复核结果格式无效，请重试。" }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 整改复核超时，请稍后重试。" : "AI 整改复核服务暂时不可用，请检查服务配置。";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function isVerificationInput(value: unknown): value is VerificationInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<VerificationInput>;
  return [input.item, input.reason, input.acceptanceCriteria].every((field) => typeof field === "string" && field.trim().length > 0 && field.length <= 2_000)
    && Array.isArray(input.originalPhotos)
    && input.originalPhotos.length <= 5
    && input.originalPhotos.every((photo) => typeof photo === "string" && photo.length <= maxImageDataLength && /^data:image\/(?:jpeg|png|webp);base64,/i.test(photo))
    && Array.isArray(input.rectificationPhotos)
    && input.rectificationPhotos.length > 0
    && input.rectificationPhotos.length <= 5
    && input.rectificationPhotos.every((photo) => typeof photo === "string" && photo.length <= maxImageDataLength && /^data:image\/(?:jpeg|png|webp);base64,/i.test(photo));
}

function parseVerification(content: string) {
  const jsonContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(jsonContent) as Partial<{ result: unknown; summary: unknown; recommendation: unknown }>;
    if (!(["PASS", "FAIL", "UNKNOWN"] as unknown[]).includes(value.result) || typeof value.summary !== "string" || !value.summary.trim() || typeof value.recommendation !== "string" || !value.recommendation.trim()) return null;
    return { result: value.result, summary: value.summary.trim(), recommendation: value.recommendation.trim() };
  } catch {
    return null;
  }
}
