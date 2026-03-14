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

  it("sends April-specific personality guidance for casey skip lines", async () => {
    let anthropicBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("api.anthropic.com")) {
          return new Response(null, { status: 404 });
        }

        anthropicBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'That one drifted. Try "Yellow" by Coldplay.',
                    'Too soft there. Try "Yellow" by Coldplay.',
                    'Not quite the shape. Try "Yellow" by Coldplay.',
                    'Let us tighten it with "Yellow" by Coldplay.',
                    'Better weight here: "Yellow" by Coldplay.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
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
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("You are April, the DJ represented by the internal id 'casey' in WAIV.");
    expect(systemPrompt).toContain("You care about sequencing, fit, tension, and how a track lands in a set.");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("do not make every skip line sound sharpened into a joke");
    expect(systemPrompt).toContain("Never use bro-y slang");
    expect(systemPrompt).toContain("April should sound lightly amused, observant, and musically intentional.");
  });

  it("sends Luna-specific personality guidance for luna skip lines", async () => {
    let anthropicBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("api.anthropic.com")) {
          return new Response(null, { status: 404 });
        }

        anthropicBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'Not this one. "Yellow" by Coldplay feels steadier.',
                    'Let’s soften the turn with "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay settles in better here.',
                    'A quieter correction: "Yellow" by Coldplay.',
                    'Try "Yellow" by Coldplay here instead.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
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
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("You are Luna, the DJ represented by the internal id 'luna' in WAIV.");
    expect(systemPrompt).toContain("Small voice, big feelings");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep Luna soft and emotionally specific, but grounded and concrete rather than vague or dreamy for its own sake.");
    expect(systemPrompt).toContain("Luna should sound calm, intuitive, and emotionally specific.");
    expect(systemPrompt).toContain("Avoid vague moonlight poetry");
  });

  it("sends Marcus-specific personality guidance for marcus skip lines", async () => {
    let anthropicBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("api.anthropic.com")) {
          return new Response(null, { status: 404 });
        }

        anthropicBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'That lost momentum. Try "Yellow" by Coldplay.',
                    'Better pressure here with "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay lands cleaner right now.',
                    'This move hits harder with "Yellow" by Coldplay.',
                    'Bring "Yellow" by Coldplay in here.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );

    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        eventType: "user_skip",
        djID: "marcus",
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
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("You are Marcus, the DJ represented by the internal id 'marcus' in WAIV.");
    expect(systemPrompt).toContain("You care about momentum, impact, pressure, and when a track should arrive cleanly.");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep Marcus confident and rhythmic, but not like a hype-man or announcer.");
    expect(systemPrompt).toContain("Marcus should sound confident, quick, and musically intentional.");
    expect(systemPrompt).toContain("Avoid hype-man shouting, sports metaphors, locker-room phrasing, and generic radio filler.");
  });

  it("retries April skip generation when the first LLM output is invalid", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    "Not that one.",
                    "Too soft there.",
                    "Try this instead.",
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'Not the shape. Try "Yellow" by Coldplay.',
                    'Too loose there. Try "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay should sit better here.',
                    'Try "Yellow" by Coldplay instead.',
                    'Let "Yellow" by Coldplay take it from here.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        eventType: "user_skip",
        djID: "casey",
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
    const payload = (await response.json()) as { djLines: string[] };

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.djLines.length).toBeGreaterThanOrEqual(3);
    expect(payload.djLines.every((line) => line.includes("Yellow") && line.includes("Coldplay"))).toBe(true);
  });

  it("retries Luna skip generation when the first LLM output is invalid", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    "Not this.",
                    "Try this instead.",
                    "Better one coming.",
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'Not this one. "Yellow" by Coldplay feels steadier.',
                    'Let’s soften the turn with "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay settles in better here.',
                    'A quieter correction: "Yellow" by Coldplay.',
                    'Try "Yellow" by Coldplay here instead.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

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
    const payload = (await response.json()) as { djLines: string[] };

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.djLines.length).toBeGreaterThanOrEqual(3);
    expect(payload.djLines.every((line) => line.includes("Yellow") && line.includes("Coldplay"))).toBe(true);
  });

  it("retries Marcus skip generation when the first LLM output is invalid", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    "Not that one.",
                    "Try this instead.",
                    "Something stronger.",
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  lines: [
                    'That lost momentum. Try "Yellow" by Coldplay.',
                    'Better pressure here with "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay lands cleaner right now.',
                    'This move hits harder with "Yellow" by Coldplay.',
                    'Bring "Yellow" by Coldplay in here.',
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/skip-lines/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        eventType: "user_skip",
        djID: "marcus",
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
    const payload = (await response.json()) as { djLines: string[] };

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.djLines.length).toBeGreaterThanOrEqual(3);
    expect(payload.djLines.every((line) => line.includes("Yellow") && line.includes("Coldplay"))).toBe(true);
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
