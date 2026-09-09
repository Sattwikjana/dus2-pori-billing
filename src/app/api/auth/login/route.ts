import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkCredentials,
  createSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    username = String(body.username ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!checkCredentials(username, password)) {
    // A small delay blunts scripted guessing without hurting a real login.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json(
      { error: "Wrong username or password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
