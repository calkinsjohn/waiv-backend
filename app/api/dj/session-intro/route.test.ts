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

describe("POST /api/dj/session-intro", () => {
  const appToken = "test-app-token";
  const listenerContext = {
    localTimestamp: "2026-03-12T22:00:00-04:00",
    timeZoneIdentifier: "America/Indiana/Indianapolis",
    weekday: "Thursday",
    month: "March",
    dayOfMonth: 12,
    year: 2026,
    hour24: 22,
    timeOfDay: "night",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WAIV_API_APP_TOKEN = appToken;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  });

  afterEach(() => {
    delete process.env.WAIV_API_APP_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("sends first-listen guidance for April intros", async () => {
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
            text: `Hey, I’m April.

Thursday night on W.A.I.V. feels right when a first song earns its place.

We’re opening with "Yellow" by Coldplay. Stay with me.`,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/session-intro", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "casey",
        introKind: "first_listen_ever",
        firstTrack: {
          title: "Yellow",
          artist: "Coldplay",
          isrc: "GBAYE0000001",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string; llmModel: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Yellow");
    expect(payload.intro).toContain("Coldplay");
    expect(systemPrompt).toContain("This is the listener's very first session on WAIV.");
    expect(systemPrompt).toContain("You are April, the DJ represented by the internal id 'casey' in WAIV.");
    expect(systemPrompt).toContain("The listener's local time is 2026-03-12T22:00:00-04:00 in America/Indiana/Indianapolis.");
    expect(systemPrompt).toContain('such as "night", "tonight", "late night", "this late"');
    expect(systemPrompt).toContain("Do not default to opening every intro with the same weekday-plus-time phrase.");
    expect(systemPrompt).toContain("Do not start with clipped fragment openers like 'Late tonight,' 'Thursday night,' or 'At this hour,' on their own.");
  });

  it("rejects generated intros with the wrong time of day for the listener", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: `Good morning. I’m April.

It’s a clean place to start with Yellow by Coldplay tonight.`,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/session-intro", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "casey",
        introKind: "standard",
        firstTrack: {
          title: "Yellow",
          artist: "Coldplay",
          isrc: "GBAYE0000001",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Session-Intro-Reason")).toBe("llm_rejected");
  });

  it("rejects generated intros that omit the song details", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: `Hey, I’m April.

Let’s start carefully tonight.`,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/session-intro", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "casey",
        introKind: "standard",
        firstTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Session-Intro-Reason")).toBe("llm_rejected");
  });

  it("returns no content when the Anthropic key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const request = new NextRequest("http://localhost/api/dj/session-intro", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djID: "casey",
        introKind: "standard",
        firstTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Session-Intro-Reason")).toBe("no_api_key");
  });
});
