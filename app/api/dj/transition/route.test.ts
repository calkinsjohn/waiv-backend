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
        showBeat: "midpoint_refocus",
        currentShowState: "building",
        trigger: "auto",
        avoidRecentLines: [
          'That opens the door for "High and Dry" by Radiohead. This is W.A.I.V.',
        ],
        showMemory: {
          recentLines: ['This one slides in beautifully here, "Reckoner" by Radiohead. This is W.A.I.V.'],
          recentShowStates: ["opening", "settling"],
          recentArtists: ["Coldplay"],
        },
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
    expect(systemPrompt).toContain('Avoid defaulting to a bare "that was X, this is Y" structure');
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
    expect(systemPrompt).toContain("Every bridge should do one clear host move");
    expect(systemPrompt).toContain("Every bridge should include at least one concrete anchor");
    expect(systemPrompt).toContain("Do not use abstract taste-language as filler");
    expect(systemPrompt).toContain('Avoid empty approval language like "this feels right"');
    expect(systemPrompt).toContain("Current show state: building");
    expect(systemPrompt).toContain("Current semantic show beat: midpoint_refocus");
    expect(systemPrompt).toContain("Semantic show beat: midpoint refocus.");
    expect(systemPrompt).toContain("Semantic beat policy: midpoint refocus.");
    expect(systemPrompt).toContain("Treat the semantic show beat as an editorial policy, not a vibe adjective.");
    expect(systemPrompt).toContain("Required host move: re-center the show with quiet authority");
    expect(systemPrompt).toContain("April beat policy for midpoint refocus:");
    expect(systemPrompt).toContain("Show memory:");
    expect(systemPrompt).toContain("Recent spoken lines to avoid echoing");
    expect(messageContent).toContain("Recently used bridge lines to avoid echoing");
    expect(messageContent).toContain("Current semantic show beat: midpoint_refocus");
    expect(messageContent).toContain("Current show state: building");
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

  it("adds persona beat policy for other DJs too, not just April", async () => {
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
            text: 'The last stretch points straight at "Reckoner" by Radiohead. This is W.A.I.V.',
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
        sessionPosition: 12,
        showBeat: "closing_reach",
        currentShowState: "late_run",
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
    expect(systemPrompt).toContain("Semantic beat policy: closing reach.");
    expect(systemPrompt).toContain("Robert beat policy for closing reach:");
    expect(systemPrompt).toContain("Allowed moves: a precise last-stretch cue, a controlled near-wrap signal, a final-shape handoff");
  });

  it("repairs April when the first attempt drifts into abstract filler", async () => {
    const anthropicBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      anthropicBodies.push(parsed);

      if (anthropicBodies.length === 1) {
        return jsonResponse({
          content: [
            {
              type: "text",
              text: 'This leaves a little more space around the edges for "Reckoner" by Radiohead. This is W.A.I.V.',
            },
          ],
        });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'After Coldplay left the room open, "Reckoner" by Radiohead is the right turn here. This is W.A.I.V.',
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
        showBeat: "connective_tissue",
        currentShowState: "settling",
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
    const payload = (await response.json()) as { djLine: string };
    const repairSystemPrompt = String(anthropicBodies[1]?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain('After Coldplay left the room open, "Reckoner" by Radiohead is the right turn here.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(repairSystemPrompt).toContain("Rewrite April as one calm, continuous thought with a concrete reason the turn belongs.");
    expect(repairSystemPrompt).toContain("It gives April abstract fake-depth language instead of a concrete reason the transition belongs.");
  });

  it("repairs Tiffany when the first attempt slips into caption language", async () => {
    const anthropicBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      anthropicBodies.push(parsed);

      if (anthropicBodies.length === 1) {
        return jsonResponse({
          content: [
            {
              type: "text",
              text: 'Okay, it\'s giving main character energy with "Style" by Taylor Swift. This is W.A.I.V.',
            },
          ],
        });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'After that turn, "Style" by Taylor Swift is the cleanest bright move in the room. This is W.A.I.V.',
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
        sessionPosition: 7,
        showBeat: "lane_reveal",
        currentShowState: "building",
        trigger: "auto",
        fromTrack: {
          title: "Cruel Summer",
          artist: "Taylor Swift",
          isrc: "USUG11901473",
        },
        toTrack: {
          title: "Style",
          artist: "Taylor Swift",
          isrc: "USCJY1431349",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string };
    const repairSystemPrompt = String(anthropicBodies[1]?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("Style");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(repairSystemPrompt).toContain("Rewrite Tiffany stylish and sharp, but make it sound like spoken radio rather than a social caption.");
    expect(repairSystemPrompt).toContain("It slips into Tiffany caption-language instead of a real radio line.");
  });

  it("uses semantic move memory to repair repeated host-move logic", async () => {
    const anthropicBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      anthropicBodies.push(parsed);

      if (anthropicBodies.length === 1) {
        return jsonResponse({
          content: [
            {
              type: "text",
              text: 'Wanted "Reckoner" by Radiohead here because it feels like the right move now. This is W.A.I.V.',
            },
          ],
        });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'After Coldplay left the room open, "Reckoner" by Radiohead is the cleaner way forward here. This is W.A.I.V.',
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
        sessionPosition: 4,
        showBeat: "connective_tissue",
        currentShowState: "settling",
        trigger: "auto",
        showMemory: {
          recentHostMoves: ["curation_choice"],
          recentMoveSignatures: ["curation_choice|connective_tissue|settling"],
        },
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
    const payload = (await response.json()) as { djLine: string };
    const firstPrompt = String(anthropicBodies[0]?.system ?? "");
    const repairPrompt = String(anthropicBodies[1]?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("cleaner way forward");
    expect(firstPrompt).toContain("Recent host moves already used: curation_choice");
    expect(firstPrompt).toContain("Recent semantic move signatures to avoid repeating: curation_choice|connective_tissue|settling");
    expect(repairPrompt).toContain("It repeats the same kind of host move the DJ used recently.");
    expect(repairPrompt).toContain("It repeats a recent semantic transition pattern too closely.");
  });

  it("adds planned show-moment guidance for first handoffs", async () => {
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
            text: 'This felt like the right second move, "Reckoner" by Radiohead. This is W.A.I.V.',
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
        sessionPosition: 2,
        showMomentType: "first_handoff",
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
    const payload = (await response.json()) as { djLine: string };
    const systemPrompt = String(anthropicBody?.system ?? "");
    const messageContent = JSON.stringify((anthropicBody?.messages as Array<{ content?: string }> | undefined)?.[0]?.content ?? "");

    expect(response.status).toBe(200);
    expect(payload.djLine).toContain("W.A.I.V.");
    expect(systemPrompt).toContain("Planned show moment: first handoff.");
    expect(systemPrompt).toContain("Make the second song feel intentionally placed");
    expect(systemPrompt).toContain("Make it clear this is the second move of the show");
    expect(systemPrompt).toContain("Allow a tiny amount of real-person imperfection");
    expect(messageContent).toContain("Planned show moment: first_handoff");
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

  it("rejects abstract platitude bridges", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: 'The vibe shifts nicely into "Reckoner" by Radiohead. This is W.A.I.V.',
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
    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Transition-Reason")).toBe("llm_rejected");
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
            text: 'I wanted "Reckoner" by Radiohead right here, I wanted "Reckoner" by Radiohead right here.',
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
    expect(payload.djLine).toContain('I wanted "Reckoner" by Radiohead right here.');
    expect(payload.djLine.toLowerCase()).not.toContain('right here, i wanted "reckoner" by radiohead right here');
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
    expect(systemPrompt).toContain("Favor clean confidence and after-hours presence, not decorative mood-writing");
    expect(systemPrompt).toContain("Seguimos por aquí con [song] by [artist]. This is W.A.I.V.");
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
    expect(systemPrompt).toContain("keep the line rooted in an actual choice, reaction, or contrast");
    expect(systemPrompt).toContain("The algorithm actually did its job here");
  });
});
