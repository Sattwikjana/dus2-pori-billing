import { NextResponse } from "next/server";
import {
  cloudEnabled,
  countRecords,
  pullSince,
  pushRecords,
  type PushRecord,
} from "@/lib/server/cloud";

// Sync must never be answered from a cache.
export const dynamic = "force-dynamic";

const KINDS = new Set([
  "customers",
  "items",
  "invoices",
  "expenses",
  "pointsLog",
  "settings",
]);

/** Pull everything changed since the client's cursor. */
export async function GET(request: Request) {
  if (!cloudEnabled) {
    return NextResponse.json({ cloud: false, rows: [], cursor: null, hasMore: false });
  }
  const since = new URL(request.url).searchParams.get("since");
  try {
    const result = await pullSince(since && since !== "null" ? since : null);
    return NextResponse.json({ cloud: true, ...result });
  } catch (err) {
    console.error("sync pull failed", err);
    return NextResponse.json(
      { cloud: true, error: "Could not read from the database." },
      { status: 503 },
    );
  }
}

/** Push locally changed records, then hand back a fresh cursor. */
export async function POST(request: Request) {
  if (!cloudEnabled) {
    return NextResponse.json({ cloud: false });
  }

  let records: PushRecord[] = [];
  try {
    const body = (await request.json()) as { records?: PushRecord[] };
    records = Array.isArray(body.records) ? body.records : [];
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const clean = records.filter(
    (r) => r && KINDS.has(r.kind) && typeof r.id === "string" && r.id.length <= 200,
  );
  if (clean.length > 2000) {
    return NextResponse.json({ error: "Too many records." }, { status: 413 });
  }

  try {
    await pushRecords(clean);
    // Deliberately no cursor: the client keeps its own and pulls straight
    // after, so it still sees anything another device wrote in the meantime.
    return NextResponse.json({ cloud: true, saved: clean.length });
  } catch (err) {
    console.error("sync push failed", err);
    return NextResponse.json(
      { cloud: true, error: "Could not save to the database." },
      { status: 503 },
    );
  }
}

/** Lightweight health probe for the Settings screen. */
export async function HEAD() {
  if (!cloudEnabled) return new NextResponse(null, { status: 501 });
  try {
    const live = await countRecords();
    return new NextResponse(null, {
      status: 200,
      headers: { "x-record-count": String(live) },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
