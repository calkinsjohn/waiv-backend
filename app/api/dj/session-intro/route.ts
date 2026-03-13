import { NextRequest, NextResponse } from "next/server";

import {
  generateSessionIntro,
  normalizeSessionIntroRequest,
  type SessionIntroNoContentReason,
} from "./pipeline";

function noContent(reason: SessionIntroNoContentReason): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-WAIV-Session-Intro-Reason": reason,
    },
  });
}

function requireAppToken(request: NextRequest): NextResponse | null {
  const expectedAppToken = process.env.WAIV_API_APP_TOKEN?.trim();
  if (!expectedAppToken) {
    return NextResponse.json({ error: "Missing WAIV_API_APP_TOKEN." }, { status: 503 });
  }

  const providedAppToken = request.headers.get("x-waiv-app-token")?.trim();
  if (!providedAppToken || providedAppToken !== expectedAppToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tokenFailure = requireAppToken(request);
  if (tokenFailure) return tokenFailure;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const input = normalizeSessionIntroRequest(rawBody);
  if (!input) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await generateSessionIntro(input);
    if (result.kind === "no_content") {
      return noContent(result.reason);
    }

    return NextResponse.json(result.response, { status: 200 });
  } catch {
    return noContent("llm_rejected");
  }
}
