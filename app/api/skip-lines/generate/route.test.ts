import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("POST /api/skip-lines/generate", () => {
  const appToken = "test-app-token";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WAIV_API_APP_TOKEN = appToken;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    delete process.env.ANTHROPIC_SKIP_LINE_MODEL;
  });

  afterEach(() => {
    delete process.env.WAIV_API_APP_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns varied skip lines under 15 words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'Quick pivot to "Yellow" by Coldplay.',
                    'Not this one. Let\'s try "Yellow" by Coldplay.',
                    'Switching lanes: "Yellow" by Coldplay.',
                    'Resetting with "Yellow" by Coldplay.',
                    'Okay, next up is "Yellow" by Coldplay.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        eventType: "user_skip",
        djID: "luna",
        candidateCount: 5,
        fromTrack: {
          isrc: "US1",
          title: "Fix You",
          artist: "Coldplay",
        },
        toTrack: {
          isrc: "US2",
          title: "Yellow",
          artist: "Coldplay",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLines: string[]; llmModel: string };

    expect(response.status).toBe(200);
    expect(payload.djLines.length).toBeGreaterThanOrEqual(3);
    expect(payload.djLines.every((line) => line.split(/\s+/).filter(Boolean).length <= 15)).toBe(true);
    expect(payload.djLines.every((line) => line.includes("Yellow") && line.includes("Coldplay"))).toBe(true);
    expect(payload.llmModel.length).toBeGreaterThan(0);
  });

  it("returns 204 when LLM output fails validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    "This line is too long and totally ignores the hard cap while also skipping required names",
                    "Another invalid output",
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        eventType: "user_skip",
        djID: "casey",
        fromTrack: {
          isrc: "US1",
          title: "Fix You",
          artist: "Coldplay",
        },
        toTrack: {
          isrc: "US2",
          title: "Yellow",
          artist: "Coldplay",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Skip-Line-Reason")).toBe("llm_rejected");
  });

  it("returns 401 without app token", async () => {
    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fromTrack: {
          isrc: "US1",
          title: "Fix You",
          artist: "Coldplay",
        },
        toTrack: {
          isrc: "US2",
          title: "Yellow",
          artist: "Coldplay",
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
