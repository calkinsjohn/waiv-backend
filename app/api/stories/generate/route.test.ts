import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { fetchGeniusNarratives, fetchWikipediaNarratives } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(resolve(here, "__fixtures__", name), "utf-8");
}

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("song stories v2 narrative fetchers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.GENIUS_ACCESS_TOKEN;
  });

  it("Wikipedia fetcher returns narrative prose for a rich editorial song", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("prop=sections")) {
        return jsonResponse(fixture("wikipedia_sections_rich.json"));
      }
      if (url.includes("prop=wikitext") && (url.includes("section=1") || url.includes("section=2"))) {
        return jsonResponse(fixture("wikipedia_section_recording_rich.json"));
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const narratives = await fetchWikipediaNarratives("While My Guitar Gently Weeps", "The Beatles");

    expect(narratives.length).toBeGreaterThan(0);
    expect(narratives[0]?.source).toBe("wikipediaRecording");
    expect(narratives[0]?.prose.toLowerCase()).toContain("harrison invited eric clapton");
  });

  it("Wikipedia fetcher returns empty array for an obscure song with no target sections", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("prop=sections")) {
        return jsonResponse(fixture("wikipedia_sections_obscure.json"));
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const narratives = await fetchWikipediaNarratives("Completely Obscure Song", "Unknown Artist");

    expect(narratives).toEqual([]);
  });

  it("Genius fetcher returns description prose when editorial field is present", async () => {
    process.env.GENIUS_ACCESS_TOKEN = "test-genius-token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search")) {
        return jsonResponse(fixture("genius_search_rich.json"));
      }
      if (url.includes("/songs/12345")) {
        return jsonResponse(fixture("genius_song_rich.json"));
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const narratives = await fetchGeniusNarratives("While My Guitar Gently Weeps", "The Beatles");

    expect(narratives.length).toBe(1);
    expect(narratives[0]?.source).toBe("geniusAbout");
    expect(narratives[0]?.prose.length).toBeGreaterThan(80);
  });

  it("Genius fetcher returns empty array when there is no editorial coverage", async () => {
    process.env.GENIUS_ACCESS_TOKEN = "test-genius-token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search")) {
        return jsonResponse(fixture("genius_search_obscure.json"));
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const narratives = await fetchGeniusNarratives("Very Obscure Song", "Unknown Artist");

    expect(narratives).toEqual([]);
  });
});

describe("POST /api/stories/generate", () => {
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

  it("returns a djLine when narratives contain a clear human story", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.anthropic.com")) {
        return jsonResponse(fixture("anthropic_ok.json"));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/stories/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        isrc: "GBAYE6800015",
        title: "While My Guitar Gently Weeps",
        artist: "The Beatles",
        narratives: [
          {
            source: "wikipediaRecording",
            prose:
              "Harrison invited Eric Clapton to play lead guitar on the track. Clapton was hesitant because no outside musician had played on a Beatles record, but Harrison insisted and the guitar became central to the song's emotional tone.",
            confidence: 0.85,
          },
        ],
        context: {
          notableGuest: "Eric Clapton",
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { djLine: string; sourceAttribution: string; llmModel: string };

    expect(response.status).toBe(200);
    expect(payload.djLine.length).toBeGreaterThan(20);
    expect(payload.sourceAttribution).toBe("wikipediaRecording");
    expect(payload.llmModel.length).toBeGreaterThan(0);
  });

  it("returns 204 when LLM rejects thin prose", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.anthropic.com")) {
        return jsonResponse(fixture("anthropic_no_story.json"));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/stories/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        isrc: "USABC1234567",
        title: "Thin Song",
        artist: "Thin Artist",
        narratives: [
          {
            source: "geniusAbout",
            prose: "This song was released as a single and appears on the album version.",
            confidence: 0.7,
          },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Story-Reason")).toBe("llm_rejected");
  });

  it("returns 204 for explicit empty narratives without calling LLM", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/stories/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        isrc: "USDEF1234567",
        title: "No Data Song",
        artist: "No Data Artist",
        narratives: [],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-WAIV-Story-Reason")).toBe("no_narrative");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
