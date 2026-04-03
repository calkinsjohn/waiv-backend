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

function structuredIntroText(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    intro: "Good to have you back. April with you tonight, and Thursday night is moving slow enough that I wanted to start with one you know. Here's \"Yellow\" by Coldplay.",
    metadata: {
      openingStyle: "direct",
      length: "medium",
      stationStyle: "WAIV",
      handoffStyle: "clean",
                timeAnchor: "Thursday night is moving slow enough that I wanted to start with one you know.",
      curationAngle: "Wanted to start with one you know.",
      emotionalTone: "cool",
      vocabulary: ["slow", "clean", "familiar"],
      usedTimeReference: true,
      usedAISelfAwareness: false,
      ...((overrides.metadata as Record<string, unknown> | undefined) ?? {}),
    },
    ...overrides,
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

  it("sends a radio-opening framework prompt for April and accepts structured JSON output", async () => {
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
            text: structuredIntroText({
              intro: "Good to have you back. April with you tonight, and Thursday night is moving slow enough that I wanted to start with one you know. Here's \"Yellow\" by Coldplay.",
              metadata: {
                curationAngle: "Wanted to start with one you know.",
              },
            }),
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
        showContext: {
          djId: "casey",
          sessionType: "first_ever_session",
          timeContext: {
            timeOfDay: "night",
            dayOfWeek: "thursday",
            isWeekend: false,
            label: "Thursday night",
          },
          setContext: {
            openingTrackRole: "confident_opener",
            openingTrackMood: ["intentional", "steady"],
            openingTrackEnergy: 0.56,
            openingTrackTexture: ["familiar", "curated"],
            openingTrackFamiliarity: "highly_familiar",
            openingTrackDiscoveryMode: "confident_return",
          },
          listenerContext: {
            isFirstSessionToday: true,
            returningAfterGap: false,
            changedDjsRecently: false,
            skipsIntrosOften: false,
          },
          environmentContext: {
            season: "spring",
            weatherVibe: null,
            localeVibe: null,
          },
          recentHistory: {
            recentArchetypes: [],
            recentOpeningStructures: [],
            recentOpeningPhrases: [],
            recentSentenceCounts: [],
            recentHandoffStyles: [],
            recentVocabulary: [],
            recentEmotionalTones: [],
            recentOpeningStyles: [],
            recentLengths: [],
            recentStationStyles: [],
            usedTimeReferenceRecently: false,
            usedAISelfAwarenessRecently: false,
          },
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string; metadata: { openingStyle: string; length: string } };
    const systemPrompt = String(anthropicBody?.system ?? "");
    const userPrompt = String(((anthropicBody?.messages as Array<{ content?: string }> | undefined) ?? [])[0]?.content ?? "");
    const fullPrompt = `${systemPrompt} ${userPrompt}`;

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Yellow");
    expect(payload.intro).toContain("Coldplay");
    expect(payload.metadata.openingStyle).toBe("direct");
    expect(payload.metadata.length).toBe("medium");
    expect(fullPrompt).toContain("This is radio, not assistant UX.");
    expect(fullPrompt).toContain("Build the intro from these 5 radio layers");
    expect(fullPrompt).toContain("\"openingStyle\":");
    expect(fullPrompt).toContain("\"length\":\"medium\"");
    expect(fullPrompt).toContain("The opener is highly familiar. Lean into confidence, comfort, recognition, and return.");
    expect(fullPrompt).toContain("April is the DJ represented by the internal id 'casey' in WAIV.");
    expect(fullPrompt).toContain("The 5 layers are internal structure, not isolated fragments.");
    expect(fullPrompt).toContain("Opening production policy for April.");
    expect(fullPrompt).toContain("Allowed moves: a dry human welcome, a light \"we're back\" cue, one concrete curation reason that carries the whole intro, and a clean handoff.");
    expect(fullPrompt).toContain("Return strict JSON with exactly these keys");
  });

  it("treats just-after-midnight intros as the previous radio night in the prompt context", async () => {
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
            text: structuredIntroText({
              intro: "Good to have you back. April with you tonight, and Friday night still has enough motion in it that the first record can arrive carrying some lift. Here's \"Midnight City\" by M83.",
              metadata: {
                timeAnchor: "Friday night still has enough motion in it that the first record can arrive already carrying some lift.",
              },
            }),
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
          title: "Midnight City",
          artist: "M83",
          isrc: "USUG11100598",
        },
        listenerContext: {
          localTimestamp: "2026-03-14T00:30:00-04:00",
          timeZoneIdentifier: "America/Indiana/Indianapolis",
          weekday: "Saturday",
          month: "March",
          dayOfMonth: 14,
          year: 2026,
          hour24: 0,
          timeOfDay: "night",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const userPrompt = String(((anthropicBody?.messages as Array<{ content?: string }> | undefined) ?? [])[0]?.content ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Midnight City");
    expect(userPrompt).toContain("Friday night");
    expect(userPrompt).not.toContain("Saturday night");
  });

  it("frames exploratory openings differently for Luna", async () => {
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
            text: structuredIntroText({
              intro: "Late one tonight. You're with Luna tonight. Right about the part of the night where everything softens. Trust me on the first move. I wanted the set to begin with a little curiosity in it, not a lot of explanation. Let's open with \"Reckoner\" by Radiohead.",
              metadata: {
                openingStyle: "atmospheric",
                length: "medium",
                stationStyle: "omit_station_once_in_awhile",
                handoffStyle: "understated",
                emotionalTone: "quiet",
              },
            }),
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
        djID: "luna",
        introKind: "standard",
        firstTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
        listenerContext,
        showContext: {
          djId: "luna",
          sessionType: "fresh_start",
          timeContext: {
            timeOfDay: "night",
            dayOfWeek: "thursday",
            isWeekend: false,
            label: "Thursday night",
          },
          setContext: {
            openingTrackRole: "intimate_low_key_open",
            openingTrackMood: ["close", "soft"],
            openingTrackEnergy: 0.32,
            openingTrackTexture: ["discovery", "textured"],
            openingTrackFamiliarity: "exploratory",
            openingTrackDiscoveryMode: "trust_the_turn",
          },
          listenerContext: {
            isFirstSessionToday: false,
            returningAfterGap: false,
            changedDjsRecently: false,
            skipsIntrosOften: false,
          },
          environmentContext: {
            season: "spring",
            weatherVibe: null,
            localeVibe: null,
          },
          recentHistory: {
            recentArchetypes: [],
            recentOpeningStructures: [],
            recentOpeningPhrases: [],
            recentSentenceCounts: [],
            recentHandoffStyles: [],
            recentVocabulary: [],
            recentEmotionalTones: [],
            recentOpeningStyles: [],
            recentLengths: [],
            recentStationStyles: [],
            usedTimeReferenceRecently: false,
            usedAISelfAwarenessRecently: false,
          },
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { metadata: { openingStyle: string; handoffStyle: string } };
    const fullPrompt = [
      String(anthropicBody?.system ?? ""),
      String(((anthropicBody?.messages as Array<{ content?: string }> | undefined) ?? [])[0]?.content ?? ""),
    ].join(" ");

    expect(response.status).toBe(200);
    expect(payload.metadata.openingStyle).toBe("atmospheric");
    expect(payload.metadata.handoffStyle).toBe("understated");
    expect(fullPrompt).toContain("The opener is exploratory. Lean into intrigue, curiosity, trust, and discovery.");
    expect(fullPrompt).toContain("Luna is the DJ represented by the internal id 'luna' in WAIV.");
    expect(fullPrompt).toContain("Opening production policy for Luna.");
    expect(fullPrompt).toContain("Allowed moves: an intimate welcome, soft presence, one emotionally or sequentially precise reason, and a minimal handoff.");
  });

  it("threads semantic move memory into the intro prompt", async () => {
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
            text: structuredIntroText(),
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
        showMemory: {
          recentHostMoves: ["discovery_turn", "warm_welcome"],
          recentMoveSignatures: ["discovery_turn|curious_first_turn|opening"],
        },
      }),
    });

    const response = await POST(request);
    const fullPrompt = [
      String(anthropicBody?.system ?? ""),
      String(((anthropicBody?.messages as Array<{ content?: string }> | undefined) ?? [])[0]?.content ?? ""),
    ].join(" ");

    expect([200, 204]).toContain(response.status);
    expect(fullPrompt).toContain("Recent host moves already used: discovery_turn, warm_welcome");
    expect(fullPrompt).toContain("Recent semantic move signatures to avoid repeating: discovery_turn|curious_first_turn|opening");
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
            text: structuredIntroText({
              intro: "Good morning. April here, on WAIV. Morning already has some shape to it. Wanted to start somewhere familiar. Let's open with \"Yellow\" by Coldplay.",
            }),
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
            text: structuredIntroText({
              intro: "Alright. April here, on WAIV. Thursday night feels slow enough that we can start without forcing the room awake. Wanted to start somewhere familiar. This is where we begin.",
            }),
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
  });

  it("rejects social-caption style structured intros", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.anthropic.com")) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        content: [
          {
            type: "text",
            text: structuredIntroText({
              intro: "Alright. Tiffany here, on W.A.I.V. Late enough to start with a little style. This is such a vibe and it totally understood the assignment. Let's open with \"Style\" by Taylor Swift.",
            }),
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
        djID: "tiffany",
        introKind: "standard",
        firstTrack: {
          title: "Style",
          artist: "Taylor Swift",
          isrc: "USTA31400268",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(204);
  });

  it("returns no content when the Anthropic key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.stubGlobal("fetch", vi.fn());

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
  });
});
