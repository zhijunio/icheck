import { NextResponse } from "next/server";
import { getAiConfig } from "../../ai-config";

const maxRequestLength = 5_000;
const maxImageDataLength = 8_000_000;

const systemPrompt = `你是门店巡检模板设计助手。根据用户描述生成一份可执行的门店巡检模板。

只输出 JSON，不要 Markdown、解释文字或代码围栏。JSON 结构必须严格为：
{
  "name": "模板名称",
  "scenario": "巡检场景",
  "categories": [
    {
      "name": "一级分类或门店区域",
      "items": ["巡检项目"]
    }
  ]
}

要求：
- 只允许一级分类，不要嵌套分类。
- 分类应优先按照门店位置或区域组织，便于线下规划巡检路线。
- 每个巡检项目必须是清晰、可观察、可判断的检查描述。
- 只生成与用户需求相关的分类和项目，不补充无关内容。
- 分类和巡检项目数量根据用户需求决定，不限定为 2 个分类或 4 个项目。
- 至少生成 1 个分类，每个分类至少生成 1 个巡检项目。
- 所有字段都必须是非空字符串，categories 必须是数组。`;

export async function POST(request: Request) {
  const config = getAiConfig();
  if ("error" in config) return NextResponse.json({ error: config.error }, { status: 500 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  }

  const prompt = typeof input === "object" && input !== null && "request" in input && typeof input.request === "string" ? input.request.trim() : "";
  const image = typeof input === "object" && input !== null && "image" in input && typeof input.image === "string" ? input.image : "";
  if (!prompt) return NextResponse.json({ error: "请输入巡检需求。" }, { status: 400 });
  if (prompt.length > maxRequestLength) return NextResponse.json({ error: `巡检需求不能超过 ${maxRequestLength} 个字符。` }, { status: 400 });
  if (!image && !isInspectionTemplateRequest(prompt)) return NextResponse.json({ error: "当前内容与巡检模板生成无关，请描述门店类型、巡检场景、区域或巡检重点。" }, { status: 400 });
  if (image && (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(image) || image.length > maxImageDataLength)) return NextResponse.json({ error: "手稿图片格式无效或文件过大。" }, { status: 400 });

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
          { role: "user", content: image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] : prompt },
        ],
        max_completion_tokens: 3_000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return NextResponse.json({ error: "AI 服务暂时不可用，请稍后重试。" }, { status: 502 });

    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "AI 未返回有效模板。" }, { status: 502 });

    const template = parseTemplate(content);
    if (!template) return NextResponse.json({ error: "AI 返回的模板格式无效，请重试。" }, { status: 502 });
    return NextResponse.json(template);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 分析超时，请稍后重试。" : "AI 服务暂时不可用，请检查服务配置。";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

type GeneratedTemplate = {
  name: string;
  scenario: string;
  categories: Array<{ name: string; items: string[] }>;
};

function parseTemplate(content: string): GeneratedTemplate | null {
  const jsonContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(jsonContent) as Partial<GeneratedTemplate>;
    if (typeof value.name !== "string" || !value.name.trim() || typeof value.scenario !== "string" || !value.scenario.trim() || !Array.isArray(value.categories) || value.categories.length === 0) return null;
    const categories = value.categories.map((category) => {
      if (!category || typeof category !== "object" || typeof category.name !== "string" || !Array.isArray(category.items)) return null;
      const items = category.items.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
      return category.name.trim() && items.length > 0 ? { name: category.name.trim(), items } : null;
    }).filter((category): category is { name: string; items: string[] } => category !== null);
    return categories.length > 0 ? { name: value.name.trim(), scenario: value.scenario.trim(), categories } : null;
  } catch {
    return null;
  }
}

function isInspectionTemplateRequest(prompt: string) {
  const hasGenerationIntent = /生成|创建|设计|制作|整理|编写|建立/.test(prompt);
  const hasTemplateReference = /模板|模版/.test(prompt);
  const hasInspectionContext = /巡检|巡查|检查项|门店|店铺|区域|开店|关店|营业|消防|安全|卫生|陈列|收银|仓储|仓库|后厨|设备|通道/.test(prompt);
  return (hasGenerationIntent && (hasTemplateReference || hasInspectionContext)) || (hasTemplateReference && hasInspectionContext);
}
