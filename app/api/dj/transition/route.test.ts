import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("POST /api/dj/transition", () => {
  const appToken = "test-app-token";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WAIV_API_APP_TOKEN = appToken;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  });

  afterEach(() => {
    delete process.env.WAIV_API_APP_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("sends bridge-variation instructions to Anthropic", async () => {
    let anthropicBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      anthropicBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return jsonResponse({
        content: [
          {
            type: "text",
            text: "Quick reset, now it's \"Reckoner\" by Radiohead. This is W.A.I.V.",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/transition", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "casey",
        sessionPosition: 6,
        trigger: "auto",
        fromTrack: {
          title: "Yellow",
          artist: "Coldplay",
          isrc: "GBAYE0000001",
        },
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string; llmModel: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(systemPrompt).toContain('Do not default to a "that was X, this is Y" structure');
    expect(systemPrompt).toContain("Vary your bridge structures so they feel like a real live DJ");
    expect(systemPrompt).toContain("sometimes a tonal pivot");
    expect(systemPrompt).toContain("You may naturally reference time context when it genuinely fits the moment");
    expect(systemPrompt).toContain("Treat time context as optional color, not a requirement");
  });

  it("enforces the station-tag ending even when the model omits it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'No need to over-explain this one, "Reckoner" by Radiohead just knows how to hover',
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/transition", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "jack",
        sessionPosition: 7,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string; llmModel: string };

    expect(response.status).toBe(200);
    expect(payload.djLine).toMatch(/W\.A\.I\.V\./);
    expect(payload.llmModel.length).toBeGreaterThan(0);
  });
});
