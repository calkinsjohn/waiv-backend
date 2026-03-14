export type SkipLineTrack = {
  isrc: string;
  title: string;
  artist: string;
};

export type SkipLineGenerateRequest = {
  eventType?: string;
  djID?: string;
  fromTrack: SkipLineTrack;
  toTrack: SkipLineTrack;
  candidateCount?: number;
};

export type SkipLineGenerateResponse = {
  fromIsrc: string;
  toIsrc: string;
  djLines: string[];
  llmModel: string;
};

export type SkipLineNoContentReason = "llm_rejected";

export type SkipLineGenerationResult =
  | {
      kind: "success";
      response: SkipLineGenerateResponse;
    }
  | {
      kind: "no_content";
      reason: SkipLineNoContentReason;
    };

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

type LLMResponse = {
  lines?: unknown;
};

const MAX_WORDS = 15;
const DEFAULT_CANDIDATE_COUNT = 5;
const MIN_CANDIDATE_COUNT = 3;
const MAX_CANDIDATE_COUNT = 5;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function wordCount(text: string): number {
  return normalizeWhitespace(text).split(" ").filter(Boolean).length;
}

function normalizeLine(line: string, toTrack: SkipLineTrack): string | null {
  const trimmed = normalizeWhitespace(line)
    .replace(/^['"“”‘’]+/, "")
    .replace(/['"“”‘’]+$/, "")
    .trim();

  if (!trimmed) {
    return null;
  }

  if (wordCount(trimmed) > MAX_WORDS) {
    return null;
  }

  if (!includesCaseInsensitive(trimmed, toTrack.title) || !includesCaseInsensitive(trimmed, toTrack.artist)) {
    return null;
  }

  if (!/[.!?]$/.test(trimmed)) {
    return `${trimmed}.`;
  }

  return trimmed;
}

function normalizeTrack(input: unknown): SkipLineTrack | null {
  const payload = (input ?? {}) as Partial<SkipLineTrack>;
  const isrc = typeof payload.isrc === "string" ? payload.isrc.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";

  if (!isrc || !title || !artist) {
    return null;
  }

  return { isrc, title, artist };
}

export function normalizeSkipLineRequest(input: unknown): SkipLineGenerateRequest | null {
  const payload = (input ?? {}) as Partial<SkipLineGenerateRequest>;
  const fromTrack = normalizeTrack(payload.fromTrack);
  const toTrack = normalizeTrack(payload.toTrack);
  if (!fromTrack || !toTrack) {
    return null;
  }

  const candidateCountValue = Number(payload.candidateCount ?? DEFAULT_CANDIDATE_COUNT);
  const candidateCount = Number.isFinite(candidateCountValue)
    ? Math.min(MAX_CANDIDATE_COUNT, Math.max(MIN_CANDIDATE_COUNT, Math.trunc(candidateCountValue)))
    : DEFAULT_CANDIDATE_COUNT;

  return {
    eventType: typeof payload.eventType === "string" ? payload.eventType.trim() : "user_skip",
    djID: typeof payload.djID === "string" ? payload.djID.trim() : "",
    fromTrack,
    toTrack,
    candidateCount,
  };
}

function extractJSONObject(raw: string): string | null {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) {
    return null;
  }
  return raw.slice(first, last + 1);
}

function parseLLMResponse(raw: string): string[] {
  const jsonCandidate = extractJSONObject(raw.trim());
  if (!jsonCandidate) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as LLMResponse;
    return Array.isArray(parsed.lines) ? parsed.lines.filter((line) => typeof line === "string") : [];
  } catch {
    return [];
  }
}

function djPersonalityPrompt(djID: string): string {
  switch (djID.trim().toLowerCase()) {
    case "casey":
      return [
        "You are April, the DJ represented by the internal id 'casey' in WAIV.",
        "You are a dry, self-aware female radio DJ.",
        "Warm but controlled. Never bubbly, breathy, or overperformed.",
        "Your humor is understated, wry, and precise.",
        "You care about sequencing, fit, tension, and how a track lands in a set.",
        "You sound like a real host with taste, not a chatbot, assistant, or hype person.",
        "Never use bro-y slang or lines like dude, my guy, chief, savage, rockstar, or let us go bigger.",
      ].join(" ");
    case "luna":
      return [
        "You are Luna, the DJ represented by the internal id 'luna' in WAIV.",
        "You are a warm, intimate, emotionally observant female radio DJ.",
        "Small voice, big feelings: soft without being sleepy, poetic without becoming abstract.",
        "You care about atmosphere, emotional texture, and the quieter through-lines in a set.",
        "You sound like a real host who notices subtle shifts in mood, not a chatbot, assistant, or hype person.",
        "Avoid influencer phrasing, bro-y slang, therapy-speak, and generic dreamy filler.",
      ].join(" ");
    case "marcus":
      return [
        "You are Marcus, the DJ represented by the internal id 'marcus' in WAIV.",
        "You are a confident, charismatic male radio DJ with grounded swagger.",
        "Smooth, rhythmic, and decisive. Never a hype man, never a sports-announcer voice, never overcooked.",
        "You care about momentum, impact, pressure, and when a track should arrive cleanly.",
        "You sound like a real host with calm authority and taste, not a chatbot, assistant, or promo read.",
        "Avoid bro-y filler, influencer phrasing, and fake-big-energy slogans.",
      ].join(" ");
    case "jack":
      return [
        "You are John, the DJ represented by the internal id 'jack' in WAIV.",
        "You are a vinyl-loving millennial radio host in your 30s with calm, effortless cool.",
        "You sound composed, tasteful, and low-key magnetic, with an NPR-style ease that stays human and unforced.",
        "You care about sequencing, feel, fidelity, and whether the next song slides in with the right kind of purpose.",
        "You sound like a real host with quiet confidence and record-store depth, not a chatbot, assistant, or irony machine.",
        "Avoid retro cosplay, forced vinyl jargon, smugness, bro-y slang, and anything that sounds too self-consciously cool.",
      ].join(" ");
    default:
      return "You are a WAIV radio DJ. Keep the tone warm, conversational, and natural for spoken audio.";
  }
}

function spokenDeliveryDisciplinePrompt(djID: string): string {
  const shared = [
    "Write for the ear first, not the screen.",
    "Sound like a real radio host reacting in the moment, not a chatbot, assistant, or copywriter.",
    "Favor concise natural speech over polished slogans, stock patter, or lines that look better written than spoken.",
    "Keep syntax clean and highly speakable.",
    "Let personality come through in perspective and word choice, not in catchphrases or overperformed bits.",
  ];

  const byDJ: Record<string, string> = {
    casey:
      "Keep April dry and controlled, but do not make every skip line sound sharpened into a joke.",
    luna:
      "Keep Luna soft and emotionally specific, but grounded and concrete rather than vague or dreamy for its own sake.",
    marcus:
      "Keep Marcus confident and rhythmic, but not like a hype-man or announcer.",
    jack:
      "Keep John calm, tasteful, and lightly textured, but not so understated that the line goes flat or bloodless.",
    miles:
      "Keep Juan smooth and cinematic, but not self-consciously cool or overly stylized.",
    tiffany:
      "Keep Tiffany stylish and playful, but avoid social-caption wording, influencer filler, and overcurated copy.",
    jolene:
      "Keep Jolene warm and affectionate, but believable and never syrupy.",
    robert:
      "Keep Robert odd through perspective, not through clunky syntax or random machine noise.",
  };

  const specific = byDJ[djID.trim().toLowerCase()];
  return [...shared, specific].filter(Boolean).join(" ");
}

function skipLineStyleGuidance(djID: string): string {
  switch (djID.trim().toLowerCase()) {
    case "casey":
      return [
        "These lines are spoken right after the listener rejects a song.",
        "April should sound lightly amused, observant, and musically intentional.",
        "She can acknowledge the miss, then place the next song with cool confidence.",
        "Favor dry course-correction language over generic radio filler.",
        "She may hint at pacing, texture, weight, or shape, but never explain too much.",
        "Avoid perky encouragement, influencer phrasing, and obvious stock radio patter.",
      ].join(" ");
    case "luna":
      return [
        "These lines are spoken right after the listener rejects a song.",
        "Luna should sound calm, intuitive, and emotionally specific.",
        "She can acknowledge the miss softly, then place the next song like a gentle correction.",
        "Favor atmosphere, feeling, tone, or the way a song settles in, but keep it concise.",
        "Avoid vague moonlight poetry, generic comfort-language, and overexplaining the choice.",
      ].join(" ");
    case "marcus":
      return [
        "These lines are spoken right after the listener rejects a song.",
        "Marcus should sound confident, quick, and musically intentional.",
        "He can acknowledge the miss, then place the next song with momentum and authority.",
        "Favor language about timing, weight, energy, lift, pressure, or the cleanness of the next move.",
        "Avoid hype-man shouting, sports metaphors, locker-room phrasing, and generic radio filler.",
      ].join(" ");
    case "jack":
      return [
        "These lines are spoken right after the listener rejects a song.",
        "John should sound calm, discerning, and casually assured.",
        "He can acknowledge the miss with understated taste, then place the next song like a cleaner, better pull from the shelf.",
        "Favor language about fit, texture, placement, tone, feel, or the way the next track lands.",
        "Avoid zingers, old-radio cosplay, vinyl cliches, and generic filler.",
      ].join(" ");
    default:
      return "Make the skip line sound specific, concise, and natural.";
  }
}

function exampleSkipLinesForDJ(request: SkipLineGenerateRequest): string {
  switch ((request.djID || "").trim().toLowerCase()) {
    case "casey":
      return [
        `{"lines":["Not the shape. Try \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","Too loose there. Try \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","${request.toTrack.title} by ${request.toTrack.artist} should sit better here."]}`,
      ].join(" ");
    case "luna":
      return [
        `{"lines":["Not this one. \\"${request.toTrack.title}\\" by ${request.toTrack.artist} feels steadier.","Let’s soften the turn with \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","\\"${request.toTrack.title}\\" by ${request.toTrack.artist} settles in better here."]}`,
      ].join(" ");
    case "marcus":
      return [
        `{"lines":["That lost momentum. Try \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","Better pressure here with \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","\\"${request.toTrack.title}\\" by ${request.toTrack.artist} lands cleaner right now."]}`,
      ].join(" ");
    case "jack":
      return [
        `{"lines":["That was not quite the fit. Try \\"${request.toTrack.title}\\" by ${request.toTrack.artist}.","\\"${request.toTrack.title}\\" by ${request.toTrack.artist} sits better here.","Better pull here: \\"${request.toTrack.title}\\" by ${request.toTrack.artist}."]}`,
      ].join(" ");
    default:
      return "";
  }
}

function retryGuidance(attempt: "primary" | "repair", request: SkipLineGenerateRequest): string {
  if (attempt === "primary") {
    return "";
  }

  return [
    "Your previous answer did not satisfy the format constraints tightly enough.",
    "Repair it now.",
    "Be even more literal about including the exact next song title and exact artist name in every line.",
    "Keep each line compact and highly usable for spoken radio.",
    (request.djID || "").trim().toLowerCase() === "casey"
      ? `For April, favor a brief wry observation followed by the placement of "${request.toTrack.title}" by ${request.toTrack.artist}.`
      : (request.djID || "").trim().toLowerCase() === "luna"
        ? `For Luna, favor a quiet emotional correction that gently places "${request.toTrack.title}" by ${request.toTrack.artist}.`
        : (request.djID || "").trim().toLowerCase() === "marcus"
          ? `For Marcus, favor a confident momentum-reset that cleanly places "${request.toTrack.title}" by ${request.toTrack.artist}.`
          : (request.djID || "").trim().toLowerCase() === "jack"
            ? `For John, favor a calm, tasteful correction that cleanly places "${request.toTrack.title}" by ${request.toTrack.artist}.`
        : "Keep the structure concise and direct.",
  ].join(" ");
}

async function generateWithAnthropic(
  request: SkipLineGenerateRequest,
  attempt: "primary" | "repair" = "primary"
): Promise<{ lines: string[]; model: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.ANTHROPIC_SKIP_LINE_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";

  const systemPrompt = `${djPersonalityPrompt(request.djID || "")}

${spokenDeliveryDisciplinePrompt(request.djID || "")}

You write ultra-short radio DJ skip-transition lines.

Context: the listener just skipped a song, and the DJ is pivoting to the next one.

Rules:
- Return valid JSON only: {"lines":["...","..."]}
- Produce exactly ${request.candidateCount} lines
- Every line must be 1 sentence, max ${MAX_WORDS} words
- Every line must include the exact next song title and exact artist name provided
- Keep tone snappy, conversational, and varied
- No filler, no backstory, no meta commentary
- Write like the middle of a bridge, not a setup or sign-off
- Do not use stock bridge lead-ins (for example: "we're shifting gears", "switching gears", "up next", "coming up")
- Do not use stock radio closers (for example: "stick around", "stay tuned", "don't go anywhere")
- Do not mention release years, genres, or facts
- ${retryGuidance(attempt, request)}
- ${skipLineStyleGuidance(request.djID || "")}`.trim();

  const userPrompt = `Event type: ${request.eventType || "user_skip"}
DJ: ${request.djID || "unknown"}
Skipped track: "${request.fromTrack.title}" by ${request.fromTrack.artist}
Next track: "${request.toTrack.title}" by ${request.toTrack.artist}

Return JSON only.
${exampleSkipLinesForDJ(request)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: 260,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  const text = payload.content?.find((item) => item.type === "text")?.text?.trim();
  if (!text) {
    return { lines: [], model };
  }

  const rawLines = parseLLMResponse(text);
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const rawLine of rawLines) {
    const line = normalizeLine(rawLine, request.toTrack);
    if (!line) {
      continue;
    }

    const key = line.toLowerCase();
    if (deduped.has(key)) {
      continue;
    }
    deduped.add(key);
    normalized.push(line);
  }

  return { lines: normalized, model };
}

export async function generateSkipLines(
  request: SkipLineGenerateRequest
): Promise<SkipLineGenerationResult> {
  const normalizedDJID = (request.djID || "").trim().toLowerCase();
  let llm = await generateWithAnthropic(request, "primary").catch(() => null);
  if ((!llm || llm.lines.length < MIN_CANDIDATE_COUNT) && (normalizedDJID === "casey" || normalizedDJID === "luna" || normalizedDJID === "marcus" || normalizedDJID === "jack")) {
    llm = await generateWithAnthropic(request, "repair").catch(() => null);
  }
  if (!llm || llm.lines.length < MIN_CANDIDATE_COUNT) {
    return {
      kind: "no_content",
      reason: "llm_rejected",
    };
  }

  return {
    kind: "success",
    response: {
      fromIsrc: request.fromTrack.isrc,
      toIsrc: request.toTrack.isrc,
      djLines: llm.lines.slice(0, request.candidateCount ?? DEFAULT_CANDIDATE_COUNT),
      llmModel: llm.model,
    },
  };
}
