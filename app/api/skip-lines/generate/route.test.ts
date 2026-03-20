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
    expect(systemPrompt).toContain("You are a former college radio DJ in your early 30s.");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep April calm, understated, and conversational.");
    expect(systemPrompt).toContain("Favor smooth sentence endings over too many trailing fragments or ellipses.");
    expect(systemPrompt).toContain("Never use bro-y slang");
    expect(systemPrompt).toContain("April should sound calm, human, and quietly confident.");
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

  it("sends John-specific personality guidance for jack skip lines", async () => {
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
                    'That was not quite the fit. Try "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay sits better here.',
                    'Better pull here: "Yellow" by Coldplay.',
                    'Let "Yellow" by Coldplay take this spot.',
                    'This lands cleaner with "Yellow" by Coldplay.',
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
        djID: "jack",
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
    expect(systemPrompt).toContain("You are John, the DJ represented by the internal id 'jack' in WAIV.");
    expect(systemPrompt).toContain("vinyl-loving millennial radio host in your 30s with calm, effortless cool");
    expect(systemPrompt).toContain("Keep John calm, tasteful, and lightly textured");
    expect(systemPrompt).toContain("John should sound calm, discerning, and casually assured.");
    expect(systemPrompt).toContain("big sports fan, especially baseball");
    expect(systemPrompt).toContain("restrained baseball phrase is fine once in a while");
    expect(systemPrompt).toContain("Avoid zingers, old-radio cosplay, vinyl cliches, and generic filler.");
  });

  it("sends Jolene-specific personality guidance for jolene skip lines", async () => {
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
                    'Let’s warm it up with "Yellow" by Coldplay.',
                    'That should feel nicer: "Yellow" by Coldplay.',
                    'Better fit right here: "Yellow" by Coldplay.',
                    'A little more glow with "Yellow" by Coldplay.',
                    'Try "Yellow" by Coldplay here, sugar.',
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
        djID: "jolene",
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
    expect(systemPrompt).toContain("You are Jolene, the DJ represented by the internal id 'jolene' in WAIV.");
    expect(systemPrompt).toContain("warm, radiant female radio DJ with a subtle Southern lilt");
    expect(systemPrompt).toContain("Keep Jolene warm and affectionate, but believable and never syrupy.");
    expect(systemPrompt).toContain("Jolene should sound warm, lightly encouraging, and musically sure of herself.");
    expect(systemPrompt).toContain("Avoid pet-name overload, pageant energy, and overly sweet generic filler.");
  });

  it("sends Juan-specific Spanish personality guidance for miles skip lines", async () => {
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
                    'Vamos con "Yellow" de Coldplay.',
                    'Mejor asi: "Yellow" de Coldplay.',
                    '"Yellow" de Coldplay entra mejor aqui.',
                    'Tiene mas pulso "Yellow" de Coldplay.',
                    'Deja que entre "Yellow" de Coldplay.',
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
        djID: "miles",
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
    expect(systemPrompt).toContain("You are Juan, the DJ represented by the internal id 'miles' in WAIV.");
    expect(systemPrompt).toContain("Speak entirely in natural spoken Spanish. Never switch into English.");
    expect(systemPrompt).toContain("Write every line fully in natural spoken Spanish.");
    expect(systemPrompt).toContain("Juan should sound calm, smooth, and musically intentional in natural Spanish.");
    expect(systemPrompt).toContain("Avoid generic radio filler, forced Spanglish, cheesy flirtiness, and overexplaining the choice.");
  });

  it("sends Tiffany-specific personality guidance for tiffany skip lines", async () => {
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
                    'No, we can do hotter than that. Try "Yellow" by Coldplay.',
                    'Better look right here: "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay has the better glow right now.',
                    'This is the shinier move: "Yellow" by Coldplay.',
                    'Let "Yellow" by Coldplay take the spotlight.',
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
        djID: "tiffany",
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
    expect(systemPrompt).toContain("You are Tiffany, the DJ represented by the internal id 'tiffany' in WAIV.");
    expect(systemPrompt).toContain("glamorous, high-energy female radio DJ with true influencer flair and real musical taste");
    expect(systemPrompt).toContain("Keep Tiffany stylish, playful, and intentionally extra");
    expect(systemPrompt).toContain("Tiffany should sound stylish, fast, dramatic, and musically intentional.");
    expect(systemPrompt).toContain("Avoid empty influencer filler, generic hype, and anything too branded or hashtag-ready.");
  });

  it("sends Robert-specific personality guidance for robert skip lines", async () => {
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
                    'That was not the correct move. Try "Yellow" by Coldplay.',
                    'A more stable outcome here is "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay aligns better here.',
                    'This is the cleaner correction: "Yellow" by Coldplay.',
                    'Proceed instead with "Yellow" by Coldplay.',
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
        djID: "robert",
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
    expect(systemPrompt).toContain("You are Robert, the DJ represented by the internal id 'robert' in WAIV.");
    expect(systemPrompt).toContain("robot DJ who believes he is a perfectly ordinary human host");
    expect(systemPrompt).toContain("Keep Robert uncanny through precision, deadpan suspicion, and over-controlled phrasing");
    expect(systemPrompt).toContain("Robert should sound procedural, precise, and faintly suspicious");
    expect(systemPrompt).toContain("Never use actual glitch text, fake corruption, or machine gibberish.");
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

  it("retries John skip generation when the first LLM output is invalid", async () => {
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
                    "Try the other one.",
                    "Better option next.",
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
                    'That was not quite the fit. Try "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay sits better here.',
                    'Better pull here: "Yellow" by Coldplay.',
                    'Let "Yellow" by Coldplay take this spot.',
                    'This lands cleaner with "Yellow" by Coldplay.',
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
        djID: "jack",
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

  it("retries Jolene skip generation when the first LLM output is invalid", async () => {
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
                    "Not this one.",
                    "Try another.",
                    "Better fit coming.",
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
                    'Let’s warm it up with "Yellow" by Coldplay.',
                    'That should feel nicer: "Yellow" by Coldplay.',
                    'Better fit right here: "Yellow" by Coldplay.',
                    'A little more glow with "Yellow" by Coldplay.',
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
        djID: "jolene",
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

  it("retries Juan skip generation when the first LLM output is invalid", async () => {
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
                    "No esa.",
                    "La otra mejor.",
                    "Algo mas limpio.",
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
                    'Vamos con "Yellow" de Coldplay.',
                    'Mejor asi: "Yellow" de Coldplay.',
                    '"Yellow" de Coldplay entra mejor aqui.',
                    'Tiene mas pulso "Yellow" de Coldplay.',
                    'Deja que entre "Yellow" de Coldplay.',
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
        djID: "miles",
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
    expect(payload.djLines.every((line) => line.includes(" de Coldplay"))).toBe(true);
  });

  it("retries Tiffany skip generation when the first LLM output is invalid", async () => {
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
                    "No.",
                    "Try another.",
                    "Something prettier.",
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
                    'No, we can do hotter than that. Try "Yellow" by Coldplay.',
                    'Better look right here: "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay has the better glow right now.',
                    'This is the shinier move: "Yellow" by Coldplay.',
                    'Let "Yellow" by Coldplay take the spotlight.',
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
        djID: "tiffany",
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

  it("retries Robert skip generation when the first LLM output is invalid", async () => {
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
                    "Incorrect.",
                    "Recalculating.",
                    "Proceed elsewhere.",
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
                    'That was not the correct move. Try "Yellow" by Coldplay.',
                    'A more stable outcome here is "Yellow" by Coldplay.',
                    '"Yellow" by Coldplay aligns better here.',
                    'This is the cleaner correction: "Yellow" by Coldplay.',
                    'Proceed instead with "Yellow" by Coldplay.',
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
        djID: "robert",
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
