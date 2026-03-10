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
});
