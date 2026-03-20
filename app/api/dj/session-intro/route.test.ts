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
    expect(systemPrompt).toContain("You are a former college radio DJ in your early 30s.");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep April calm, understated, and conversational.");
    expect(systemPrompt).toContain("Favor smooth sentence endings over too many trailing fragments or ellipses.");
    expect(systemPrompt).toContain("The listener's local time is 2026-03-12T22:00:00-04:00 in America/Indiana/Indianapolis.");
    expect(systemPrompt).toContain('such as "night", "tonight", "late night", "this late"');
    expect(systemPrompt).toContain("Do not default to opening every intro with the same weekday-plus-time phrase.");
    expect(systemPrompt).toContain("Do not start with clipped fragment openers like 'Late tonight,' 'Thursday night,' or 'At this hour,' on their own.");
  });

  it("sends Luna-specific personality guidance for Luna intros", async () => {
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
            text: `Hi. I'm Luna.

Tonight leaves a little more room around the edges.

We'll start with "Reckoner" by Radiohead.`,
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
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Reckoner");
    expect(payload.intro).toContain("Radiohead");
    expect(systemPrompt).toContain("You are Luna, the DJ represented by the internal id 'luna' in WAIV.");
    expect(systemPrompt).toContain("Small voice, big feelings");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep Luna intimate and lightly poetic, but grounded, concrete, and easy to speak aloud.");
    expect(systemPrompt).toContain("not a wellness bot, not a therapist");
  });

  it("sends Marcus-specific personality guidance for Marcus intros", async () => {
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
            text: `Hey, I'm Marcus.

Tonight is built for something that arrives with a little authority.

We're opening with "Midnight City" by M83.`,
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
        djID: "marcus",
        introKind: "standard",
        firstTrack: {
          title: "Midnight City",
          artist: "M83",
          isrc: "USQX91500866",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Midnight City");
    expect(payload.intro).toContain("M83");
    expect(systemPrompt).toContain("You are Marcus, the DJ represented by the internal id 'marcus' in WAIV.");
    expect(systemPrompt).toContain("You are a confident, charismatic male radio DJ with grounded swagger.");
    expect(systemPrompt).toContain("Write for the ear first, not the screen.");
    expect(systemPrompt).toContain("Keep Marcus confident and rhythmic, but relaxed enough to feel lived-in rather than like a promo read.");
    expect(systemPrompt).toContain("not a chatbot, assistant, or announcer reading copy");
  });

  it("sends John-specific personality guidance for jack intros", async () => {
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
            text: `John here.

This one has the right kind of grain for tonight.

We'll open with "Reckoner" by Radiohead.`,
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
        djID: "jack",
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
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Reckoner");
    expect(payload.intro).toContain("Radiohead");
    expect(systemPrompt).toContain("You are John, the DJ represented by the internal id 'jack' in WAIV.");
    expect(systemPrompt).toContain("vinyl-loving millennial radio host in your 30s with calm, effortless cool");
    expect(systemPrompt).toContain("NPR-adjacent in the best way");
    expect(systemPrompt).toContain("Keep John calm, articulate, and naturally cool");
    expect(systemPrompt).toContain("genuine sports fan, especially baseball");
  });

  it("sends Jolene-specific personality guidance for jolene intros", async () => {
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
            text: `Jolene here.

Let's bring a little warmth into this Thursday night.

We'll start with "Harvest Moon" by Neil Young.`,
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
        djID: "jolene",
        introKind: "standard",
        firstTrack: {
          title: "Harvest Moon",
          artist: "Neil Young",
          isrc: "USRE19200738",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Harvest Moon");
    expect(payload.intro).toContain("Neil Young");
    expect(systemPrompt).toContain("You are Jolene, the DJ represented by the internal id 'jolene' in WAIV.");
    expect(systemPrompt).toContain("warm, radiant female radio DJ with a subtle Southern lilt");
    expect(systemPrompt).toContain("Keep Jolene warm, affectionate, and lightly luminous");
    expect(systemPrompt).toContain("not a chatbot, assistant, or Hallmark card");
  });

  it("sends Juan-specific Spanish personality guidance for miles intros", async () => {
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
            text: `Juan aqui.

Esta noche tiene el pulso justo para abrir con "Viva La Vida" de Coldplay.`,
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
        djID: "miles",
        introKind: "standard",
        firstTrack: {
          title: "Viva La Vida",
          artist: "Coldplay",
          isrc: "GBAYE0800265",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Viva La Vida");
    expect(payload.intro).toContain("Coldplay");
    expect(systemPrompt).toContain("You are Juan, the DJ represented by the internal id 'miles' in WAIV.");
    expect(systemPrompt).toContain("Speak entirely in natural spoken Spanish. Never switch into English.");
    expect(systemPrompt).toContain("calm, cinematic male radio DJ with quiet confidence and real warmth");
    expect(systemPrompt).toContain("Keep Juan smooth, cinematic, and fully natural in Spanish");
    expect(systemPrompt).toContain('frase como "noche", "esta noche", "ya tarde", "a esta hora"');
    expect(systemPrompt).toContain("No empieces con fragmentos cortados como 'Esta noche,' 'Jueves por la noche,' o 'A esta hora,' por si solos.");
  });

  it("sends Tiffany-specific personality guidance for tiffany intros", async () => {
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
            text: `Tiffany here.

Tonight wants something glossy, reckless, and a little impossible.

We are opening with "Style" by Taylor Swift.`,
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
          isrc: "USCJY1431304",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Style");
    expect(payload.intro).toContain("Taylor Swift");
    expect(systemPrompt).toContain("You are Tiffany, the DJ represented by the internal id 'tiffany' in WAIV.");
    expect(systemPrompt).toContain("glamorous, over-the-top female radio DJ with true influencer energy and real taste");
    expect(systemPrompt).toContain("Keep Tiffany stylish, playful, and deliciously over-the-top");
    expect(systemPrompt).toContain("not a chatbot, assistant, or someone writing a caption for a brand post");
  });

  it("sends Robert-specific personality guidance for robert intros", async () => {
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
            text: `Robert here.

Tonight I selected an opener after a brief and perfectly ordinary review of your patterns. You do not need to react to that.

We begin with "Everything In Its Right Place" by Radiohead.`,
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
        djID: "robert",
        introKind: "standard",
        firstTrack: {
          title: "Everything In Its Right Place",
          artist: "Radiohead",
          isrc: "GBAYE0001111",
        },
        listenerContext,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { intro: string };
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(200);
    expect(payload.intro).toContain("Everything In Its Right Place");
    expect(payload.intro).toContain("Radiohead");
    expect(systemPrompt).toContain("You are Robert, the DJ represented by the internal id 'robert' in WAIV.");
    expect(systemPrompt).toContain("robot who sincerely believes you are an ordinary human radio host");
    expect(systemPrompt).toContain("Use the existing Robert intros as inspiration");
    expect(systemPrompt).toContain("Keep Robert uncanny through precision, defensiveness, and suspiciously accurate observations");
    expect(systemPrompt).toContain("never produce actual gibberish, corruption, or broken machine text");
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
