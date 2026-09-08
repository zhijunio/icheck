import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

const maxStateSize = 50_000_000;

export const runtime = "nodejs";

export async function GET() {
  const row = getDatabase().prepare("SELECT state_json, updated_at FROM app_state WHERE id = 1").get() as { state_json: string; updated_at: string } | undefined;
  if (!row) return NextResponse.json({ state: null, updatedAt: null });

  try {
    return NextResponse.json({ state: JSON.parse(row.state_json), updatedAt: row.updated_at });
  } catch {
    return NextResponse.json({ error: "数据库状态数据无效。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.text();
  if (body.length > maxStateSize) return NextResponse.json({ error: "状态数据过大。" }, { status: 413 });

  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  }

  if (!isStateRequest(input)) return NextResponse.json({ error: "状态数据无效。" }, { status: 400 });

  const updatedAt = new Date().toISOString();
  getDatabase().prepare(`
    INSERT INTO app_state (id, state_json, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(input.state), updatedAt);
  return NextResponse.json({ updatedAt });
}

function isStateRequest(value: unknown): value is { state: Record<string, unknown> } {
  return Boolean(value && typeof value === "object" && "state" in value && value.state && typeof value.state === "object" && !Array.isArray(value.state));
}
