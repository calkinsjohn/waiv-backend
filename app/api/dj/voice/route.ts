import { NextRequest, NextResponse } from "next/server";

type DjId = "miles" | "jack" | "luna" | "casey" | "jolene" | "marcus" | "tiffany" | "robert";

type VoiceRequest = {
  djId: DjId;
  text: string;
  utteranceKind?: "standard" | "station_signoff";
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

function normalizeStationSignoffForSpeech(text: string): string {
  return text
    .replace(/\bW\s*\.?\s*A\s*\.?\s*I\s*\.?\s*V\.?\b/giu, "W A I V")
    .replace(/\s+/g, " ")
    .trim();
}

function spokenTextForDJ(djId: DjId, text: string, utteranceKind: "standard" | "station_signoff"): string {
  const trimmed = utteranceKind === "station_signoff" ? normalizeStationSignoffForSpeech(text) : text.trim();
  if (djId !== "miles") {
    return trimmed;
  }

  const paced = applyRafaPacing(trimmed);

  // Rafa mixes in short Spanish phrases. Give ElevenLabs clearer phonetic hints
  // while keeping the visible copy unchanged elsewhere in the app.
  return paced
    .replace(/\bclaro\b/gi, "clah-roh")
    .replace(/\bdale\b/gi, "dah-leh")
    .replace(/\bvamos a empezar\b/gi, "vah-mohs ah em-peh-sar")
    .replace(/\bvamos\b/gi, "vah-mohs")
    .replace(/\basí es\b/gi, "ah-see ess")
    .replace(/\bsabes\b/gi, "sah-behs")
    .replace(/\btranqui\b/gi, "trahn-kee")
    .replace(/\bcréeme\b/gi, "cray-eh-meh")
    .replace(/\bbueno\b/gi, "bweh-noh")
    .replace(/\bmi gente\b/gi, "mee hen-teh")
    .replace(/\bcontigo\b/gi, "cone-tee-goh")
    .replace(/\by esta va primero\b/gi, "ee es-tah vah pree-meh-roh");
}

function applyRafaPacing(text: string): string {
  if (/<speak[\s>]|<break\b/i.test(text)) {
    return text;
  }

  const normalizedLineEndings = text.replace(/\r\n?/g, "\n");
  const paragraphs = normalizedLineEndings
    .split(/\n\s*\n+/)
    .map((paragraph) =>
      paragraph
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (/[.!?;:…]["')\]]*$/.test(line) ? line : `${line}.`))
        .join(" ")
    )
    .filter(Boolean);

  return paragraphs.join("\n\n");
}

function voiceSettingsForDJ(djId: DjId) {
  if (djId === "miles") {
    return {
      stability: 0.58,
      similarity_boost: 0.76,
      style: 0.18,
      speed: 1.0,
      use_speaker_boost: true,
    };
  }

  if (djId === "casey") {
    return {
      stability: 0.62,
      similarity_boost: 0.74,
      style: 0.14,
      use_speaker_boost: true,
    };
  }

  return {
    stability: 0.52,
    similarity_boost: 0.72,
    style: 0.22,
    use_speaker_boost: true,
  };
}

function normalizeUtteranceKind(value: unknown): "standard" | "station_signoff" {
  return value === "station_signoff" ? "station_signoff" : "standard";
}

function voiceSettingsForUtterance(
  djId: DjId,
  utteranceKind: "standard" | "station_signoff"
) {
  const base = voiceSettingsForDJ(djId);
  if (utteranceKind !== "station_signoff") {
    return base;
  }

  return {
    ...base,
    stability: Math.max(base.stability, 0.72),
    style: Math.min(base.style, 0.08),
  };
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
    // Keep John available immediately; can be overridden by ELEVENLABS_VOICE_ID_JACK.
    jack: "IjZViYz1zbpQ4B0R1Z0i",
    luna: "0KUMUbM9SPqmcw1fvkg5",
    miles: "vkSVKHR3X9w4QZWIh0MP",
    marcus: "tB0V1KLPcxfI3Dzd6Yi9",
    tiffany: "Soj83FHuFBnbh2kQSIYq",
    robert: "HyKZ7TI0QOLeou9ImlCP",
  };
  const voiceId = process.env[voiceEnvName] ?? voiceIdFallbackByDj[input.djId];
  if (!voiceId) {
    return NextResponse.json({ error: `Missing ${voiceEnvName}.` }, { status: 503 });
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";
  const maxCharsRaw = Number(process.env.ELEVENLABS_MAX_CHARS ?? "2200");
  const maxChars = Number.isFinite(maxCharsRaw)
    ? Math.max(200, Math.min(4000, Math.floor(maxCharsRaw)))
    : 2200;
  const utteranceKind = normalizeUtteranceKind(input.utteranceKind);
  const spokenText = spokenTextForDJ(input.djId, input.text, utteranceKind).slice(0, maxChars);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: spokenText,
        model_id: modelId,
        output_format: outputFormat,
        enable_ssml_parsing: true,
        voice_settings: voiceSettingsForUtterance(input.djId, utteranceKind),
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
