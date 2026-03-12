import { NextRequest, NextResponse } from "next/server";

type DjId = "miles" | "jack" | "luna" | "casey" | "jolene" | "marcus" | "tiffany" | "robert";

type VoiceRequest = {
  djId: DjId;
  text: string;
};

const VOICE_ENV_BY_DJ: Record<DjId, string> = {
  miles: "ELEVENLABS_VOICE_ID_MILES",
  jack: "ELEVENLABS_VOICE_ID_JACK",
  luna: "ELEVENLABS_VOICE_ID_LUNA",
  casey: "ELEVENLABS_VOICE_ID_CASEY",
  jolene: "ELEVENLABS_VOICE_ID_JOLENE",
  marcus: "ELEVENLABS_VOICE_ID_MARCUS",
  tiffany: "ELEVENLABS_VOICE_ID_TIFFANY",
  robert: "ELEVENLABS_VOICE_ID_ROBERT",
};

function isDjId(value: unknown): value is DjId {
  return (
    value === "miles" ||
    value === "jack" ||
    value === "luna" ||
    value === "casey" ||
    value === "jolene" ||
    value === "marcus" ||
    value === "tiffany" ||
    value === "robert"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expectedAppToken = process.env.WAIV_API_APP_TOKEN?.trim();
  if (!expectedAppToken) {
    return NextResponse.json({ error: "Missing WAIV_API_APP_TOKEN." }, { status: 503 });
  }

  const providedAppToken = request.headers.get("x-waiv-app-token")?.trim();
  if (!providedAppToken || providedAppToken !== expectedAppToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let input: VoiceRequest;
  try {
    input = (await request.json()) as VoiceRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!isDjId(input?.djId) || typeof input?.text !== "string" || input.text.trim().length === 0) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ElevenLabs API key." }, { status: 503 });
  }

  const voiceEnvName = VOICE_ENV_BY_DJ[input.djId];
  const voiceIdFallbackByDj: Partial<Record<DjId, string>> = {
    // Keep Winston available immediately; can be overridden by ELEVENLABS_VOICE_ID_JACK.
    jack: "IazpfpjmkHHQKVesClWm",
    luna: "0KUMUbM9SPqmcw1fvkg5",
    miles: "vkSVKHR3X9w4QZWIh0MP",
    marcus: "tB0V1KLPcxfI3Dzd6Yi9",
    tiffany: "XXdN7JMw4LRaRRHLBliy",
    robert: "HyKZ7TI0QOLeou9ImlCP",
  };
  const voiceId = process.env[voiceEnvName] ?? voiceIdFallbackByDj[input.djId];
  if (!voiceId) {
    return NextResponse.json({ error: `Missing ${voiceEnvName}.` }, { status: 503 });
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";
  const maxCharsRaw = Number(process.env.ELEVENLABS_MAX_CHARS ?? "2200");
  const maxChars = Number.isFinite(maxCharsRaw)
    ? Math.max(200, Math.min(4000, Math.floor(maxCharsRaw)))
    : 2200;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: input.text.trim().slice(0, maxChars),
        model_id: modelId,
        output_format: outputFormat,
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.72,
          style: 0.22,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "ElevenLabs request failed.", detail: detail.slice(0, 240) },
        { status: 502 }
      );
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate speech." }, { status: 502 });
  }
}
