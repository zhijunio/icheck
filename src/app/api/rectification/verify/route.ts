import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxImageDataLength = 8_000_000;

const systemPrompt = `你是爱巡店的整改复核助手。请对比整改前和整改后的现场照片，并结合巡检项目要求与验收标准，判断整改是否达到要求。

规则：
- 只根据巡检项目要求、验收标准和照片中可见内容判断，不得臆测照片中不可见的事实。
- result 为 PASS 表示整改后已达到要求，FAIL 表示问题仍存在或未达到要求，UNKNOWN 表示照片不足、模糊或无法完成对比。
- summary 必须说明对比后观察到的结果和判断依据。
- recommendation 必须给出下一步建议；PASS 时说明可以通过验收，FAIL 或 UNKNOWN 时说明还需要处理或补充什么证据。
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
  rectificationPhoto: string;
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
              { type: "text", text: `${JSON.stringify({ item: input.item, reason: input.reason, acceptanceCriteria: input.acceptanceCriteria })}\n以下为整改前现场照片。` },
              ...input.originalPhotos.map((image) => ({ type: "image_url", image_url: { url: image } })),
              { type: "text", text: "以上为整改前照片。下面是整改后照片。" },
              { type: "image_url", image_url: { url: input.rectificationPhoto } },
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
  return [input.item, input.reason, input.acceptanceCriteria, input.rectificationPhoto].every((field) => typeof field === "string" && field.trim().length > 0 && field.length <= 2_000)
    && Array.isArray(input.originalPhotos)
    && input.originalPhotos.length > 0
    && input.originalPhotos.length <= 5
    && input.originalPhotos.every((photo) => typeof photo === "string" && photo.length <= maxImageDataLength && /^data:image\/(?:jpeg|png|webp);base64,/i.test(photo))
    && typeof input.rectificationPhoto === "string"
    && input.rectificationPhoto.length <= maxImageDataLength
    && /^data:image\/(?:jpeg|png|webp);base64,/i.test(input.rectificationPhoto);
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
