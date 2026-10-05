// HTTP basic auth for hosted deploys: every request to the agent spends LLM tokens on the owner's key,
// so the public URL is gated. Set DEMO_USER / DEMO_PASS in the deployment; unset = open (local dev).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASS;
  if (!user || !pass) return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse("Life2Film Director demo — ask the author for access.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Life2Film Director", charset="UTF-8"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|engine/).*)"] };
