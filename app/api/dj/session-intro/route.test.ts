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
            text: `Hey, welcome in. I’m April, and we’re opening the show the only way I trust one of these Thursday nights to begin.

It’s Thursday night, and this is the kind of hour where the first song matters a little more than the speech around it. I wanted the opening to feel lived-in instead of dressed up, like the station was already breathing before we walked into it.

On W.A.I.V. I’d rather start with something that lets the room settle and then quietly take over than force a fake big entrance. The point is to make the first move feel chosen.

We’re opening with "Yellow" by Coldplay, and it feels like the right way to let the show breathe.`,
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
    expect(systemPrompt).toContain('Phrases like "night", "tonight", "late night", "this late"');
    expect(systemPrompt).toContain("Do not default to opening every intro with the same weekday-plus-time phrase.");
    expect(systemPrompt).toContain("Do not start with clipped fragment openers like 'Late tonight,' 'Thursday night,' or 'At this hour,' on their own.");
  });

  it("treats just-after-midnight intros as the previous radio night", async () => {
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
            text: `Hey, welcome back.

Friday night still has enough momentum in it to start with "Midnight City" by M83.

We'll start there and keep the room moving.`,
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
    const systemPrompt = String(anthropicBody?.system ?? "");

    expect(response.status).toBe(204);
    expect(systemPrompt).toContain("The listener's local time is 2026-03-14T00:30:00-04:00 in America/Indiana/Indianapolis.");
    expect(systemPrompt).toContain("Work in a natural local-moment reference for Friday night");
    expect(systemPrompt).toContain("For on-air phrasing, treat anything before 4:00 AM as part of the previous night's radio day: Friday night.");
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
            text: `Hi, welcome in. I'm Luna, and we're opening the set softly on purpose tonight.

Tonight leaves a little more room around the edges, and that usually tells me the set should arrive softly before it asks for anything. It feels like the kind of hour where a show should widen the room before it fills it.

I wanted this opening on W.A.I.V. to feel patient, like the station found the exact right light level before the songs started glowing. That makes the first step mean more.

We'll start with "Reckoner" by Radiohead, because it knows how to enter without breaking the spell.`,
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
            text: `Hey, welcome in. I'm Marcus, and over the next hour we're opening with a little authority.

Tonight is built for something that arrives with a little authority. Not a fake dramatic entrance, just a first move that knows how to set the pace.

That’s the whole point of the show on W.A.I.V. for me. Give the set some lift early, then let it keep earning its way forward.

We're opening with "Midnight City" by M83, because it hits like the night has already started moving.`,
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
            text: `Welcome back. John here, and this hour could use a set with a little patience in it.

Thursday night usually gives a set a little room to breathe before it really has to show its hand, and I like taking advantage of that whenever I can.

That’s part of the fun on W.A.I.V. The opener should tell you what kind of night this is without needing a huge speech about it, just enough shape to point the hour in the right direction. A little scene-setting goes a long way.

We'll open with "Reckoner" by Radiohead. It has the right grain to start things with a little patience and a little intention.`,
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
            text: `Hey sweetheart, welcome back. Jolene here, and we're opening this Thursday night with a little light in it.

This Thursday night feels like it could use a little warmth right up front, the kind that makes the room ease its shoulders down before the set gets going. I like when the first minute of a show feels like somebody opened the door and let the air change.

That’s how I want W.A.I.V. to start here, with something human in it, something that opens the room before the rest of the songs come walking through. Then the set gets to keep that glow moving.

We'll start with "Harvest Moon" by Neil Young, because it glows without trying too hard.`,
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
            text: `Juan aqui, y en la próxima hora vamos a abrir este show con un poco de intención.

Esta noche tiene el pulso justo para abrir un set con intención, sin correr y sin explicar demasiado antes de dejar que la música haga lo suyo.

En W.A.I.V. me gusta que la primera canción acomode el aire, marque el color de la hora y nos meta al programa como si ya viniera respirando desde antes.

Vamos a empezar con "Viva La Vida" de Coldplay, porque entra con la clase y el tamaño que esta noche pide.`,
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
    expect(systemPrompt).toContain('Puedes apoyarte en frases como "noche", "esta noche", "ya tarde", "a esta hora"');
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

Tonight wants something glossy, reckless, and a little impossible. Not messy. Just the kind of opener that walks into the room already wearing the right lighting.

That’s the mood I want for this W.A.I.V. set. Give it a real entrance, then let the rest of the hour keep up with it.

We are opening with "Style" by Taylor Swift, because this is not the moment for a shy first song.`,
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
            text: `Welcome back. Robert here on W.A.I.V., opening the show with a degree of composure that should reassure everyone involved.

Tonight has the sort of tension that benefits from an opener chosen with suspicious care. The first minute tends to reveal whether a set intends to mean anything at all.

I prefer an opening that reduces confusion and establishes momentum immediately, then lets the room discover the logic on its own. That is the standard we will apply here.

We begin with "Everything In Its Right Place" by Radiohead, which is a reassuringly precise way to start.`,
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
