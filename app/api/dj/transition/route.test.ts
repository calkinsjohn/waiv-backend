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
        avoidRecentLines: [
          'That opens the door for "High and Dry" by Radiohead. This is W.A.I.V.',
        ],
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
    const messageContent = JSON.stringify((anthropicBody?.messages as Array<{ content?: string }> | undefined)?.[0]?.content ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(systemPrompt).toContain('Do not default to a "that was X, this is Y" structure');
    expect(systemPrompt).toContain("Vary your bridge structures so they feel like a real live DJ");
    expect(systemPrompt).toContain("sometimes a tonal pivot");
    expect(systemPrompt).toContain("You may naturally reference time context when it genuinely fits the moment");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep April calm, understated, and conversational.");
    expect(systemPrompt).toContain("Favor smooth sentence endings over too many trailing fragments or ellipses.");
    expect(systemPrompt).toContain("Treat time context as optional color, not a requirement");
    expect(systemPrompt).toContain("If recent bridge lines are provided, treat them as anti-patterns for this turn");
    expect(systemPrompt).toContain('Do not open with overused reflective stems like "There\'s something about..."');
    expect(systemPrompt).toContain('If your first instinct is "There\'s something about..."');
    expect(messageContent).toContain("Recently used bridge lines to avoid echoing");
  });

  it("sends John-specific bridge guidance for jack transitions", async () => {
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
            text: 'This one slides in beautifully here, "Reckoner" by Radiohead. This is W.A.I.V.',
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
        sessionPosition: 4,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(systemPrompt).toContain("DJ-specific bridge guidance for John");
    expect(systemPrompt).toContain("NPR-style music host energy");
    expect(systemPrompt).toContain("You are John, an AI DJ host in WAIV.");
    expect(systemPrompt).toContain("Keep John calm, tasteful, and naturally cool");
    expect(systemPrompt).toContain("big sports fan, especially baseball");
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

  it("collapses duplicated ending phrases before appending the station tag", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'This one carries the right kind of weight for the room, "Reckoner" by Radiohead, this one carries the right kind of weight for the room.',
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
        djID: "miles",
        sessionPosition: 11,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain('This one carries the right kind of weight for the room, "Reckoner" by Radiohead.');
    expect(payload.djLine.toLowerCase()).not.toContain('room, this one carries the right kind of weight for the room');
  });

  it("strips gibberish suffix fragments before appending the station tag", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'Everything cools off a little before "Reckoner" by Radiohead. skrrrttt',
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
        sessionPosition: 5,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain('Everything cools off a little before "Reckoner" by Radiohead.');
    expect(payload.djLine.toLowerCase()).not.toContain("skrrrttt");
  });

  it("strips junk that appears before a model-supplied station signoff", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'Everything cools off a little before "Reckoner" by Radiohead. skrrrttt This is W.A.I.V.',
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
        sessionPosition: 5,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain('Everything cools off a little before "Reckoner" by Radiohead.');
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(payload.djLine.toLowerCase()).not.toContain("skrrrttt");
    expect(payload.djLine).not.toContain("..");
  });

  it("strips improvised WAIV ending variants before appending a clean station tag", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'Everything cools off a little before "Reckoner" by Radiohead. Right here with W.A.I.V tonight, for the people in the back.',
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
        sessionPosition: 5,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain('Everything cools off a little before "Reckoner" by Radiohead.');
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(payload.djLine.toLowerCase()).not.toContain("for the people in the back");
    expect(payload.djLine.toLowerCase()).not.toContain("tonight");
  });

  it("includes Robert's deadpan synthetic personality instructions", async () => {
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
            text: 'Everything appears stable enough for "Reckoner" by Radiohead. This is W.A.I.V.',
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
        djID: "robert",
        sessionPosition: 4,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("You are R0B-3RT, pronounced Robert");
    expect(systemPrompt).toContain("never intentionally joke about being a robot");
    expect(systemPrompt).toContain("slightly paranoid, mildly irritated, and unintentionally funny");
  });

  it("rejects overused opener shapes so the client can fall back locally", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'There\'s something about "Reckoner" by Radiohead that just hangs in the air.',
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
        djID: "luna",
        sessionPosition: 9,
        trigger: "auto",
        toTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Transition-Reason")).toBe("llm_rejected");
  });

  it("includes Rafa-specific bridge guidance in the transition prompt", async () => {
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
            text: 'A little more glow on this turn, "Night Drive" by Chromatics. This is W.A.I.V.',
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
        djID: "miles",
        sessionPosition: 11,
        trigger: "auto",
        toTrack: {
          title: "Night Drive",
          artist: "Chromatics",
          isrc: "USCA29999999",
        },
      }),
    });

    const response = await POST(request);
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("DJ-specific bridge guidance for Rafa");
    expect(systemPrompt).toContain("Favor mood, momentum, glow, shape, presence, and after-hours confidence");
    expect(systemPrompt).toContain("A little more glow on this turn, vamos");
  });

  it("includes Tiffany-specific bridge guidance in the transition prompt", async () => {
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
            text: 'Okay, this next one is a whole mood: "Midnight City" by M83. This is W.A.I.V.',
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
        djID: "tiffany",
        sessionPosition: 8,
        trigger: "auto",
        toTrack: {
          title: "Midnight City",
          artist: "M83",
          isrc: "USUG11111111",
        },
      }),
    });

    const response = await POST(request);
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("DJ-specific bridge guidance for Tiffany");
    expect(systemPrompt).toContain("avoid social-caption language");
    expect(systemPrompt).toContain("Set the mood first, then add a playful influencer-style observation");
    expect(systemPrompt).toContain("The algorithm actually delivered a moment here");
  });
});
