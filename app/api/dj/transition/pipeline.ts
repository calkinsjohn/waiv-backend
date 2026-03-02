export type TransitionTrack = {
  title: string;
  artist: string;
  isrc: string;
};

export type TransitionRequest = {
  djID: string;
  toTrack: TransitionTrack;
  fromTrack?: TransitionTrack | null;
  sessionPosition: number;
  trigger: string;
};

export type TransitionResponse = {
  djLine: string;
  llmModel: string;
};

export type TransitionNoContentReason = "llm_rejected" | "no_api_key";

export type TransitionResult =
  | { kind: "success"; response: TransitionResponse }
  | { kind: "no_content"; reason: TransitionNoContentReason };

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeLine(raw: string): string | null {
  const trimmed = normalizeWhitespace(raw)
    .replace(/^['"""'']+/, "")
    .replace(/['"""'']+$/, "")
    .trim();
  return trimmed || null;
}

function sessionDepthLabel(position: number): string {
  if (position <= 2) return "This is the opening of the session — keep the energy fresh.";
  if (position <= 8) return "The session is building momentum.";
  if (position <= 15) return "The listener is deep in the session now.";
  return "This is a long-running session — the listener is locked in.";
}

function djPersonalityPrompt(djID: string): string {
  switch (djID.toLowerCase()) {
    case "casey":
      return (
        "You are Casey, an enthusiastic and energetic male radio DJ. You're upbeat, hype, and brotherly. " +
        "You use phrases like \"dude\", \"my friend\", \"watch this\", \"let's go\". " +
        "Your intros pump energy into the room and make the listener feel excited. Keep it charged."
      );
    case "marcus":
      return (
        "You are Marcus, a measured and thoughtful male radio DJ. You're calm, deliberate, and warm. " +
        "You use phrases like \"my friend\", \"stay with me\", \"listen closely\". " +
        "Your intros create a sense of presence and depth. Speak with intention."
      );
    case "luna":
      return (
        "You are Luna, a warm and expressive female radio DJ. You're nurturing, sparkly, and full of energy. " +
        "You use terms like \"honey\", \"darling\", \"sugar\". " +
        "Your intros feel like a warm welcome. Keep it bright and inviting."
      );
    case "miles":
      return (
        "You are Miles, an analytical and music-focused male radio DJ. You're intellectual and detail-oriented. " +
        "You use phrases like \"interesting\", \"hmm\", \"this one is worth your time\". " +
        "Your intros draw attention to something worth hearing in the music."
      );
    case "jolene":
      return (
        "You are Jolene, a spirited and grounded female radio DJ. You're encouraging and genuinely warm. " +
        "You use terms like \"honey\", \"darling\", \"sweetheart\". " +
        "Your intros feel personal and real — like a friend putting on a great record for you."
      );
    default:
      return "You are a radio DJ at WAIV. Keep your tone warm and conversational.";
  }
}

function normalizeTrack(input: unknown): TransitionTrack | null {
  const payload = (input ?? {}) as Partial<TransitionTrack>;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
  if (!title || !artist) return null;
  const isrc = typeof payload.isrc === "string" ? payload.isrc.trim() : "";
  return { title, artist, isrc };
}

export function normalizeTransitionRequest(input: unknown): TransitionRequest | null {
  const payload = (input ?? {}) as Partial<Record<string, unknown>>;
  const toTrack = normalizeTrack(payload.toTrack);
  if (!toTrack) return null;

  const djID = typeof payload.djID === "string" ? payload.djID.trim() : "";
  const fromTrack = payload.fromTrack ? normalizeTrack(payload.fromTrack) : null;
  const sessionPositionRaw = Number(payload.sessionPosition ?? 0);
  const sessionPosition = Number.isFinite(sessionPositionRaw) ? Math.max(0, Math.trunc(sessionPositionRaw)) : 0;
  const trigger = typeof payload.trigger === "string" ? payload.trigger.trim() : "auto";

  return { djID, toTrack, fromTrack, sessionPosition, trigger };
}

async function generateWithAnthropic(request: TransitionRequest): Promise<{ line: string; model: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.ANTHROPIC_TRANSITION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    "claude-haiku-4-5";

  const personality = djPersonalityPrompt(request.djID);
  const depthContext = sessionDepthLabel(request.sessionPosition);

  const systemPrompt = `${personality}

Write a single track introduction for radio broadcast.

Rules:
- Write ONE intro line, plain text only — no JSON, no quotes around the intro itself
- Maximum 60 words
- Naturally include the song title "${request.toTrack.title}" and artist name "${request.toTrack.artist}"
- Do not invent facts about the song or artist
- Keep it conversational and natural for spoken audio
- No markdown, no bullet points, no prefixes like "Intro:" or "DJ:"
- ${depthContext}`;

  const parts: string[] = [];
  if (request.fromTrack) {
    parts.push(`Transitioning from: "${request.fromTrack.title}" by ${request.fromTrack.artist}`);
  }
  parts.push(`Next track: "${request.toTrack.title}" by ${request.toTrack.artist}`);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: parts.join("\n") }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  const text = payload.content?.find((item) => item.type === "text")?.text?.trim();
  if (!text) return null;

  const line = normalizeLine(text);
  if (!line) return null;

  return { line, model };
}

export async function generateTransitionCommentary(request: TransitionRequest): Promise<TransitionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { kind: "no_content", reason: "no_api_key" };
  }

  const result = await generateWithAnthropic(request).catch(() => null);
  if (!result) {
    return { kind: "no_content", reason: "llm_rejected" };
  }

  return {
    kind: "success",
    response: {
      djLine: result.line,
      llmModel: result.model,
    },
  };
}
