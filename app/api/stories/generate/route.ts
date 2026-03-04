import { NextRequest, NextResponse } from "next/server";

import {
  generateStoryV2,
  normalizeNarratives,
  normalizeStructuredContext,
  type StoryGenerateRequest,
  type NoContentReason,
} from "./pipeline";

function noContent(reason: NoContentReason, sourcesTried: string[] = []): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-WAIV-Story-Reason": reason,
      "X-WAIV-Sources-Tried": sourcesTried.join(","),
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

function parseRequestBody(input: unknown): StoryGenerateRequest | null {
  const payload = input as Partial<StoryGenerateRequest>;
  const isrc = typeof payload.isrc === "string" ? payload.isrc.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
  const djID = typeof payload.djID === "string" ? payload.djID.trim() : "";

  if (!isrc || !title || !artist) {
    return null;
  }

  return {
    isrc,
    title,
    artist,
    djID: djID || undefined,
    narratives: Array.isArray(payload.narratives) ? normalizeNarratives(payload.narratives) : undefined,
    context: payload.context === undefined ? undefined : normalizeStructuredContext(payload.context),
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tokenFailure = requireAppToken(request);
  if (tokenFailure) {
    return tokenFailure;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const input = parseRequestBody(rawBody);
  if (!input) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await generateStoryV2(input);

    if (result.kind === "no_content") {
      return noContent(result.reason, result.sourcesTried);
    }

    return NextResponse.json(result.response, { status: 200 });
  } catch {
    // Per v2 contract: treat unrecoverable errors as clean fallback.
    return noContent("llm_rejected", []);
  }
}
