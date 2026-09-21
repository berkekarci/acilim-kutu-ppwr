import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await healthCheck();
    return NextResponse.json({ ok: true, database: true, checkedAt: db.now });
  } catch (error) {
    return NextResponse.json({ ok: false, database: false, error: error?.message || "health-check-failed" }, { status: 503 });
  }
}
