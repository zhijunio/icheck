export type AiConfig = {
  apiUrl: string;
  model: string;
  apiKey: string;
};

export function getAiConfig(): AiConfig | { error: string } {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim();

  if (!apiKey) return { error: "服务端未配置 AI_API_KEY。" };
  if (!baseUrl) return { error: "服务端未配置 AI_BASE_URL。" };
  if (!model) return { error: "服务端未配置 AI_MODEL。" };

  return {
    apiUrl: `${baseUrl}/chat/completions`,
    model,
    apiKey,
  };
}
