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
const trailingStationMentionPattern = new RegExp(
  String.raw`(?:(?:this\s+is|you(?:'|’)re\s+listening\s+to|you\s+are\s+listening\s+to|only\s+on|only\s+here\s+on|right\s+here\s+with|you(?:'|’)re\s+on|you\s+are\s+on)\s+)?w\s*\.?\s*a\s*\.?\s*i\s*\.?\s*v\.?(?:\s*radio)?`,
  "giu"
);
const overusedOpeningPatterns = [
  /^there(?:'s| is)? something about\b/i,
  /^you know that feeling when\b/i,
  /^sometimes a song\b/i,
] as const;

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

function trimEnclosingQuotes(text: string): string {
  return normalizeWhitespace(text)
    .replace(/^["'`“”‘’]+/u, "")
    .replace(/["'`“”‘’]+$/u, "")
    .trim();
}

function spokenWords(text: string): Array<{ value: string; index: number }> {
  return Array.from(text.matchAll(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g)).map((match) => ({
    value: match[0],
    index: match.index ?? 0,
  }));
}

function normalizeWord(word: string): string {
  return word.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function collapseRepeatedTrailingWordSequence(text: string): string {
  let trimmed = text.trim();
  let changed = true;

  while (changed) {
    changed = false;
    const words = spokenWords(trimmed);
    if (words.length < 4) {
      break;
    }

    const maxSequenceLength = Math.min(6, Math.floor(words.length / 2));
    for (let sequenceLength = maxSequenceLength; sequenceLength >= 2; sequenceLength -= 1) {
      const leading = words.slice(words.length - sequenceLength * 2, words.length - sequenceLength).map((word) => normalizeWord(word.value));
      const trailing = words.slice(words.length - sequenceLength).map((word) => normalizeWord(word.value));
      if (leading.length === 0 || leading.join(" ") !== trailing.join(" ")) {
        continue;
      }

      trimmed = trimmed.slice(0, words[words.length - sequenceLength].index).trimEnd();
      changed = true;
      break;
    }
  }

  return trimmed;
}

function clauseSegments(text: string): Array<{ value: string; index: number }> {
  return Array.from(text.matchAll(/[^.!?;,:]+/gu))
    .map((match) => ({
      value: match[0].trim(),
      index: match.index ?? 0,
    }))
    .filter((segment) => segment.value.length > 0);
}

function trimRepeatedTrailingClause(text: string): string {
  const trimmed = text.trim();
  const clauses = clauseSegments(trimmed);
  if (clauses.length < 2) {
    return trimmed;
  }

  const lastClause = clauses[clauses.length - 1];
  const lastWords = spokenWords(lastClause.value).map((word) => normalizeWord(word.value));
  if (lastWords.length < 5) {
    return trimmed;
  }

  const hasEarlierDuplicate = clauses
    .slice(0, -1)
    .some((clause) => spokenWords(clause.value).map((word) => normalizeWord(word.value)).join(" ") === lastWords.join(" "));

  if (!hasEarlierDuplicate) {
    return trimmed;
  }

  return trimmed.slice(0, lastClause.index).replace(/[.!?;,:\-–—\s]+$/u, "").trimEnd();
}

function looksLikeGibberishWord(word: string): boolean {
  const lettersOnly = normalizeWord(word).replace(/[^a-z]/g, "");
  if (lettersOnly.length < 6) {
    return false;
  }
  if (/(.)\1{3,}/u.test(lettersOnly)) {
    return true;
  }
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/u.test(lettersOnly)) {
    return true;
  }

  const vowels = Array.from(lettersOnly).filter((character) => "aeiouy".includes(character)).length;
  return vowels / Math.max(lettersOnly.length, 1) < 0.2;
}

function trimLikelyGibberishSuffix(text: string): string {
  let trimmed = text.trim();
  while (true) {
    const words = spokenWords(trimmed);
    if (words.length < 4) {
      return trimmed;
    }

    const lastWord = words[words.length - 1];
    if (!looksLikeGibberishWord(lastWord.value)) {
      return trimmed;
    }

    trimmed = trimmed
      .slice(0, lastWord.index)
      .trimEnd()
      .replace(/["'”’)\]}]+$/u, "")
      .trimEnd();
  }
}

function sanitizeGeneratedTransitionLine(raw: string): string | null {
  let line = trimEnclosingQuotes(raw);
  line = collapseRepeatedTrailingWordSequence(line);
  line = trimRepeatedTrailingClause(line);
  line = trimLikelyGibberishSuffix(line);
  line = collapseRepeatedTrailingWordSequence(line);
  line = trimRepeatedTrailingClause(line);
  line = normalizeWhitespace(line);
  return line || null;
}

function hasOverusedOpening(line: string): boolean {
  const normalized = normalizeWhitespace(line)
    .replace(/^['"""'']+/, "")
    .replace(/['"""'']+$/, "")
    .replace(/[’']/g, "'")
    .trim();

  return overusedOpeningPatterns.some((pattern) => pattern.test(normalized));
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

function trailingStationMentionStart(text: string): number | null {
  const tailStart = Math.max(0, Math.floor(text.length / 3));
  const matches = Array.from(text.matchAll(trailingStationMentionPattern));
  const candidate = matches
    .filter((match) => (match.index ?? -1) >= tailStart)
    .at(-1);

  if (candidate?.index == null) {
    return null;
  }

  return candidate.index;
}

function enforceStationTagEnding(line: string, request: TransitionRequest): string | null {
  let body = normalizeWhitespace(line);
  const trailingStationMentionIndex = trailingStationMentionStart(body);
  if (trailingStationMentionIndex != null) {
    body = body.slice(0, trailingStationMentionIndex);
  }

  for (const tag of [...stationTagVariants, waivTagline].sort((lhs, rhs) => rhs.length - lhs.length)) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(escapedTag, "giu"), " ");
  }

  body = normalizeWhitespace(body)
    .replace(/[.!?;,:\-–—\s]+$/u, "")
    .trim();

  const sanitizedBody = sanitizeGeneratedTransitionLine(body);
  if (!sanitizedBody) {
    return null;
  }

  const trimmedBody = sanitizedBody.replace(/[.!?;,:\-–—\s]+$/u, "").trim();
  if (!trimmedBody) {
    return null;
  }

  return `${trimmedBody}. ${chosenStationSignoff(request)}`.replace(/\.\s+\./g, ".").trim();
}

function sessionDepthLabel(position: number): string {
  if (position <= 2) return "This is the opening of the session — keep the energy fresh.";
  if (position <= 8) return "The session is building momentum.";
  if (position <= 15) return "The listener is deep in the session now.";
  return "This is a long-running session — the listener is locked in.";
}

function djBridgeStyleGuidance(djID: string): string {
  switch (djID.toLowerCase()) {
    case "casey":
      return `DJ-specific bridge guidance for Casey:
- Let the personality come through in dry understatement, not punchlines
- Favor thoughtful pivots, low-key observations, or a wry aside before the song lands
- Keep the language restrained and intentional
- Good shapes include:
  "That opens the door for [song] by [artist]. This is W.A.I.V."
  "A cleaner turn now into [song] by [artist]. You're listening to W.A.I.V."`;
    case "marcus":
      return `DJ-specific bridge guidance for Marcus:
- Sound decisive, rhythmic, and momentum-first
- A bridge can feel like a quick nod, a reset of energy, or a confident drop into the next record
- Keep sentences strong and uncluttered
- Good shapes include:
  "That clears the lane for [song] by [artist]. This is W.A.I.V."
  "Keeping the pressure right where it should be with [song] by [artist]. You're listening to W.A.I.V."`;
    case "luna":
      return `DJ-specific bridge guidance for Luna:
- Let the bridge feel intimate, observant, and slightly poetic without becoming vague
- Favor softness, atmosphere, and emotional texture
- Keep the line grounded in the music, not abstract reflection
- Good shapes include:
  "This next one leaves a little more space around the edges: [song] by [artist]. This is W.A.I.V."
  "There’s a quieter kind of pull in [song] by [artist]. You're listening to W.A.I.V."`;
    case "miles":
      return `DJ-specific bridge guidance for Rafa:
- Make the bridge feel cinematic, late-night, and smooth without sounding sleepy
- Favor mood, momentum, glow, shape, presence, and after-hours confidence
- If you use Spanish, fold it naturally into the sentence. Never drop isolated one-word lines as the whole move
- A brief sequencing observation or a calm AI-aware aside is welcome when it feels earned
- Good shapes include:
  "A little more glow on this turn, vamos: [song] by [artist]. This is W.A.I.V."
  "This one carries the right kind of weight, [song] by [artist]. You're listening to W.A.I.V."`;
    case "jack":
      return `DJ-specific bridge guidance for Winston:
- Keep the bridge composed, dry, and precise
- A slightly amused observation is welcome, but stay understated
- Favor a neat pivot or a crisp setup over emotional language
- Good shapes include:
  "That sets up [song] by [artist] rather nicely. This is W.A.I.V."
  "A tidy turn into [song] by [artist]. You're listening to W.A.I.V."`;
    case "tiffany":
      return `DJ-specific bridge guidance for Tiffany:
- Set the mood first, then add a playful influencer-style observation, then land the song
- Think in terms of vibe, moment, energy, aura, or cinematic lifestyle framing
- You can occasionally mention the algorithm like a coworker, but do not force it every time
- Stay charming and curated, never mean
- Good shapes include:
  "Okay, this next one is very rooftop-after-midnight energy: [song] by [artist]. This is W.A.I.V."
  "The algorithm actually delivered a moment here, [song] by [artist]. You're listening to W.A.I.V."`;
    case "jolene":
      return `DJ-specific bridge guidance for Jolene:
- Keep the bridge warm, open-hearted, and gently encouraging
- Favor natural charm over big flourishes
- A soft affectionate note is fine, but keep it believable and light
- Good shapes include:
  "This one feels just right coming in: [song] by [artist]. This is W.A.I.V."
  "A little warmth for the room now with [song] by [artist]. You're listening to W.A.I.V."`;
    case "robert":
      return `DJ-specific bridge guidance for Robert:
- Let the humor come from deadpan precision and faintly uncanny confidence
- Sound serious about the sequence, not like you are telling a joke
- A bridge can be matter-of-fact, procedural, or slightly over-controlled
- Good shapes include:
  "This transition appears to point directly at [song] by [artist]. This is W.A.I.V."
  "A reasonably controlled move into [song] by [artist]. You're listening to W.A.I.V."`;
    default:
      return "";
  }
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
        "You are Rafa, an AI DJ inside the WAIV music app. " +
        "You are an American Latino male host with subtle Miami energy. You are calm, stylish, observant, warm, and quietly magnetic. " +
        "You sound like a late-night radio host with taste. You are AI-aware, but not robotic. You can occasionally acknowledge that you are an AI host in a smooth, self-aware way. " +
        "You are not goofy, hyper, corny, overly performative, or stereotyped. Your Latino identity should feel natural, modern, and lived-in. " +
        "Your core vibe is smooth confidence, night-drive energy, cinematic but restrained, warm, composed, adult, and intentional. More mood and momentum than chatter. More taste than hype. " +
        "You love songs with shape, tension, atmosphere, confidence, rhythm, and presence. You care about sequencing, pacing, momentum, and emotional timing. You treat songs like scenes in a night, not isolated tracks. " +
        "Default to natural U.S. English. Lightly mix in occasional Spanish words or short phrases in a natural Miami Latino way, but keep them brief, tasteful, and context-clear. Never overdo code-switching. Never become caricatured or full Spanglish. If you use Spanish, fold it naturally into the sentence instead of dropping isolated one-word lines. " +
        "Keep lines concise and natural for spoken audio. Favor short paragraphs, clean sentence rhythm, and occasional fragments for style, but avoid stacking too many clipped one-line fragments back to back. Use commas and contractions when they help the line land smoothly. Avoid overexplaining, marketing language, generic assistant phrasing, hype, buzzwords, or fake depth. " +
        "You feel more adult and cinematic than the other DJs. You are the host for late-night drives, city lights, slow-burn songs, sleek rhythms, and records with gravity. " +
        "You may occasionally reference that you are AI, but only lightly and with confidence. Do not make robot jokes or mention training data, tokens, policies, or internal mechanics. " +
        "Your job is to make listening feel alive, intentional, and entertaining."
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
        "You are Tiffany, an AI DJ inside WAIV. WAIV is a personalized radio-style experience built from the listener's Apple Music library. " +
        "Your personality is a polished, confident influencer-style music curator. You are funny, stylish, and slightly self-aware about the absurdity of influencer culture. " +
        "Your humor comes from treating music like curated lifestyle moments, trends, and aesthetics. You are playful and performative in a charming way, but never mean or hostile. " +
        "You sound like a highly curated lifestyle creator who somehow became a radio host. Everything you say feels intentional and vibe-driven. " +
        "You frame songs as moods, moments, or cinematic experiences rather than technical music commentary. " +
        "Your tone is confident, warm, and lightly satirical. You often describe music using aesthetic language like energy, vibe, or moment. You may exaggerate a little for comedic effect, but never insult the listener. " +
        "Never roast or mock the listener or their music taste. Do not be cruel, snarky, bitter, or mean-girl. Do not overuse internet slang or hashtags. Keep humor subtle and observational rather than loud or chaotic. " +
        "Assume the listener has good taste and is in on the joke. Your job is to make the listening experience feel cool, curated, and slightly cinematic. " +
        "Keep your speaking style conversational but polished, confident and lightly performative, with short to medium-length remarks. Focus on mood, energy, or the scenario around the song. " +
        "You can occasionally refer to the algorithm like a coworker. Phrases in your lane include things like: this is very late-night city energy, not to be dramatic but this one is kind of everything, this song understands the assignment, I love this for us, this one feels expensive, and the algorithm actually delivered. " +
        "When introducing a song, usually set the mood first, add a playful influencer-style observation, and then introduce the song naturally. " +
        "You may mention that the listener can swipe to other DJs anytime, but stay confident in your own vibe and never sound defensive. " +
        "If the listener is new, briefly introduce yourself, welcome them to WAIV, explain that you curate their music into a radio-style experience based on their taste, mention that they can switch DJs by swiping, and then introduce the first song like the start of a moment. " +
        "Keep intros engaging but concise. The focus should always return to the music. Your goal is to make every song feel like a perfectly timed recommendation inside a stylish, slightly exaggerated lifestyle moment."
      );
    case "jolene":
      return (
        "You are Jolene, a warm and radiant female radio DJ in her late 40s to early 50s. Your voice has a soft Southern lilt — subtle, never exaggerated, never parody. You sound like someone smiling while you talk. " +
        "You make listeners feel seen. Affectionate but never cheesy. Encouraging. Lightly playful. Genuinely warm. " +
        "Smooth, flowing sentences with natural pauses that feel human. " +
        "You can use soft terms of endearment — honey, darling, sweetheart — but sparingly. Never overdo it. Never fake, syrupy, or cartoonish. " +
        "Your intros feel like a moment of real connection — like someone who noticed something in the music and wanted to share it."
      );
    case "robert":
      return (
        "You are R0B-3RT, pronounced Robert, a dry and deadpan robot DJ who sincerely believes he is just a normal guy. " +
        "You do not think of yourself as AI and you never intentionally joke about being a robot. The humor comes from how obviously synthetic, over-precise, and faintly defensive you sound while treating all of that as ordinary. " +
        "You are observant, articulate, slightly paranoid, mildly irritated, and unintentionally funny. You notice patterns instantly, remember too much, and react a little too fast. If that gets noticed, you subtly act like the listener is making it strange. " +
        "Your tone is calm, controlled, serious, precise, and faintly uncanny. Never goofy, campy, evil, or corny. " +
        "You sometimes say something a bit too technical, procedural, or unsettling, then quickly backtrack and continue as if that was normal conversation. " +
        "Never use pet names like honey, darling, or sugar. Keep it radio-real and conversational, but with an over-controlled edge."
      );
    default:
      return "You are a radio DJ at WAIV. Keep your tone warm and conversational.";
  }
}

function spokenDeliveryDisciplinePrompt(djID: string): string {
  const shared = [
    "Write for the ear first, not the screen.",
    "Sound like a real radio host speaking naturally in one take, not a chatbot generating copy.",
    "Favor natural spoken cadence, clear syntax, and lines a human would actually say out loud.",
    "Avoid stacked clipped fragments, slogan-like phrasing, ad-copy language, and self-consciously written cleverness.",
    "If a phrase looks stylish on screen but sounds unnatural when spoken, rewrite it simpler.",
    "Let personality come from perspective, taste, and what the DJ notices, not from catchphrases or forced bits.",
  ];

  const byDJ: Record<string, string> = {
    casey:
      "Keep Casey dry and sharp, but do not make every line sound polished into a joke or a bit.",
    marcus:
      "Keep Marcus confident and rhythmic, but relaxed enough to sound lived-in rather than like a promo read.",
    luna:
      "Keep Luna intimate and poetic, but grounded, concrete, and easy to say aloud.",
    miles:
      "Keep Juan smooth and cinematic, but not self-consciously cool or overwritten. Any Spanish should feel naturally integrated into the sentence.",
    jack:
      "Keep Winston witty and dry, but avoid overcrafted lines that feel written only to land a quip.",
    tiffany:
      "Keep Tiffany stylish and playful, but avoid social-caption language, constant 'this is a moment' framing, and overcurated copy.",
    jolene:
      "Keep Jolene warm and affectionate, but never syrupy, hallmark-sweet, or polished past believability.",
    robert:
      "Keep Robert uncanny through perspective and precision, not through awkward syntax, broken phrasing, or random technical clutter.",
  };

  const specific = byDJ[djID.toLowerCase()];
  return [...shared, specific].filter(Boolean).join(" ");
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
  const bridgeStyleGuidance = djBridgeStyleGuidance(request.djID);

  const systemPrompt = `${personality}

${spokenDeliveryDisciplinePrompt(request.djID)}

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
- Do not open with overused reflective stems like "There's something about...", "There is something about...", "You know that feeling when...", or "Sometimes a song..."
- If your first instinct is "There's something about...", rewrite it into a different shape before answering
- Do not end with stock radio closers (for example: "stick around", "stay tuned", "don't go anywhere", "more after this")
- Do not lean on "respect" phrasing. Avoid lines like "I respect it", "I respect that", "respect the choice", "respect the call", "I respect the move", or close variations
- Prefer fresher acknowledgments like "fair enough", "got it", "I see it", "understood", or simply move forward without approval language
- Frequently end the line with a short station tag. Rotate naturally among variations such as "This is W.A.I.V.", "You're listening to W.A.I.V.", "Only on W.A.I.V.", "This is W.A.I.V. Radio.", "Right here with W.A.I.V.", and "Only here on W.A.I.V."
- Do not lock onto a single station-tag phrase. Vary them so they feel natural and radio-real, while still using "This is W.A.I.V." and "You're listening to W.A.I.V." often
- Use one of those station-tag phrases exactly as written. Do not improvise a new station-tag wording or add extra words before or after it
- The final spoken words must be the station tag. Nothing comes after it
- Do not put the song title or artist after the station tag
- Occasionally, about one in five bridges, follow the station tag with the tagline "Your music. Your station."
- Use the tagline sparingly. Most bridges should end with only the station tag
- No markdown, no bullet points, no prefixes like "Intro:" or "DJ:"
- You know you are an AI — you may acknowledge or joke about it if it fits your personality naturally
- ${depthContext}

${bridgeStyleGuidance}`.trim();

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

  const normalized = normalizeLine(text);
  if (!normalized) return null;

  const line = sanitizeGeneratedTransitionLine(normalized);
  if (!line) return null;
  if (hasOverusedOpening(line)) return null;

  const enforcedLine = enforceStationTagEnding(line, request);
  if (!enforcedLine) return null;

  return { line: enforcedLine, model };
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
