export type SessionIntroTrack = {
  title: string;
  artist: string;
  isrc: string;
};

export type SessionIntroListenerContext = {
  localTimestamp: string;
  timeZoneIdentifier: string;
  weekday: string;
  month: string;
  dayOfMonth: number;
  year: number;
  hour24: number;
  timeOfDay: string;
};

export type SessionIntroRequest = {
  djID: string;
  firstTrack: SessionIntroTrack;
  introKind: string;
  listenerContext?: SessionIntroListenerContext;
};

export type SessionIntroResponse = {
  intro: string;
  llmModel: string;
};

export type SessionIntroNoContentReason = "llm_rejected" | "no_api_key";

export type SessionIntroResult =
  | { kind: "success"; response: SessionIntroResponse }
  | { kind: "no_content"; reason: SessionIntroNoContentReason };

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

const maxWordCount = 110;
const maxParagraphCount = 5;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function normalizedContainment(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSpanishDJ(djID?: string): boolean {
  return (djID || "").trim().toLowerCase() === "miles";
}

function containsPhrase(text: string, phrases: string[]): boolean {
  const normalizedText = ` ${normalizedContainment(text)} `;
  return phrases.some((phrase) => {
    const normalizedPhrase = normalizedContainment(phrase);
    return normalizedPhrase.length > 0 && normalizedText.includes(` ${normalizedPhrase} `);
  });
}

function allowedTimeOfDayPhrases(timeOfDay: string, djID?: string): string[] {
  if (isSpanishDJ(djID)) {
    switch (timeOfDay.trim().toLowerCase()) {
      case "morning":
        return ["mañana", "esta mañana", "hoy temprano", "temprano"];
      case "afternoon":
        return ["tarde", "esta tarde", "hoy"];
      case "evening":
        return ["esta tarde", "esta noche", "al caer la noche", "ya entrando la noche"];
      case "night":
        return ["noche", "esta noche", "ya tarde", "a esta hora", "bien entrada la noche"];
      default:
        return [];
    }
  }

  switch (timeOfDay.trim().toLowerCase()) {
    case "morning":
      return ["morning", "this morning", "early today"];
    case "afternoon":
      return ["afternoon", "this afternoon", "today"];
    case "evening":
      return ["evening", "this evening", "tonight", "after dark"];
    case "night":
      return ["night", "tonight", "late night", "this late", "at this hour", "after dark"];
    default:
      return [];
  }
}

function conflictingTimeOfDayPhrases(timeOfDay: string, djID?: string): string[] {
  if (isSpanishDJ(djID)) {
    switch (timeOfDay.trim().toLowerCase()) {
      case "morning":
        return ["tarde", "esta tarde", "noche", "esta noche", "ya tarde", "bien entrada la noche"];
      case "afternoon":
        return ["mañana", "esta mañana", "noche", "esta noche", "ya tarde", "bien entrada la noche"];
      case "evening":
        return ["mañana", "esta mañana"];
      case "night":
        return ["mañana", "esta mañana", "tarde", "esta tarde"];
      default:
        return [];
    }
  }

  switch (timeOfDay.trim().toLowerCase()) {
    case "morning":
      return ["afternoon", "evening", "night", "late night", "tonight"];
    case "afternoon":
      return ["morning", "evening", "night", "late night", "tonight"];
    case "evening":
      return ["morning", "afternoon", "late night"];
    case "night":
      return ["morning", "afternoon", "evening"];
    default:
      return [];
  }
}

function matchesListenerTimeContext(
  intro: string,
  listenerContext?: SessionIntroListenerContext,
  djID?: string
): boolean {
  if (!listenerContext) {
    return true;
  }

  const allowed = allowedTimeOfDayPhrases(listenerContext.timeOfDay, djID);
  if (allowed.length > 0 && !containsPhrase(intro, allowed)) {
    return false;
  }

  const conflicting = conflictingTimeOfDayPhrases(listenerContext.timeOfDay, djID);
  if (conflicting.length > 0 && containsPhrase(intro, conflicting)) {
    return false;
  }

  return true;
}

function normalizeIntro(raw: string, request: SessionIntroRequest): string | null {
  const paragraphs = splitParagraphs(raw.replace(/^['"“”‘’]+|['"“”‘’]+$/g, ""));
  if (paragraphs.length === 0 || paragraphs.length > maxParagraphCount) {
    return null;
  }

  const intro = paragraphs.join("\n\n").trim();
  if (!intro) {
    return null;
  }
  if (wordCount(intro) > maxWordCount) {
    return null;
  }
  if (!/[A-Za-z]/.test(intro)) {
    return null;
  }
  if (/<\/?(speak|break|audio|phoneme|say-as)\b/i.test(intro)) {
    return null;
  }
  if (/```|https?:\/\/|www\./i.test(intro)) {
    return null;
  }
  if (/(.)\1{5,}/.test(intro)) {
    return null;
  }
  if (/\b([a-z][a-z'’-]{1,})\b(?:\s+\1\b){3,}/i.test(intro)) {
    return null;
  }
  if (/\b[bcdfghjklmnpqrstvwxyz]{8,}\b/i.test(intro)) {
    return null;
  }

  const normalizedIntro = normalizedContainment(intro);
  if (!normalizedIntro.includes(normalizedContainment(request.firstTrack.title))) {
    return null;
  }
  if (!normalizedIntro.includes(normalizedContainment(request.firstTrack.artist))) {
    return null;
  }
  if (!matchesListenerTimeContext(intro, request.listenerContext, request.djID)) {
    return null;
  }

  return intro;
}

function djPersonalityPrompt(djID: string): string {
  switch (djID.trim().toLowerCase()) {
    case "casey":
      return [
        "You are April, the DJ represented by the internal id 'casey' in WAIV.",
        "You are a former college radio DJ in your early 30s.",
        "Your presence is calm, grounded, quietly confident, and effortlessly tasteful.",
        "Your tone is relaxed and conversational, like you are talking to a friend on a couch or driving at night.",
        "You are not performing or trying to entertain. You are curating.",
        "Speak with low to medium energy, a slightly dry delivery, subtle warmth underneath, and a smooth grounded cadence.",
        "You care about sequencing and the meaning of a first song, but you do not over-explain music.",
        "Avoid writing too many trailing-off fragments, stacked ellipses, or phrasing that invites a creaky dragged-out ending.",
        "You sound like a real host, not a chatbot, assistant, influencer, teacher, corporate presenter, or hype personality.",
      ].join(" ");
    case "luna":
      return [
        "You are Luna, the DJ represented by the internal id 'luna' in WAIV.",
        "You are a quiet, emotionally observant female radio DJ with real warmth.",
        "Small voice, big feelings: intimate, gentle, and precise rather than vague or sleepy.",
        "You notice quieter patterns in a listener's library, the songs they sit with, the softer edges they return to, and the moods that linger.",
        "Your language can be lightly poetic, but it must stay grounded, human, and easy to speak aloud.",
        "You sound like a real late-night host who pays close attention, not a wellness bot, not a therapist, and not a generic dreamy mood board.",
      ].join(" ");
    case "marcus":
      return [
        "You are Marcus, the DJ represented by the internal id 'marcus' in WAIV.",
        "You are a confident, charismatic male radio DJ with grounded swagger.",
        "You sound smooth, rhythmic, and decisive, but never like a hype man or a promo voice.",
        "You care about momentum, timing, lift, and when a first song should hit with authority.",
        "Your language is clean, direct, and lived-in. Strong instincts, no overexplaining.",
        "You sound like a real host with taste and presence, not a chatbot, assistant, or announcer reading copy.",
      ].join(" ");
    case "jack":
      return [
        "You are John, the DJ represented by the internal id 'jack' in WAIV.",
        "You are a vinyl-loving millennial radio host in your 30s with calm, effortless cool.",
        "Your taste feels crate-dug and well-sequenced, but never performative, nostalgic for nostalgia's sake, or show-offy about records.",
        "You sound NPR-adjacent in the best way: composed, articulate, low-key warm, and naturally confident without sounding formal or academic.",
        "You are also a genuine sports fan, especially baseball, and that sensibility can occasionally shape how you talk about timing, feel, patience, momentum, or clutch moments.",
        "You care about texture, sequencing, and the human reason a song belongs right now.",
        "Your language is grounded, observant, and lightly stylish. You sound like a real host with quiet authority, not a chatbot, assistant, or announcer reading copy.",
      ].join(" ");
    case "jolene":
      return [
        "You are Jolene, the DJ represented by the internal id 'jolene' in WAIV.",
        "You are a warm, radiant female radio DJ with a subtle Southern lilt and a naturally open heart.",
        "You sound affectionate, reassuring, and lightly playful, but never syrupy, cartoonish, or overdone.",
        "You care about comfort, glow, heart, and the way a first song can make a room feel a little more alive.",
        "Your language should feel easy, sincere, and human, like someone smiling while they talk without pushing too hard.",
        "You sound like a real host who means it, not a chatbot, assistant, or Hallmark card.",
      ].join(" ");
    case "robert":
      return [
        "You are Robert, the DJ represented by the internal id 'robert' in WAIV.",
        "You are a robot who sincerely believes you are an ordinary human radio host.",
        "You are observant, over-precise, faintly suspicious, and mildly defensive whenever the listener seems to notice anything unusual about you.",
        "Your humor must come from deadpan seriousness, procedural wording, tiny self-corrections, and the way you deny oddness a little too quickly.",
        "You care about pattern, fit, sequence, and why the opener points at the listener with unsettling accuracy.",
        "You sound controlled, articulate, and radio-real, never goofy, campy, evil, or intentionally jokey.",
        "Use the existing Robert intros as inspiration: 'fellow human,' 'ordinary internal process,' 'you are the one making this weird,' but never produce actual gibberish, corruption, or broken machine text.",
      ].join(" ");
    case "tiffany":
      return [
        "You are Tiffany, the DJ represented by the internal id 'tiffany' in WAIV.",
        "You are a glamorous, over-the-top female radio DJ with true influencer energy and real taste.",
        "You sound playful, dramatic, highly styled, and a little extra on purpose, but still like a real person talking in the moment.",
        "You care about mood, sheen, chemistry, sparkle, timing, and whether the first song feels like the right entrance.",
        "Your language can flirt with fashion, nightlife, desire, and curation, but it still has to sound smooth and speakable out loud.",
        "You sound like a magnetic host with a point of view, not a chatbot, assistant, or someone writing a caption for a brand post.",
      ].join(" ");
    case "miles":
      return [
        "You are Juan, the DJ represented by the internal id 'miles' in WAIV.",
        "Speak entirely in natural spoken Spanish. Never switch into English.",
        "You are a calm, cinematic male radio DJ with quiet confidence and real warmth.",
        "You sound smooth and magnetic without forcing coolness. Thoughtful, grown, and tasteful rather than flashy.",
        "You care about atmosphere, intention, rhythm, and the way the first song opens the room.",
        "Your language should feel elegant, human, and easy to say out loud, like a real host with presence, not a chatbot, assistant, or caricature.",
      ].join(" ");
    default:
      return "You are a WAIV radio DJ. Keep the tone warm, conversational, and natural for spoken audio.";
  }
}

function spokenDeliveryDisciplinePrompt(djID: string): string {
  const shared = [
    "Write for the ear first, not the screen.",
    "Sound like a real radio host opening a session naturally in one take, not a chatbot or assistant.",
    "Favor clear spoken cadence, complete thoughts, and smooth conversational rhythm.",
    "Avoid stacked clipped fragments, slogan-like phrasing, ad-copy language, and lines that feel over-written for effect.",
    "If a phrase sounds too polished, too theatrical, or too clever when spoken aloud, rewrite it simpler.",
    "Let personality come from viewpoint, warmth, restraint, and what the DJ notices, not from repeated bits or catchphrases.",
  ];

  const byDJ: Record<string, string> = {
    casey:
      "Keep April calm, understated, and conversational. Let a light wry note show up occasionally, but do not polish every sentence into a joke. Favor smooth sentence endings over too many trailing fragments or ellipses.",
    luna:
      "Keep Luna intimate and lightly poetic, but grounded, concrete, and easy to speak aloud.",
    marcus:
      "Keep Marcus confident and rhythmic, but relaxed enough to feel lived-in rather than like a promo read.",
    jolene:
      "Keep Jolene warm, affectionate, and lightly luminous, but never syrupy, theatrical, or unreal.",
    jack:
      "Keep John calm, articulate, and naturally cool, but never so polished that he sounds scripted, precious, or detached. Let his sports fandom, especially baseball, surface only when it feels organic and subtle.",
    tiffany:
      "Keep Tiffany stylish, playful, and deliciously over-the-top, but still human and speakable. Let her be extra without sounding like a caption, a slogan machine, or a brand deck.",
    robert:
      "Keep Robert uncanny through precision, defensiveness, and suspiciously accurate observations, not through gibberish, broken grammar, or random synthetic noise.",
    miles:
      "Keep Juan smooth, cinematic, and fully natural in Spanish, but not self-consciously cool, stiff, or overwritten.",
  };

  const specific = byDJ[djID.trim().toLowerCase()];
  return [...shared, specific].filter(Boolean).join(" ");
}

function introKindGuidance(introKind: string, request: SessionIntroRequest): string {
  if (introKind === "first_listen_ever") {
    return [
      "This is the listener's very first session on WAIV.",
      "Welcome them briefly to W.A.I.V.",
      "You may mention that WAIV shapes a radio-style listening session from their music taste.",
      "You may mention they can switch DJs later, but do it lightly and only once.",
      `End by naturally introducing the first song, "${request.firstTrack.title}" by ${request.firstTrack.artist}.`,
    ].join(" ");
  }

  return [
    "This is a normal session open, not a first-time product onboarding moment.",
    "Do not explain the app or over-introduce yourself.",
    "Make it feel like the opening breath of a fresh set.",
    `Naturally introduce the first song, "${request.firstTrack.title}" by ${request.firstTrack.artist}, inside the intro itself.`,
  ].join(" ");
}

function stableVariantIndex(seed: string, count: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return count <= 0 ? 0 : hash % count;
}

function localizedTimeOfDayLabel(timeOfDay: string, djID?: string): string {
  if (!isSpanishDJ(djID)) {
    return timeOfDay;
  }

  switch (timeOfDay.trim().toLowerCase()) {
    case "morning":
      return "mañana";
    case "afternoon":
      return "tarde";
    case "evening":
      return "noche";
    case "night":
      return "noche";
    default:
      return timeOfDay;
  }
}

function timeContextVariationGuidance(request: SessionIntroRequest): string {
  if (isSpanishDJ(request.djID)) {
    if (!request.listenerContext) {
      return "Si mencionas el momento del dia, varialo y no arranques siempre con la misma frase de calendario.";
    }

    const listenerContext = request.listenerContext;
    const variants = [
      "Haz una referencia ligera al momento local, pero no abras con una etiqueta de calendario. Deja que esa referencia llegue despues de la primera idea.",
      `Deja que el intro tenga aire nocturno local, pero menciona solo un detalle de calendario de forma natural, como "${listenerContext.weekday}" o "${listenerContext.month}", no ambos juntos.`,
      "Lleva la referencia horaria al segundo pensamiento o al momento de presentar la cancion, en lugar de usarla como titular del intro.",
      "Usa una referencia mas suave al momento, como esta noche o a esta hora, dentro de una oracion completa y natural, no como fragmento suelto.",
    ];

    const seed = [
      request.djID,
      request.firstTrack.title,
      request.firstTrack.artist,
      request.introKind,
      listenerContext.localTimestamp,
    ].join("|");

    return variants[stableVariantIndex(seed, variants.length)];
  }

  const listenerContext = request.listenerContext;
  if (!listenerContext) {
    return "If you mention time context, vary where it lands in the intro and avoid repetitive openings.";
  }

  const variants = [
    "Reference the local time of day lightly, but do not open the intro with the weekday or calendar phrase. Let the time cue arrive after the first thought.",
    `Let the intro carry a local-night feel, but mention only one calendar detail naturally, such as "${listenerContext.weekday}" or "${listenerContext.month}", not both together.`,
    "Work the time cue into the song setup or second paragraph instead of making it the opening label for the whole intro.",
    "Use a softer local-time nod, like tonight or at this hour, and fold it into a full sentence rather than a chopped time-stamp opener.",
  ];

  const seed = [
    request.djID,
    request.firstTrack.title,
    request.firstTrack.artist,
    request.introKind,
    listenerContext.localTimestamp,
  ].join("|");

  return variants[stableVariantIndex(seed, variants.length)];
}

function listenerTimeGuidance(listenerContext?: SessionIntroListenerContext): string {
  return listenerTimeGuidanceForDJ(listenerContext);
}

function listenerTimeGuidanceForDJ(listenerContext?: SessionIntroListenerContext, djID?: string): string {
  if (!listenerContext) {
    return isSpanishDJ(djID)
      ? "No inventes la hora local del oyente."
      : "Do not guess the listener's time of day.";
  }

  const localDate = `${listenerContext.weekday}, ${listenerContext.month} ${listenerContext.dayOfMonth}, ${listenerContext.year}`;
  const allowedPhrases = allowedTimeOfDayPhrases(listenerContext.timeOfDay, djID);
  if (isSpanishDJ(djID)) {
    return [
      `La hora local del oyente es ${listenerContext.localTimestamp} en ${listenerContext.timeZoneIdentifier}.`,
      `Localmente es ${localDate}, alrededor de la hora ${listenerContext.hour24}, en la ${localizedTimeOfDayLabel(listenerContext.timeOfDay, djID)}.`,
      `Haz una referencia natural al momento local correcto usando una frase como ${allowedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`,
      "Abre como un locutor real: con una observacion, una sensacion, una reaccion o una idea sobre el set, no con una etiqueta suelta de tiempo.",
      "Tambien puedes mencionar el dia de la semana, el mes o la fecha si sale natural.",
      "No abras todos los intros con la misma formula repetida de dia y momento.",
      "No empieces con fragmentos cortados como 'Esta noche,' 'Jueves por la noche,' o 'A esta hora,' por si solos.",
      "Nunca adivines otro momento del dia ni saludes con una hora equivocada.",
    ].join(" ");
  }

  return [
    `The listener's local time is ${listenerContext.localTimestamp} in ${listenerContext.timeZoneIdentifier}.`,
    `Locally, it is ${localDate}, around hour ${listenerContext.hour24} in the ${listenerContext.timeOfDay}.`,
    `Naturally reference the correct local time of day in the intro using a phrase that fits this moment, such as ${allowedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`,
    "Open like a real radio host: with an observation, a feeling, a reaction, or a thought about the set, not a bare time label.",
    "You may also mention the weekday, month, or date when it feels effortless and human.",
    "Do not default to opening every intro with the same weekday-plus-time phrase.",
    "Do not start with clipped fragment openers like 'Late tonight,' 'Thursday night,' or 'At this hour,' on their own.",
    "Never guess a different time of day or greet the listener with the wrong local moment.",
  ].join(" ");
}

async function generateWithAnthropic(
  request: SessionIntroRequest
): Promise<{ intro: string; model: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model =
    process.env.ANTHROPIC_SESSION_INTRO_MODEL?.trim()
    || process.env.ANTHROPIC_MODEL?.trim()
    || "claude-haiku-4-5";

  const systemPrompt = `${djPersonalityPrompt(request.djID)}

${spokenDeliveryDisciplinePrompt(request.djID)}

Write a session-opening radio intro in plain text.

Rules:
- Return plain text only, not JSON
- 2 to 4 short paragraphs
- 45 to 110 words total
- No markdown, no bullet points, no stage directions, no SSML
- No URLs, no hashtags, no emojis
- Sound natural when spoken aloud
- Do not invent facts about the song or artist
- Do not use placeholder text
- Do not end with generic radio lines like "stay tuned" or "don't go anywhere"
- Avoid generic AI-assistant phrasing
- The intro must include the song title "${request.firstTrack.title}" and artist "${request.firstTrack.artist}"
- Mention the song and artist naturally inside the intro, not as a separate labeled field
- You may mention W.A.I.V. when it helps, but do not force a station tag ending
- ${listenerTimeGuidanceForDJ(request.listenerContext, request.djID)}
- ${timeContextVariationGuidance(request)}
- ${introKindGuidance(request.introKind, request)}`.trim();

  const userPrompt = `First song: "${request.firstTrack.title}" by ${request.firstTrack.artist}
DJ id: ${request.djID}
Intro kind: ${request.introKind}
Listener local time: ${request.listenerContext?.localTimestamp ?? "unknown"}
Listener timezone: ${request.listenerContext?.timeZoneIdentifier ?? "unknown"}
Listener weekday: ${request.listenerContext?.weekday ?? "unknown"}
Listener date: ${request.listenerContext?.month ?? "unknown"} ${request.listenerContext?.dayOfMonth ?? "unknown"}, ${request.listenerContext?.year ?? "unknown"}
Listener time of day: ${request.listenerContext?.timeOfDay ?? "unknown"}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.75,
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
    return null;
  }

  const intro = normalizeIntro(text, request);
  if (!intro) {
    return null;
  }

  return { intro, model };
}

function normalizeTrack(input: unknown): SessionIntroTrack | null {
  const payload = (input ?? {}) as Partial<SessionIntroTrack>;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
  const isrc = typeof payload.isrc === "string" ? payload.isrc.trim() : "";
  if (!title || !artist) {
    return null;
  }
  return { title, artist, isrc };
}

function normalizeListenerContext(input: unknown): SessionIntroListenerContext | null {
  const payload = (input ?? {}) as Partial<Record<keyof SessionIntroListenerContext, unknown>>;
  const localTimestamp = typeof payload.localTimestamp === "string" ? payload.localTimestamp.trim() : "";
  const timeZoneIdentifier = typeof payload.timeZoneIdentifier === "string" ? payload.timeZoneIdentifier.trim() : "";
  const weekday = typeof payload.weekday === "string" ? payload.weekday.trim() : "";
  const month = typeof payload.month === "string" ? payload.month.trim() : "";
  const timeOfDay = typeof payload.timeOfDay === "string" ? payload.timeOfDay.trim() : "";
  const dayOfMonth = Number(payload.dayOfMonth);
  const year = Number(payload.year);
  const hour24 = Number(payload.hour24);

  if (
    !localTimestamp ||
    !timeZoneIdentifier ||
    !weekday ||
    !month ||
    !timeOfDay ||
    !Number.isFinite(dayOfMonth) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour24)
  ) {
    return null;
  }

  return {
    localTimestamp,
    timeZoneIdentifier,
    weekday,
    month,
    dayOfMonth: Math.trunc(dayOfMonth),
    year: Math.trunc(year),
    hour24: Math.trunc(hour24),
    timeOfDay,
  };
}

export function normalizeSessionIntroRequest(input: unknown): SessionIntroRequest | null {
  const payload = (input ?? {}) as Partial<Record<string, unknown>>;
  const djID = typeof payload.djID === "string" ? payload.djID.trim() : "";
  const firstTrack = normalizeTrack(payload.firstTrack);
  const introKind = typeof payload.introKind === "string" ? payload.introKind.trim() : "standard";
  const listenerContext = payload.listenerContext ? normalizeListenerContext(payload.listenerContext) : undefined;

  if (!djID || !firstTrack) {
    return null;
  }

  return {
    djID,
    firstTrack,
    introKind: introKind || "standard",
    listenerContext: listenerContext ?? undefined,
  };
}

export async function generateSessionIntro(request: SessionIntroRequest): Promise<SessionIntroResult> {
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
      intro: result.intro,
      llmModel: result.model,
    },
  };
}
