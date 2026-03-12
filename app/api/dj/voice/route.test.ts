import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("POST /api/dj/voice", () => {
  const appToken = "test-app-token";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WAIV_API_APP_TOKEN = appToken;
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    delete process.env.ELEVENLABS_VOICE_ID_TIFFANY;
  });

  afterEach(() => {
    delete process.env.WAIV_API_APP_TOKEN;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID_TIFFANY;
  });

  it("proxies Tiffany voice requests with the fallback voice ID", async () => {
    const fetchMock = vi.fn(async () => new Response("mp3-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djId: "tiffany",
        text: "Sweetie, let's keep this moving.",
      }),
    });

    const response = await POST(request);
    const audio = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(audio).toBe("mp3-bytes");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/XXdN7JMw4LRaRRHLBliy"
    );
  });

  it("returns 401 without the app token", async () => {
    const request = new NextRequest("http://localhost/api/dj/voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        djId: "casey",
        text: "Test line",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("uses Rafa's tuned voice settings for the miles slot", async () => {
    const fetchMock = vi.fn(async () => new Response("mp3-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/dj/voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djId: "miles",
        text: "Good to have you here.\nMy thing is momentum.\nTexture.",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.voice_settings).toMatchObject({
      stability: 0.58,
      similarity_boost: 0.76,
      style: 0.18,
      speed: 1.0,
      use_speaker_boost: true,
    });
  });

  it("adds pacing punctuation to Rafa raw-text lines without touching SSML", async () => {
    const fetchMock = vi.fn(async () => new Response("mp3-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const plainRequest = new NextRequest("http://localhost/api/dj/voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djId: "miles",
        text: "Good to have you here\nMy thing is momentum\nTexture",
      }),
    });

    const plainResponse = await POST(plainRequest);

    expect(plainResponse.status).toBe(200);
    let requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.text).toContain("Good to have you here.");
    expect(requestBody.text).toContain("My thing is momentum.");
    expect(requestBody.text).toContain("Texture.");

    fetchMock.mockClear();

    const ssmlRequest = new NextRequest("http://localhost/api/dj/voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-waiv-app-token": appToken,
      },
      body: JSON.stringify({
        djId: "miles",
        text: "<speak>Momentum.<break time=\"320ms\"/>Texture.</speak>",
      }),
    });

    const ssmlResponse = await POST(ssmlRequest);

    expect(ssmlResponse.status).toBe(200);
    requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.text).toContain("<break time=\"320ms\"/>");
    expect(requestBody.text).toContain("<speak>");
  });
});
