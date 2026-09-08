import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export function GET() {
  getDatabase().prepare("SELECT 1").get();
  return NextResponse.json({ status: "ok" });
}
