/** Is this session still loaded on the server? */
import { NextResponse } from "next/server";
import { recallDurable } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get("session");
  if (!session) return NextResponse.json({ ok: false }, { status: 400 });

  const held = await recallDurable(session);
  if (!held) return NextResponse.json({ ok: false }, { status: 410 });

  return NextResponse.json({
    ok: true,
    owner: held.owner,
    threadCount: held.threads.length,
    messageCount: held.threads.reduce((n, t) => n + t.messages.length, 0),
  });
}
