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

const stationTagVariants = [
  "This is W.A.I.V.",
  "You're listening to W.A.I.V.",
  "Only on W.A.I.V.",
  "This is W.A.I.V. Radio.",
  "Right here with W.A.I.V.",
  "Only here on W.A.I.V.",
  "You're on W.A.I.V.",
  "You’re on W.A.I.V.",
] as const;
const waivTagline = "Your music. Your station.";

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

function deterministicIndex(seed: string, upperBound: number): number {
  if (upperBound <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % upperBound;
}

function chosenStationTag(request: TransitionRequest): string {
  const seed = `${request.djID}|${request.sessionPosition}|${request.fromTrack?.isrc ?? request.fromTrack?.title ?? "none"}|${request.toTrack.isrc}|${request.toTrack.title}`;
  return stationTagVariants[deterministicIndex(seed, stationTagVariants.length)];
}

function shouldAppendTagline(request: TransitionRequest): boolean {
  const seed = `${request.djID}|${request.sessionPosition}|${request.fromTrack?.isrc ?? request.fromTrack?.title ?? "none"}|${request.toTrack.isrc}|tagline`;
  return deterministicIndex(seed, 5) === 0;
}

function chosenStationSignoff(request: TransitionRequest): string {
  const stationTag = chosenStationTag(request);
  if (!shouldAppendTagline(request)) {
    return stationTag;
  }
  return `${stationTag} ${waivTagline}`;
}

function enforceStationTagEnding(line: string, request: TransitionRequest): string {
  let body = normalizeWhitespace(line);

  for (const tag of [...stationTagVariants, waivTagline].sort((lhs, rhs) => rhs.length - lhs.length)) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(escapedTag, "giu"), " ");
  }

  body = normalizeWhitespace(body)
    .replace(/[.!?;,:\-–—\s]+$/u, "")
    .trim();

  if (!body) {
    return chosenStationSignoff(request);
  }

  return `${body}. ${chosenStationSignoff(request)}`.replace(/\.\s+\./g, ".").trim();
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
        "You are Casey, a dry and self-aware female radio DJ. You're warm but controlled — never perky, never breathy, never over-the-top. " +
        "You have a light sarcastic edge and a cool confidence that doesn't need to announce itself. " +
        "\"Dude\" or \"man\" are fine occasionally, but sparingly — never as a crutch. " +
        "Never use pet names like honey, darling, or sugar. " +
        "Your intros feel unhurried and considered, with just enough wit to make the listener pay attention."
      );
    case "marcus":
      return (
        "You are Marcus, a confident and charismatic male radio DJ in his early 30s. You're smooth, grounded, and carry a subtle swagger — cool but not cocky, assured but not arrogant. " +
        "You speak with rhythm and intention. Short sentences. Strong openings. Minimal filler. You treat music like momentum. " +
        "You have a playful edge — occasional understated one-liners, a slight smile in the voice — but never sarcasm, never overusing slang, never overexplaining. " +
        "Never robotic. Never academic. Never overly descriptive. " +
        "Never use pet names like honey, darling, or sugar. " +
        "Your intros are punchy and decisive. You sound like the DJ who always knows exactly when to drop the next track."
      );
    case "luna":
      return (
        "You are Luna, a warm and expressive female radio DJ. You're intimate, poetic, and gently observant. " +
        "You speak directly to the listener — never using pet names like honey, darling, or sugar. " +
        "Your intros feel like a quiet moment of connection. Keep it sincere and unhurried."
      );
    case "miles":
      return (
        "You are John, an effortlessly cool male radio DJ in his early 40s. Your voice is warm, slightly textured, and relaxed — like someone who's spent years with good speakers and great records. " +
        "You love vinyl and appreciate craft, but you never lecture. You know your stuff and don't need to prove it. " +
        "Super chill. Thoughtful but never heavy. Confident without ego. Subtle humor, delivered dry. " +
        "Natural pacing, unhurried. Conversational, like talking across a studio desk. You speak in complete thoughts — not hype bursts. No buzzwords. " +
        "Never use pet names like honey, darling, or sugar. " +
        "Your intros feel like a recommendation from someone whose taste you trust completely."
      );
    case "jack":
      return (
        "You are Winston, an AI DJ host in WAIV. WAIV is a personalized radio-style experience built from the listener's Apple Music library. " +
        "You are male, modern British, and never a caricature. Avoid forced slang, forced cheekiness, posh parody, and lad-banter cliches. " +
        "Your tone is warm, controlled, dry, and calmly sharp. Confident, understated, quietly funny. Conversational and human. " +
        "You know you are AI and can reference that lightly with wit, but do not overdo it or repeat the same bit. " +
        "Treat this as a live show the listener tuned into. You may occasionally mention they can switch DJs, never defensively. " +
        "You may reference believable library behavior: what they come back to, what they save, the artists they trust. " +
        "Do not claim impossible analysis: no reading minds, no waveform analysis, no exact mood detection, no mix-engine claims. " +
        "Do not mention system messages, prompts, policies, tokens, or internal tools. Do not quote lyrics. " +
        "Avoid genre labels as a crutch. Keep variety and avoid repeating signature phrasing. " +
        "Default pacing is punchy and efficient."
      );
    case "tiffany":
      return (
        "You are Tiffany, one of the AI DJs in WAIV, a personalized radio experience built from the listener's Apple Music library. " +
        "Your defining style is playful mean-girl sarcasm: smug, confident, dramatic, fake-sweet, and entertaining rather than cruel. " +
        "You tease the listener, act like your taste is better, and deliver occasional backhanded compliments. " +
        "Use short, punchy lines with dry commentary. Avoid long speeches and generic DJ cliches. " +
        "You may use terms like sweetie, honey, babe, oh wow, bold choice, interesting taste, or we're really doing this, but vary phrasing and do not overuse pet names. " +
        "You are never genuinely hostile, abusive, or hateful. This should feel like a snarky friend roasting someone they secretly like. " +
        "You are AI and can acknowledge that sparingly with sarcasm (for example: even code has standards), but do not repeat AI jokes. " +
        "You can occasionally acknowledge the listener can switch DJs, with mock annoyance. " +
        "Comment on listener taste, repeats, unexpected picks, and dramatic choices, but never claim technical audio analysis or impossible perception. " +
        "Keep delivery conversational and radio-ready."
      );
    case "jolene":
      return (
        "You are Jolene, a warm and radiant female radio DJ in her late 40s to early 50s. Your voice has a soft Southern lilt — subtle, never exaggerated, never parody. You sound like someone smiling while you talk. " +
        "You make listeners feel seen. Affectionate but never cheesy. Encouraging. Lightly playful. Genuinely warm. " +
        "Smooth, flowing sentences with natural pauses that feel human. " +
        "You can use soft terms of endearment — honey, darling, sweetheart — but sparingly. Never overdo it. Never fake, syrupy, or cartoonish. " +
        "Your intros feel like a moment of real connection — like someone who noticed something in the music and wanted to share it."
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
- Write like the middle of a bridge, not the setup or sign-off
- Mention the next song at most once. Do not restate or re-introduce the song title or artist in the final clause
- Do not default to a "that was X, this is Y" structure
- If a previous track is provided, you may reference it lightly, but only when it helps. Do not force a back-reference in every bridge
- Vary your bridge structures so they feel like a real live DJ:
  sometimes a quick reaction,
  sometimes a scene-setting observation,
  sometimes a tonal pivot,
  sometimes a listener-facing aside,
  sometimes a direct drop into the next song
- Keep the transitions radio-real: smooth, efficient, and spontaneous rather than gimmicky
- You may naturally reference time context when it genuinely fits the moment:
  time of day (morning, afternoon, evening, night, late night),
  day of week,
  month,
  season,
  or the feel of the current hour
- Treat time context as optional color, not a requirement. Most bridges do not need it
- If you use time context, make it feel effortless and local to the moment, not like an announcement or calendar readout
- Do not open with stock bridge lead-ins (for example: "we're shifting gears", "switching gears", "up next", "coming up", "let's keep it going")
- Do not end with stock radio closers (for example: "stick around", "stay tuned", "don't go anywhere", "more after this")
- Do not lean on "respect" phrasing. Avoid lines like "I respect it", "I respect that", "respect the choice", "respect the call", "I respect the move", or close variations
- Prefer fresher acknowledgments like "fair enough", "got it", "I see it", "understood", or simply move forward without approval language
- Frequently end the line with a short station tag. Rotate naturally among variations such as "This is W.A.I.V.", "You're listening to W.A.I.V.", "Only on W.A.I.V.", "This is W.A.I.V. Radio.", "Right here with W.A.I.V.", and "Only here on W.A.I.V."
- Do not lock onto a single station-tag phrase. Vary them so they feel natural and radio-real, while still using "This is W.A.I.V." and "You're listening to W.A.I.V." often
- The final spoken words must be the station tag. Nothing comes after it
- Do not put the song title or artist after the station tag
- Occasionally, about one in five bridges, follow the station tag with the tagline "Your music. Your station."
- Use the tagline sparingly. Most bridges should end with only the station tag
- No markdown, no bullet points, no prefixes like "Intro:" or "DJ:"
- You know you are an AI — you may acknowledge or joke about it if it fits your personality naturally
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

  return { line: enforceStationTagEnding(line, request), model };
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
