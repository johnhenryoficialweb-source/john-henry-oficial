import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "john-henry-oficial", time: new Date().toISOString() });
}
