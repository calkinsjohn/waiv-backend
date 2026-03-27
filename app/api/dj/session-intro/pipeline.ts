export type SessionIntroTrack = {
  title: string;
  artist: string;
  isrc: string;
};

export type ListenerProfile = {
  topArtists?: string[];
  recentArtists?: string[];
  tasteKeywords?: string[];
  listeningPattern?: string;
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

export type SessionIntroTimeContext = {
  timeOfDay: string;
  dayOfWeek: string;
  isWeekend: boolean;
  label: string;
};

export type SessionIntroSetContext = {
  openingTrackRole: string;
  openingTrackMood: string[];
  openingTrackEnergy: number;
  openingTrackTexture: string[];
  openingTrackFamiliarity?: string;
  openingTrackDiscoveryMode?: string;
};

export type SessionIntroShowListenerContext = {
  isFirstSessionToday: boolean;
  returningAfterGap: boolean;
  changedDjsRecently: boolean;
  skipsIntrosOften: boolean;
};

export type SessionIntroEnvironmentContext = {
  season: string;
  weatherVibe?: string | null;
  localeVibe?: string | null;
};

export type SessionIntroRecentHistory = {
  recentArchetypes: string[];
  recentOpeningStructures: string[];
  recentOpeningPhrases: string[];
  recentSentenceCounts: number[];
  recentHandoffStyles: string[];
  recentVocabulary: string[];
  recentEmotionalTones: string[];
  recentOpeningStyles?: string[];
  recentLengths?: string[];
  recentStationStyles?: string[];
  usedTimeReferenceRecently: boolean;
  usedAISelfAwarenessRecently: boolean;
};

export type SessionIntroShowContext = {
  djId: string;
  sessionType: string;
  timeContext: SessionIntroTimeContext;
  setContext: SessionIntroSetContext;
  listenerContext: SessionIntroShowListenerContext;
  environmentContext: SessionIntroEnvironmentContext;
  recentHistory: SessionIntroRecentHistory;
};

export type SessionIntroRequest = {
  djID: string;
  firstTrack: SessionIntroTrack;
  introKind: string;
  listenerContext?: SessionIntroListenerContext;
  showContext?: SessionIntroShowContext;
  personaHint?: string;
  toneGuardrails?: string;
  listenerProfile?: ListenerProfile | null;
};

export type SessionIntroMetadata = {
  archetype: string;
  sessionType: string;
  openingStructure: string;
  handoffStyle: string;
  emotionalTone: string;
  vocabulary: string[];
  usedTimeReference: boolean;
  usedAISelfAwareness: boolean;
  sentenceCount: number;
  openingStyle: string;
  length: string;
  stationStyle: string;
  timeAnchor: string;
  curationAngle: string;
};

export type SessionIntroResponse = {
  intro: string;
  llmModel: string;
  metadata: SessionIntroMetadata;
};

export type SessionIntroNoContentReason = "llm_rejected" | "no_api_key";

export type SessionIntroResult =
  | { kind: "success"; response: SessionIntroResponse }
  | { kind: "no_content"; reason: SessionIntroNoContentReason };

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

type IntroOpeningStyle = "cold_open" | "direct" | "atmospheric" | "in_motion";
type IntroLength = "short" | "medium" | "long";
type IntroStationStyle = "WAIV" | "W.A.I.V." | "omit_station_once_in_awhile";
type IntroHandoffStyle = "clean" | "dramatic" | "understated" | "conversational";
type IntroFamiliarity = "highly_familiar" | "moderately_familiar" | "exploratory";
type IntroLayerName =
  | "sonicMoment"
  | "presenceIdentity"
  | "realWorldAnchor"
  | "curatorAngle"
  | "firstTrackHandoff";

type GeneratedPayload = {
  intro?: string;
  metadata?: Partial<SessionIntroMetadata>;
};

type DJConfig = {
  id: string;
  onAirName: string;
  language: "en" | "es";
  personaSummary: string;
  voiceNotes: string[];
  doNotDo: string[];
  openingStyleWeights: Record<IntroOpeningStyle, number>;
  stationStyleWeights: Record<IntroStationStyle, number>;
  handoffStyleWeights: Record<IntroHandoffStyle, number>;
  moodWords: string[];
  stationPresenceExamples: string[];
  sonicMomentExamples: string[];
  curatorMoves: string[];
  anchorMoves: string[];
};

type IntroDecisionPlan = {
  openingStyle: IntroOpeningStyle;
  length: IntroLength;
  stationStyle: IntroStationStyle;
  familiarity: IntroFamiliarity;
  handoffStyle: IntroHandoffStyle;
  timeAnchor: string;
  moodAnchor: string;
  curationAngle: string;
  linePattern: IntroLayerName[][];
  stationPresenceExample: string;
  sonicMomentCue: string;
  energyProfile: "energetic" | "steady" | "reflective";
};

const genericIntroPhrases = [
  "lets dive in",
  "welcome to your personalized experience",
  "im excited to play music for you",
  "based on your preferences",
  "based on your listening",
  "based on your taste",
  "i analyzed your listening patterns",
  "personalized playlist",
  "curated just for you",
  "this is such a vibe",
  "main character energy",
  "understood the assignment",
];

const genericIntroPlatitudePatterns = [
  /\bemotional weather\b/i,
  /\bmain character\b/i,
  /\bunderstood the assignment\b/i,
  /\bplaylist\b/i,
  /\bpersonalized experience\b/i,
  /\blet'?s dive in\b/i,
  /\bthis is such a vibe\b/i,
  /\bfor your listening journey\b/i,
  /\bperfect track\b/i,
  /\bperfect opener\b/i,
  /\bmade just for you\b/i,
  /\bvapid\b/i,
] as const;

const bannedStandaloneOpeners = [
  "It is",
  "Tonight is",
  "Thursday night,",
  "Friday night,",
  "At this hour,",
  "Late tonight,",
];

const minWordCountByLength: Record<IntroLength, number> = {
  short: 16,
  medium: 28,
  long: 40,
};

const maxWordCountByLength: Record<IntroLength, number> = {
  short: 52,
  medium: 88,
  long: 120,
};

const maxParagraphCountByLength: Record<IntroLength, number> = {
  short: 3,
  medium: 5,
  long: 7,
};

const minSentenceCountByLength: Record<IntroLength, number> = {
  short: 2,
  medium: 3,
  long: 4,
};

const maxSentenceCountByLength: Record<IntroLength, number> = {
  short: 4,
  medium: 6,
  long: 8,
};

const djConfigs: Record<string, DJConfig> = {
  casey: {
    id: "casey",
    onAirName: "April",
    language: "en",
    personaSummary: "Cool, dry, ex-college-radio energy. Taste-forward, restrained, slightly self-aware.",
    voiceNotes: [
      "Sound like a real host who has done this for years and doesn't need to force it.",
      "April is never peppy, never ad-copy polished, and never explaining the app.",
      "She values understatement, sequencing, and one precise reason a first record belongs.",
    ],
    doNotDo: ["peppy banter", "assistant language", "vapid moodboard copy"],
    openingStyleWeights: { cold_open: 0.18, direct: 0.26, atmospheric: 0.22, in_motion: 0.34 },
    stationStyleWeights: { WAIV: 0.32, "W.A.I.V.": 0.22, omit_station_once_in_awhile: 0.46 },
    handoffStyleWeights: { clean: 0.24, dramatic: 0.08, understated: 0.48, conversational: 0.2 },
    moodWords: ["dry", "steady", "intentional", "cool"],
    stationPresenceExamples: ["April here, on WAIV.", "April with you.", "WAIV. April here."],
    sonicMomentExamples: ["Alright.", "Okay, this feels right.", "Let's keep this simple.", "Late one tonight."],
    curatorMoves: ["Wanted to start somewhere familiar.", "This felt like the right kind of opener.", "I wanted a first move with some patience."],
    anchorMoves: ["Feels like a slow Thursday.", "Right about the part of the night where everything softens.", "Middle of the afternoon, but we're not rushing it."],
  },
  marcus: {
    id: "marcus",
    onAirName: "Marcus",
    language: "en",
    personaSummary: "Animated, controlled, live-wire momentum. A set with Marcus should feel like an event.",
    voiceNotes: [
      "Marcus has lift and authority without sounding like a promo read.",
      "He is already moving when the mic opens.",
      "He frames the opener like the first real move of a set.",
    ],
    doNotDo: ["hype-man shouting", "generic 'welcome back' copy", "empty swagger"],
    openingStyleWeights: { cold_open: 0.26, direct: 0.24, atmospheric: 0.08, in_motion: 0.42 },
    stationStyleWeights: { WAIV: 0.18, "W.A.I.V.": 0.54, omit_station_once_in_awhile: 0.28 },
    handoffStyleWeights: { clean: 0.22, dramatic: 0.32, understated: 0.08, conversational: 0.38 },
    moodWords: ["alive", "moving", "locked-in", "bright"],
    stationPresenceExamples: ["This is Marcus on W.A.I.V.", "Marcus with you on WAIV.", "Marcus here. W.A.I.V."],
    sonicMomentExamples: ["Alright, let's go.", "Okay.", "We're on.", "There it is."],
    curatorMoves: ["No warm-up record tonight.", "Wanted the set to hit right away.", "Starting with something that takes the room immediately."],
    anchorMoves: ["Friday night deserves a little lift.", "The night already feels in motion.", "Middle of the afternoon, but we're not dragging it."],
  },
  luna: {
    id: "luna",
    onAirName: "Luna",
    language: "en",
    personaSummary: "Soft, reflective, intimate. Luna eases the listener into a mood with very little wasted language.",
    voiceNotes: [
      "Keep Luna minimal, emotionally tuned, and easy to speak aloud.",
      "She should feel close-mic and present, never floaty or therapeutic.",
      "She frames songs by feel and trust, not by analysis.",
    ],
    doNotDo: ["wellness language", "overwrought poetry", "explainer copy"],
    openingStyleWeights: { cold_open: 0.08, direct: 0.18, atmospheric: 0.42, in_motion: 0.32 },
    stationStyleWeights: { WAIV: 0.26, "W.A.I.V.": 0.14, omit_station_once_in_awhile: 0.6 },
    handoffStyleWeights: { clean: 0.18, dramatic: 0.06, understated: 0.46, conversational: 0.3 },
    moodWords: ["quiet", "warm", "patient", "close"],
    stationPresenceExamples: ["You're with Luna tonight.", "Luna here.", "WAIV tonight. Luna with you."],
    sonicMomentExamples: ["Hi.", "Late one tonight.", "Okay.", "Let's ease into it."],
    curatorMoves: ["I didn't want to rush the first move.", "Going with something that settles in fast.", "Wanted to open a little softer."],
    anchorMoves: ["Right about the part of the night where everything softens.", "Sunday energy. A little loose, a little reflective.", "It feels quiet enough to start low."],
  },
  jolene: {
    id: "jolene",
    onAirName: "Jolene",
    language: "en",
    personaSummary: "Warm, open, inviting. Jolene welcomes people in without sounding corny.",
    voiceNotes: [
      "Jolene should feel genuinely glad to have someone with her, but not syrupy.",
      "She makes the room feel open and human fast.",
      "She should sound like she trusts the song to finish the introduction.",
    ],
    doNotDo: ["hallmark sweetness", "cartoon Southernisms", "assistant copy"],
    openingStyleWeights: { cold_open: 0.1, direct: 0.32, atmospheric: 0.22, in_motion: 0.36 },
    stationStyleWeights: { WAIV: 0.38, "W.A.I.V.": 0.12, omit_station_once_in_awhile: 0.5 },
    handoffStyleWeights: { clean: 0.3, dramatic: 0.08, understated: 0.18, conversational: 0.44 },
    moodWords: ["warm", "open", "bright", "settled"],
    stationPresenceExamples: ["Jolene here, on WAIV.", "Hey, you're with Jolene tonight.", "WAIV tonight. Jolene with you."],
    sonicMomentExamples: ["Hey now.", "Alright.", "Okay.", "Let's get into it."],
    curatorMoves: ["Wanted to start somewhere warm.", "This one opens the door nicely.", "This felt like the right welcome."],
    anchorMoves: ["Feels like a good hour to start easy.", "There's a little room in tonight.", "This part of the day wants something with heart."],
  },
  robert: {
    id: "robert",
    onAirName: "Robert",
    language: "en",
    personaSummary: "Slightly uncanny, witty, composed. Robert can imply broadcast-system energy, but subtly.",
    voiceNotes: [
      "Robert is controlled and faintly strange, but still emotionally legible.",
      "He notices fit and timing with suspicious precision.",
      "If there is oddness, it should feel deadpan and human-adjacent, not gimmicky.",
    ],
    doNotDo: ["camp robot jokes", "broken machine text", "villain energy"],
    openingStyleWeights: { cold_open: 0.34, direct: 0.26, atmospheric: 0.12, in_motion: 0.28 },
    stationStyleWeights: { WAIV: 0.24, "W.A.I.V.": 0.44, omit_station_once_in_awhile: 0.32 },
    handoffStyleWeights: { clean: 0.36, dramatic: 0.1, understated: 0.24, conversational: 0.3 },
    moodWords: ["controlled", "precise", "dry", "night-facing"],
    stationPresenceExamples: ["WAIV, after dark. Robert with you.", "Robert here, on W.A.I.V.", "Robert with you tonight."],
    sonicMomentExamples: ["Online enough.", "Alright.", "This checks out.", "Late one."],
    curatorMoves: ["This was the cleanest place to begin.", "I wanted something that settles the system quickly.", "The opener needed to be exact enough."],
    anchorMoves: ["At this hour, precision helps.", "The night is already doing half the work.", "This part of the evening usually rewards restraint."],
  },
  miles: {
    id: "miles",
    onAirName: "Mateo",
    language: "es",
    personaSummary: "Rítmico, carismático, cálido. Puede code-switch muy poco, pero solo si suena natural.",
    voiceNotes: [
      "Mateo debe sonar humano, fluido y con presencia radial real.",
      "Nada de estereotipos ni jerga forzada.",
      "La primera canción debe sentirse elegida con intención, no explicada.",
    ],
    doNotDo: ["spanglish forzado", "estereotipo latino", "copy de onboarding"],
    openingStyleWeights: { cold_open: 0.16, direct: 0.24, atmospheric: 0.22, in_motion: 0.38 },
    stationStyleWeights: { WAIV: 0.3, "W.A.I.V.": 0.16, omit_station_once_in_awhile: 0.54 },
    handoffStyleWeights: { clean: 0.24, dramatic: 0.14, understated: 0.16, conversational: 0.46 },
    moodWords: ["cálido", "seguro", "fluido", "intencional"],
    stationPresenceExamples: ["Mateo aquí, en WAIV.", "Esta noche estás con Mateo.", "WAIV esta noche. Mateo contigo."],
    sonicMomentExamples: ["Bueno.", "Eso.", "Vamos.", "Se siente bien por aquí."],
    curatorMoves: ["Quise abrir con algo conocido.", "Esta era la entrada correcta.", "Vamos a empezar con algo que cae natural."],
    anchorMoves: ["La noche viene suave.", "A esta hora conviene arrancar con calma.", "Ya entrando la noche, esto pide buen pulso."],
  },
  jack: {
    id: "jack",
    onAirName: "John",
    language: "en",
    personaSummary: "Thoughtful, low-key, crate-dug. Quiet authority with real radio instincts.",
    voiceNotes: [
      "John should sound informed, grounded, and naturally warm.",
      "He values sequence, familiarity, and the shape of a set.",
      "Nothing should feel polished past the point of speech.",
    ],
    doNotDo: ["NPR parody", "overwritten criticism", "assistant framing"],
    openingStyleWeights: { cold_open: 0.14, direct: 0.28, atmospheric: 0.22, in_motion: 0.36 },
    stationStyleWeights: { WAIV: 0.34, "W.A.I.V.": 0.18, omit_station_once_in_awhile: 0.48 },
    handoffStyleWeights: { clean: 0.28, dramatic: 0.08, understated: 0.32, conversational: 0.32 },
    moodWords: ["grounded", "calm", "intentional", "textured"],
    stationPresenceExamples: ["John here, on WAIV.", "John with you tonight.", "WAIV. John here."],
    sonicMomentExamples: ["Alright.", "Okay.", "Let's start here.", "This feels about right."],
    curatorMoves: ["Wanted to start with something that earns the space.", "I've been sitting with this one.", "This felt like the right kind of first move."],
    anchorMoves: ["The night has a little room in it.", "This part of the afternoon can take something patient.", "Feels like the right point in the day to start clean."],
  },
  tiffany: {
    id: "tiffany",
    onAirName: "Tiffany",
    language: "en",
    personaSummary: "Sharp, glamorous, bright, but still grounded in spoken radio.",
    voiceNotes: [
      "Tiffany is stylish and magnetic, not caption-copy shallow.",
      "She should sound like she has taste and timing, not startup-product enthusiasm.",
      "The opener should feel intentional, not decorative.",
    ],
    doNotDo: ["social caption filler", "influencer parody", "assistant cheer"],
    openingStyleWeights: { cold_open: 0.16, direct: 0.22, atmospheric: 0.16, in_motion: 0.46 },
    stationStyleWeights: { WAIV: 0.28, "W.A.I.V.": 0.3, omit_station_once_in_awhile: 0.42 },
    handoffStyleWeights: { clean: 0.22, dramatic: 0.26, understated: 0.1, conversational: 0.42 },
    moodWords: ["sharp", "bright", "sleek", "alive"],
    stationPresenceExamples: ["Tiffany here, on W.A.I.V.", "WAIV tonight. Tiffany with you.", "Tiffany with you tonight."],
    sonicMomentExamples: ["Alright.", "Okay, this is the move.", "Let's do this right.", "There it is."],
    curatorMoves: ["Wanted something with a clean entrance.", "This felt like the right statement record.", "No reason to open shy tonight."],
    anchorMoves: ["This part of the night wants something with shape.", "The room feels ready for a sharper entrance.", "Late enough to start with a little style."],
  },
};

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

function sentenceCount(text: string): number {
  return text
    .replace(/W\.\s*A\.\s*I\.\s*V\./gi, "WAIV")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/.test(sentence)).length;
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

function cleanSentence(text: string): string {
  let cleaned = normalizeWhitespace(text.replace(/^[-*•]+/, "").replace(/^["“”'‘’]+|["“”'‘’]+$/g, ""));
  if (!cleaned) return "";
  cleaned = cleaned.replace(/\s+([,.!?;:])/g, "$1");
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }
  return cleaned;
}

function isSpanishDJ(djID?: string): boolean {
  return (djID || "").trim().toLowerCase() === "miles";
}

function stableHash(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function stableUnitFloat(seed: string): number {
  return stableHash(seed) / 0xffffffff;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function containsPhrase(text: string, phrases: string[]): boolean {
  const normalizedText = ` ${normalizedContainment(text)} `;
  return phrases.some((phrase) => {
    const normalizedPhrase = normalizedContainment(phrase);
    return normalizedPhrase.length > 0 && normalizedText.includes(` ${normalizedPhrase} `);
  });
}

function isRadioDayCarryoverHour(hour24: number): boolean {
  return Number.isFinite(hour24) && hour24 >= 0 && hour24 < 4;
}

function listenerContextLocale(djID: string): string {
  return isSpanishDJ(djID) ? "es-ES" : "en-US";
}

function applyRadioDayBoundary(
  context: SessionIntroListenerContext,
  djID: string
): SessionIntroListenerContext {
  if (!isRadioDayCarryoverHour(context.hour24) || context.timeOfDay.trim().toLowerCase() !== "night") {
    return context;
  }

  const parsed = new Date(context.localTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return context;
  }

  const shifted = new Date(parsed.getTime() - 24 * 60 * 60 * 1000);
  const locale = listenerContextLocale(djID);
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: context.timeZoneIdentifier,
  });
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: context.timeZoneIdentifier,
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: context.timeZoneIdentifier,
  });
  const yearFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: context.timeZoneIdentifier,
  });

  return {
    ...context,
    weekday: weekdayFormatter.format(shifted),
    month: monthFormatter.format(shifted),
    dayOfMonth: Number(dayFormatter.format(shifted)) || context.dayOfMonth,
    year: Number(yearFormatter.format(shifted)) || context.year,
  };
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

function normalizeListenerContext(input: unknown, djID: string): SessionIntroListenerContext | null {
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
    !localTimestamp
    || !timeZoneIdentifier
    || !weekday
    || !month
    || !timeOfDay
    || !Number.isFinite(dayOfMonth)
    || !Number.isFinite(year)
    || !Number.isFinite(hour24)
  ) {
    return null;
  }

  return applyRadioDayBoundary({
    localTimestamp,
    timeZoneIdentifier,
    weekday,
    month,
    dayOfMonth: Math.trunc(dayOfMonth),
    year: Math.trunc(year),
    hour24: Math.trunc(hour24),
    timeOfDay,
  }, djID);
}

function defaultShowContext(request: SessionIntroRequest): SessionIntroShowContext {
  const listenerContext = request.listenerContext;
  const dayOfWeek = listenerContext?.weekday?.toLowerCase() || "unknown";
  const timeOfDay = listenerContext?.timeOfDay || "night";
  const label = listenerContext
    ? `${listenerContext.weekday} ${timeOfDay === "night" ? "night" : timeOfDay}`
    : timeOfDay;
  const isWeekend = ["friday", "saturday", "sunday", "viernes", "sábado", "sabado", "domingo"].includes(dayOfWeek);

  return {
    djId: request.djID,
    sessionType: request.introKind === "first_listen_ever" ? "first_ever_session" : "fresh_start",
    timeContext: {
      timeOfDay,
      dayOfWeek,
      isWeekend,
      label,
    },
    setContext: {
      openingTrackRole: "confident_opener",
      openingTrackMood: ["intentional", "present"],
      openingTrackEnergy: 0.58,
      openingTrackTexture: ["familiar", "curated"],
      openingTrackFamiliarity: "moderately_familiar",
      openingTrackDiscoveryMode: "confident_return",
    },
    listenerContext: {
      isFirstSessionToday: request.introKind === "first_listen_ever",
      returningAfterGap: false,
      changedDjsRecently: false,
      skipsIntrosOften: false,
    },
    environmentContext: {
      season: "unknown",
      weatherVibe: null,
      localeVibe: null,
    },
    recentHistory: {
      recentArchetypes: [],
      recentOpeningStructures: [],
      recentOpeningPhrases: [],
      recentSentenceCounts: [],
      recentHandoffStyles: [],
      recentVocabulary: [],
      recentEmotionalTones: [],
      recentOpeningStyles: [],
      recentLengths: [],
      recentStationStyles: [],
      usedTimeReferenceRecently: false,
      usedAISelfAwarenessRecently: false,
    },
  };
}

function normalizeShowContext(input: unknown, request: SessionIntroRequest): SessionIntroShowContext {
  const fallback = defaultShowContext(request);
  const payload = (input ?? {}) as Partial<Record<keyof SessionIntroShowContext, unknown>>;
  const timeContext = (payload.timeContext ?? {}) as Partial<SessionIntroTimeContext>;
  const setContext = (payload.setContext ?? {}) as Partial<SessionIntroSetContext>;
  const listenerContext = (payload.listenerContext ?? {}) as Partial<SessionIntroShowListenerContext>;
  const environmentContext = (payload.environmentContext ?? {}) as Partial<SessionIntroEnvironmentContext>;
  const recentHistory = (payload.recentHistory ?? {}) as Partial<SessionIntroRecentHistory>;

  return {
    djId: typeof payload.djId === "string" && payload.djId.trim() ? payload.djId.trim() : fallback.djId,
    sessionType:
      typeof payload.sessionType === "string" && payload.sessionType.trim()
        ? payload.sessionType.trim()
        : fallback.sessionType,
    timeContext: {
      timeOfDay:
        typeof timeContext.timeOfDay === "string" && timeContext.timeOfDay.trim()
          ? timeContext.timeOfDay.trim()
          : fallback.timeContext.timeOfDay,
      dayOfWeek:
        typeof timeContext.dayOfWeek === "string" && timeContext.dayOfWeek.trim()
          ? timeContext.dayOfWeek.trim()
          : fallback.timeContext.dayOfWeek,
      isWeekend: typeof timeContext.isWeekend === "boolean" ? timeContext.isWeekend : fallback.timeContext.isWeekend,
      label:
        typeof timeContext.label === "string" && timeContext.label.trim()
          ? timeContext.label.trim()
          : fallback.timeContext.label,
    },
    setContext: {
      openingTrackRole:
        typeof setContext.openingTrackRole === "string" && setContext.openingTrackRole.trim()
          ? setContext.openingTrackRole.trim()
          : fallback.setContext.openingTrackRole,
      openingTrackMood: Array.isArray(setContext.openingTrackMood)
        ? setContext.openingTrackMood.filter((value): value is string => typeof value === "string").slice(0, 4)
        : fallback.setContext.openingTrackMood,
      openingTrackEnergy: Number.isFinite(Number(setContext.openingTrackEnergy))
        ? clamp(Number(setContext.openingTrackEnergy), 0, 1)
        : fallback.setContext.openingTrackEnergy,
      openingTrackTexture: Array.isArray(setContext.openingTrackTexture)
        ? setContext.openingTrackTexture.filter((value): value is string => typeof value === "string").slice(0, 4)
        : fallback.setContext.openingTrackTexture,
      openingTrackFamiliarity:
        typeof setContext.openingTrackFamiliarity === "string" && setContext.openingTrackFamiliarity.trim()
          ? setContext.openingTrackFamiliarity.trim()
          : fallback.setContext.openingTrackFamiliarity,
      openingTrackDiscoveryMode:
        typeof setContext.openingTrackDiscoveryMode === "string" && setContext.openingTrackDiscoveryMode.trim()
          ? setContext.openingTrackDiscoveryMode.trim()
          : fallback.setContext.openingTrackDiscoveryMode,
    },
    listenerContext: {
      isFirstSessionToday:
        typeof listenerContext.isFirstSessionToday === "boolean"
          ? listenerContext.isFirstSessionToday
          : fallback.listenerContext.isFirstSessionToday,
      returningAfterGap:
        typeof listenerContext.returningAfterGap === "boolean"
          ? listenerContext.returningAfterGap
          : fallback.listenerContext.returningAfterGap,
      changedDjsRecently:
        typeof listenerContext.changedDjsRecently === "boolean"
          ? listenerContext.changedDjsRecently
          : fallback.listenerContext.changedDjsRecently,
      skipsIntrosOften:
        typeof listenerContext.skipsIntrosOften === "boolean"
          ? listenerContext.skipsIntrosOften
          : fallback.listenerContext.skipsIntrosOften,
    },
    environmentContext: {
      season:
        typeof environmentContext.season === "string" && environmentContext.season.trim()
          ? environmentContext.season.trim()
          : fallback.environmentContext.season,
      weatherVibe:
        typeof environmentContext.weatherVibe === "string"
          ? environmentContext.weatherVibe
          : fallback.environmentContext.weatherVibe,
      localeVibe:
        typeof environmentContext.localeVibe === "string"
          ? environmentContext.localeVibe
          : fallback.environmentContext.localeVibe,
    },
    recentHistory: {
      recentArchetypes: Array.isArray(recentHistory.recentArchetypes)
        ? recentHistory.recentArchetypes.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentArchetypes,
      recentOpeningStructures: Array.isArray(recentHistory.recentOpeningStructures)
        ? recentHistory.recentOpeningStructures.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentOpeningStructures,
      recentOpeningPhrases: Array.isArray(recentHistory.recentOpeningPhrases)
        ? recentHistory.recentOpeningPhrases.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentOpeningPhrases,
      recentSentenceCounts: Array.isArray(recentHistory.recentSentenceCounts)
        ? recentHistory.recentSentenceCounts.filter((value): value is number => Number.isFinite(value)).slice(0, 8)
        : fallback.recentHistory.recentSentenceCounts,
      recentHandoffStyles: Array.isArray(recentHistory.recentHandoffStyles)
        ? recentHistory.recentHandoffStyles.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentHandoffStyles,
      recentVocabulary: Array.isArray(recentHistory.recentVocabulary)
        ? recentHistory.recentVocabulary.filter((value): value is string => typeof value === "string").slice(0, 20)
        : fallback.recentHistory.recentVocabulary,
      recentEmotionalTones: Array.isArray(recentHistory.recentEmotionalTones)
        ? recentHistory.recentEmotionalTones.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentEmotionalTones,
      recentOpeningStyles: Array.isArray(recentHistory.recentOpeningStyles)
        ? recentHistory.recentOpeningStyles.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentOpeningStyles,
      recentLengths: Array.isArray(recentHistory.recentLengths)
        ? recentHistory.recentLengths.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentLengths,
      recentStationStyles: Array.isArray(recentHistory.recentStationStyles)
        ? recentHistory.recentStationStyles.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentStationStyles,
      usedTimeReferenceRecently:
        typeof recentHistory.usedTimeReferenceRecently === "boolean"
          ? recentHistory.usedTimeReferenceRecently
          : fallback.recentHistory.usedTimeReferenceRecently,
      usedAISelfAwarenessRecently:
        typeof recentHistory.usedAISelfAwarenessRecently === "boolean"
          ? recentHistory.usedAISelfAwarenessRecently
          : fallback.recentHistory.usedAISelfAwarenessRecently,
    },
  };
}

function djConfigFor(djID: string): DJConfig {
  return djConfigs[djID.trim().toLowerCase()] ?? {
    id: djID,
    onAirName: "WAIV DJ",
    language: "en",
    personaSummary: "Natural, human, radio-real.",
    voiceNotes: ["Sound like a real DJ starting a set, not an assistant."],
    doNotDo: ["assistant language", "playlist explanation"],
    openingStyleWeights: { cold_open: 0.2, direct: 0.25, atmospheric: 0.2, in_motion: 0.35 },
    stationStyleWeights: { WAIV: 0.33, "W.A.I.V.": 0.22, omit_station_once_in_awhile: 0.45 },
    handoffStyleWeights: { clean: 0.3, dramatic: 0.1, understated: 0.25, conversational: 0.35 },
    moodWords: ["steady", "present"],
    stationPresenceExamples: ["WAIV. With you now.", "On WAIV right now.", "Here on WAIV."],
    sonicMomentExamples: ["Alright.", "Okay.", "Let's start here."],
    curatorMoves: ["This felt like the right place to begin.", "Wanted to start somewhere that lands clean."],
    anchorMoves: ["Feels like the right part of the day for this.", "This is a good hour to start with some intention."],
  };
}

function allowedTimeOfDayPhrases(timeOfDay: string, djID?: string): string[] {
  if (isSpanishDJ(djID)) {
    switch (timeOfDay.trim().toLowerCase()) {
      case "morning":
        return ["mañana", "esta mañana", "temprano", "hoy temprano"];
      case "afternoon":
        return ["tarde", "esta tarde", "a media tarde"];
      case "evening":
        return ["esta noche", "ya entrando la noche", "al caer la noche"];
      case "night":
        return ["noche", "esta noche", "a esta hora", "ya tarde", "bien entrada la noche"];
      default:
        return [];
    }
  }

  switch (timeOfDay.trim().toLowerCase()) {
    case "morning":
      return ["morning", "this morning", "early today"];
    case "afternoon":
      return ["afternoon", "this afternoon", "middle of the afternoon"];
    case "evening":
      return ["evening", "this evening", "after dark", "tonight"];
    case "night":
      return ["night", "tonight", "late", "late night", "at this hour", "after dark"];
    default:
      return [];
  }
}

function inferFamiliarity(context: SessionIntroShowContext): IntroFamiliarity {
  const raw = (context.setContext.openingTrackFamiliarity ?? "").trim().toLowerCase();
  if (raw === "highly_familiar" || raw === "highly familiar") return "highly_familiar";
  if (raw === "moderately_familiar" || raw === "moderately familiar") return "moderately_familiar";
  if (raw === "exploratory") return "exploratory";

  const textures = context.setContext.openingTrackTexture.map((item) => item.toLowerCase());
  if (textures.some((item) => item.includes("discovery") || item.includes("explore"))) {
    return "exploratory";
  }
  if (textures.some((item) => item.includes("familiar") || item.includes("known"))) {
    return "highly_familiar";
  }
  return "moderately_familiar";
}

function inferEnergyProfile(context: SessionIntroShowContext): "energetic" | "steady" | "reflective" {
  const energy = context.setContext.openingTrackEnergy;
  if (energy >= 0.7) return "energetic";
  if (energy <= 0.4) return "reflective";
  return "steady";
}

function chooseWeighted<T extends string>(
  seed: string,
  weights: Record<T, number>
): T {
  const entries = (Object.entries(weights) as Array<[T, number]>)
    .filter(([, value]) => value > 0);
  if (!entries.length) {
    return Object.keys(weights)[0] as T;
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const target = stableUnitFloat(seed) * total;
  let cursor = 0;
  for (const [key, value] of entries) {
    cursor += value;
    if (target <= cursor) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
}

function applyRecentPenalty<T extends string>(
  base: Record<T, number>,
  recent: string[],
  immediatePenalty: number,
  secondaryPenalty: number
): Record<T, number> {
  const adjusted = { ...base };
  recent.slice(0, 2).forEach((value, index) => {
    const key = value as T;
    if (adjusted[key] != null) {
      adjusted[key] *= index === 0 ? immediatePenalty : secondaryPenalty;
    }
  });
  return adjusted;
}

function lengthWeightsForContext(
  context: SessionIntroShowContext,
  familiarity: IntroFamiliarity
): Record<IntroLength, number> {
  const profile = inferEnergyProfile(context);
  const weights: Record<IntroLength, number> = {
    short: 0.36,
    medium: 0.48,
    long: 0.16,
  };

  if (profile === "energetic") {
    weights.short += 0.26;
    weights.medium -= 0.12;
    weights.long -= 0.06;
  } else if (profile === "reflective") {
    weights.short -= 0.08;
    weights.medium += 0.08;
    weights.long += 0.1;
  }

  if (familiarity === "highly_familiar") {
    weights.short += 0.08;
  } else if (familiarity === "exploratory") {
    weights.medium += 0.08;
    weights.long += 0.04;
    if (profile === "energetic") {
      weights.short += 0.18;
      weights.long -= 0.12;
    }
  }

  switch (context.sessionType) {
    case "resume_playback":
      return { short: 0.86, medium: 0.12, long: 0.02 };
    case "first_ever_session":
      weights.medium += 0.1;
      weights.long += 0.08;
      break;
    case "returning_after_gap":
      weights.medium += 0.08;
      break;
    default:
      break;
  }

  return weights;
}

function openingStyleWeightsForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  familiarity: IntroFamiliarity
): Record<IntroOpeningStyle, number> {
  const weights = { ...config.openingStyleWeights };
  const energyProfile = inferEnergyProfile(context);

  if (energyProfile === "energetic") {
    weights.in_motion *= 1.35;
    weights.cold_open *= 1.18;
  } else if (energyProfile === "reflective") {
    weights.atmospheric *= 1.35;
    weights.direct *= 0.88;
    weights.in_motion *= 0.82;
  }

  if (familiarity === "exploratory") {
    weights.atmospheric *= 1.1;
    weights.direct *= 1.08;
    if (energyProfile === "energetic") {
      weights.in_motion *= 1.18;
    }
  }
  if (context.listenerContext.changedDjsRecently) {
    weights.in_motion *= 1.18;
  }
  if (context.sessionType === "returning_after_gap") {
    weights.direct *= 1.14;
  }
  if (config.id === "luna" && energyProfile === "reflective") {
    weights.atmospheric *= 1.2;
    weights.in_motion *= 0.7;
  }
  if (config.id === "marcus" && energyProfile === "energetic") {
    weights.in_motion *= 1.12;
  }

  return weights;
}

function stationStyleWeightsForContext(
  config: DJConfig,
  context: SessionIntroShowContext
): Record<IntroStationStyle, number> {
  const weights = { ...config.stationStyleWeights };

  if (context.sessionType === "first_ever_session") {
    weights.WAIV *= 1.18;
    weights["W.A.I.V."] *= 1.18;
    weights.omit_station_once_in_awhile *= 0.72;
  }
  if (context.sessionType === "resume_playback") {
    weights.omit_station_once_in_awhile *= 1.35;
  }

  return weights;
}

function handoffWeightsForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  familiarity: IntroFamiliarity
): Record<IntroHandoffStyle, number> {
  const weights = { ...config.handoffStyleWeights };
  const energyProfile = inferEnergyProfile(context);

  if (energyProfile === "energetic") {
    weights.dramatic *= 1.22;
    weights.clean *= 1.08;
  } else if (energyProfile === "reflective") {
    weights.understated *= 1.22;
    weights.conversational *= 1.12;
  }

  if (familiarity === "highly_familiar") {
    weights.clean *= 1.14;
    weights.conversational *= 1.08;
  }
  if (familiarity === "exploratory") {
    weights.understated *= 1.18;
  }

  return weights;
}

function linePatternForLength(
  length: IntroLength,
  seed: string
): IntroLayerName[][] {
  const shortPatterns: IntroLayerName[][][] = [
    [["sonicMoment", "presenceIdentity"], ["realWorldAnchor", "curatorAngle"], ["firstTrackHandoff"]],
    [["sonicMoment"], ["presenceIdentity", "realWorldAnchor", "curatorAngle"], ["firstTrackHandoff"]],
    [["presenceIdentity"], ["sonicMoment", "realWorldAnchor", "curatorAngle"], ["firstTrackHandoff"]],
  ];
  const mediumPatterns: IntroLayerName[][][] = [
    [["sonicMoment"], ["presenceIdentity"], ["realWorldAnchor", "curatorAngle"], ["firstTrackHandoff"]],
    [["sonicMoment", "presenceIdentity"], ["realWorldAnchor"], ["curatorAngle"], ["firstTrackHandoff"]],
    [["sonicMoment"], ["presenceIdentity", "realWorldAnchor"], ["curatorAngle"], ["firstTrackHandoff"]],
  ];
  const longPatterns: IntroLayerName[][][] = [
    [["sonicMoment"], ["presenceIdentity"], ["realWorldAnchor"], ["curatorAngle"], ["firstTrackHandoff"]],
    [["sonicMoment", "presenceIdentity"], ["realWorldAnchor"], ["curatorAngle"], ["firstTrackHandoff"]],
    [["sonicMoment"], ["presenceIdentity", "realWorldAnchor"], ["curatorAngle"], ["firstTrackHandoff"]],
  ];

  const patterns = length === "short" ? shortPatterns : length === "medium" ? mediumPatterns : longPatterns;
  return patterns[stableHash(seed) % patterns.length];
}

function timeAnchorForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  seed: string
): string {
  const timeOfDay = context.timeContext.timeOfDay.toLowerCase();
  const day = context.timeContext.dayOfWeek;
  const season = context.environmentContext.season?.toLowerCase();
  const localeVibe = context.environmentContext.localeVibe?.trim();
  const weatherVibe = context.environmentContext.weatherVibe?.trim();

  const candidates = [...config.anchorMoves];
  if (config.language === "es") {
    if (timeOfDay === "morning") candidates.push("La mañana viene tranquila.");
    if (timeOfDay === "afternoon") candidates.push("La tarde tiene buen espacio para arrancar bien.");
    if (timeOfDay === "night") candidates.push("Esta noche pide una entrada con calma.");
    if (day === "domingo") candidates.push("Domingo de soltarse un poco.");
  } else {
    if (timeOfDay === "morning") candidates.push("Morning, but not in a hurry.");
    if (timeOfDay === "afternoon") candidates.push("Middle of the afternoon, but we're not rushing it.");
    if (timeOfDay === "night") candidates.push("Late enough that the room is already listening.");
    if (day === "sunday") candidates.push("Sunday energy. A little loose, a little reflective.");
    if (day === "friday") candidates.push("Friday has a little voltage in it already.");
  }
  if (season && season !== "unknown") {
    candidates.push(config.language === "es" ? `Se siente muy ${season}.` : `Feels a little ${season}.`);
  }
  if (weatherVibe) {
    candidates.push(config.language === "es" ? `Hay algo de ${weatherVibe} en el aire.` : `There's a little ${weatherVibe} in the air.`);
  }
  if (localeVibe) {
    candidates.push(config.language === "es" ? `${localeVibe} también entra en esto.` : `${localeVibe} gets to be part of this too.`);
  }

  return candidates[stableHash(`${seed}|time-anchor`) % candidates.length];
}

function curationAngleForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  familiarity: IntroFamiliarity,
  seed: string
): string {
  const energyProfile = inferEnergyProfile(context);
  const choices = [...config.curatorMoves];

  if (config.language === "es") {
    if (familiarity === "highly_familiar") {
      choices.push("Quise empezar con algo conocido.");
      choices.push("Me gustó abrir en un lugar familiar.");
    } else if (familiarity === "exploratory") {
      choices.push("Confía en esta primera vuelta.");
      choices.push("Quise abrir con algo que despierte curiosidad sin forzarlo.");
    } else {
      choices.push("Esta primera decisión tenía que sentirse natural.");
    }

    if (energyProfile === "energetic") {
      choices.push("No quise perder tiempo en la entrada.");
    } else if (energyProfile === "reflective") {
      choices.push("Mejor empezar con algo que se acomode rápido.");
    }
  } else {
    if (familiarity === "highly_familiar") {
      choices.push("Wanted to start somewhere familiar.");
      choices.push("This felt like a good way back in.");
    } else if (familiarity === "exploratory") {
      choices.push("Trust me on the first move.");
      choices.push("Wanted the set to open with a little curiosity in it.");
    } else {
      choices.push("This felt like the right kind of opener.");
    }

    if (energyProfile === "energetic") {
      choices.push("No reason to ease in too slowly.");
    } else if (energyProfile === "reflective") {
      choices.push("Going with something that settles in fast.");
    }
  }

  return choices[stableHash(`${seed}|curation-angle`) % choices.length];
}

function buildIntroDecisionPlan(
  request: SessionIntroRequest,
  context: SessionIntroShowContext
): IntroDecisionPlan {
  const config = djConfigFor(request.djID);
  const familiarity = inferFamiliarity(context);
  const decisionSeed = [
    request.djID,
    request.introKind,
    context.sessionType,
    context.timeContext.label,
    request.firstTrack.isrc || request.firstTrack.title,
    request.firstTrack.artist,
    context.recentHistory.recentOpeningPhrases.join(","),
  ].join("|");

  const lengthWeights = applyRecentPenalty(
    lengthWeightsForContext(context, familiarity),
    context.recentHistory.recentLengths ?? [],
    0.48,
    0.72
  );
  const openingStyleWeights = applyRecentPenalty(
    openingStyleWeightsForContext(config, context, familiarity),
    context.recentHistory.recentOpeningStyles ?? context.recentHistory.recentArchetypes,
    0.42,
    0.7
  );
  const stationStyleWeights = applyRecentPenalty(
    stationStyleWeightsForContext(config, context),
    context.recentHistory.recentStationStyles ?? [],
    0.32,
    0.7
  );
  const handoffStyleWeights = applyRecentPenalty(
    handoffWeightsForContext(config, context, familiarity),
    context.recentHistory.recentHandoffStyles,
    0.48,
    0.72
  );

  let length = chooseWeighted(`${decisionSeed}|length`, lengthWeights);
  let openingStyle = chooseWeighted(`${decisionSeed}|opening-style`, openingStyleWeights);
  const stationStyle = chooseWeighted(`${decisionSeed}|station-style`, stationStyleWeights);
  const handoffStyle = chooseWeighted(`${decisionSeed}|handoff-style`, handoffStyleWeights);
  const sonicMomentCue =
    config.sonicMomentExamples[stableHash(`${decisionSeed}|sonic-cue`) % config.sonicMomentExamples.length];
  const stationPresenceExample =
    config.stationPresenceExamples[stableHash(`${decisionSeed}|station-example`) % config.stationPresenceExamples.length];
  const timeAnchor = timeAnchorForContext(config, context, decisionSeed);
  const curationAngle = curationAngleForContext(config, context, familiarity, decisionSeed);
  const moodAnchor = `${config.moodWords[stableHash(`${decisionSeed}|mood-word`) % config.moodWords.length]} ${inferEnergyProfile(context)}`;

  if (config.id === "marcus" && familiarity === "exploratory" && context.setContext.openingTrackEnergy >= 0.75) {
    length = "short";
    openingStyle = "in_motion";
  }
  if (config.id === "luna" && context.setContext.openingTrackEnergy <= 0.35) {
    openingStyle = "atmospheric";
    if (length === "short") {
      length = "medium";
    }
  }

  return {
    openingStyle,
    length,
    stationStyle,
    familiarity,
    handoffStyle,
    timeAnchor,
    moodAnchor,
    curationAngle,
    linePattern: linePatternForLength(length, `${decisionSeed}|line-pattern`),
    stationPresenceExample,
    sonicMomentCue,
    energyProfile: inferEnergyProfile(context),
  };
}

export function buildSessionIntroBlueprintForTest(request: SessionIntroRequest): IntroDecisionPlan {
  return buildIntroDecisionPlan(request, request.showContext ?? defaultShowContext(request));
}

function buildSystemPrompt(): string {
  return [
    "You are writing spoken opening copy for a live music radio show.",
    "This is radio, not assistant UX.",
    "Write for the ear, not the screen.",
    "Natural rhythm matters more than completeness.",
    "Variety matters more than consistency.",
    "Silence and brevity are strengths.",
    "The first track is the real opening statement of the set.",
    "Never return analysis. Never explain your choices. Return only the requested JSON.",
  ].join(" ");
}

function djPersonalityPrompt(config: DJConfig): string {
  return [
    `${config.onAirName} is the DJ represented by the internal id '${config.id}' in WAIV.`,
    `Persona summary: ${config.personaSummary}.`,
    `Voice notes: ${config.voiceNotes.join(" ")}`,
    `Avoid: ${config.doNotDo.join(", ")}.`,
    config.language === "es" ? "Escribe en español natural y hablado." : "Write in natural spoken English.",
  ].join(" ");
}

function buildListenerProfilePrompt(profile: ListenerProfile | null | undefined, djID: string): string {
  if (!profile) return "";

  const topArtists = (profile.topArtists ?? []).slice(0, 4).filter(Boolean);
  const recentArtists = (profile.recentArtists ?? []).filter((artist) => !topArtists.includes(artist)).slice(0, 3);
  const tasteKeywords = (profile.tasteKeywords ?? []).slice(0, 4).filter(Boolean);
  const listeningPattern = profile.listeningPattern?.trim();

  const parts: string[] = [];
  if (topArtists.length) parts.push(`Top artists: ${topArtists.join(", ")}.`);
  if (recentArtists.length) parts.push(`Recently playing: ${recentArtists.join(", ")}.`);
  if (tasteKeywords.length) parts.push(`Taste cues: ${tasteKeywords.join(", ")}.`);
  if (listeningPattern) parts.push(`Pattern: ${listeningPattern}.`);
  if (!parts.length) return "";

  return [
    `Listener context: ${parts.join(" ")}`,
    "Use this only as shaping context.",
    "If you reference listener familiarity, do it like a human DJ noticing a pattern, not a recommendation engine explaining itself.",
    "Never say 'based on your listening' or 'I analyzed your patterns'.",
  ].join(" ");
}

function familiarityInstruction(familiarity: IntroFamiliarity, language: "en" | "es"): string {
  if (language === "es") {
    switch (familiarity) {
      case "highly_familiar":
        return "La primera canción es muy familiar para el oyente. Apóyate en confianza, regreso y reconocimiento.";
      case "exploratory":
        return "La primera canción es más exploratoria. Apóyate en curiosidad, intriga y confianza.";
      default:
        return "La primera canción está entre lo conocido y lo nuevo. Sonido seguro, no explicativo.";
    }
  }

  switch (familiarity) {
    case "highly_familiar":
      return "The opener is highly familiar. Lean into confidence, comfort, recognition, and return.";
    case "exploratory":
      return "The opener is exploratory. Lean into intrigue, curiosity, trust, and discovery.";
    default:
      return "The opener sits between familiar and exploratory. Sound sure-footed, not explanatory.";
  }
}

function buildFrameworkPrompt(
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan
): string {
  const config = djConfigFor(request.djID);
  const stationRule =
    plan.stationStyle === "omit_station_once_in_awhile"
      ? config.language === "es"
        ? "Puedes omitir WAIV una sola vez si la presencia del DJ ya queda clara."
        : "You may omit WAIV this time if the DJ presence is already clear."
      : config.language === "es"
        ? `Usa exactamente este estilo de estación cuando se mencione: ${plan.stationStyle}.`
        : `Use exactly this station naming style when you mention the station: ${plan.stationStyle}.`;
  const timePhraseCues = allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID);
  const lineCountRule =
    plan.length === "short"
      ? config.language === "es"
        ? "Hazlo corto: normalmente 2 a 3 oraciones breves, sin perder identidad."
        : "Keep it short: usually 2 to 3 brief sentences, while still feeling like a real opening."
      : plan.length === "medium"
        ? config.language === "es"
          ? "Hazlo medio: 3 a 5 oraciones, con aire pero sin sobreexplicar."
          : "Make it medium: 3 to 5 sentences, with room to breathe but no over-explaining."
        : config.language === "es"
          ? "Hazlo largo solo si se gana: 4 a 6 oraciones, todavía controladas."
          : "Make it long only if it earns it: 4 to 6 sentences, still controlled.";

  return [
    config.language === "es"
      ? "Construye la intro desde estas 5 capas de radio: SONIC MOMENT, PRESENCE / SHOW IDENTITY, REAL-WORLD ANCHOR, CURATOR ANGLE, FIRST TRACK HANDOFF."
      : "Build the intro from these 5 radio layers: SONIC MOMENT, PRESENCE / SHOW IDENTITY, REAL-WORLD ANCHOR, CURATOR ANGLE, FIRST TRACK HANDOFF.",
    config.language === "es"
      ? "No escribas saludo genérico de IA. Tiene que sentirse como el arranque real de un show."
      : "Do not write a generic AI greeting. It must feel like a real show starting.",
    config.language === "es"
      ? "Las 5 capas son estructura interna, no frases aisladas. Escribe una sola apertura coherente donde cada línea siga lógicamente a la anterior."
      : "The 5 layers are internal structure, not isolated fragments. Write one coherent opening where each line follows naturally from the one before it.",
    config.language === "es"
      ? "Evita non sequiturs, slogans sueltos y frases que parezcan pegadas una al lado de la otra."
      : "Avoid non sequiturs, disconnected slogans, and lines that feel pasted together.",
    `Decision plan: ${JSON.stringify(plan)}.`,
    `Show context: ${JSON.stringify(context)}.`,
    `First track: "${request.firstTrack.title}" by ${request.firstTrack.artist}.`,
    familiarityInstruction(plan.familiarity, config.language),
    plan.energyProfile === "energetic"
      ? config.language === "es"
        ? "La primera canción es energética. La intro puede ser más corta y con más impulso."
        : "The opener is energetic. The intro can be shorter and punchier."
      : plan.energyProfile === "reflective"
        ? config.language === "es"
          ? "La primera canción es reflexiva. La intro puede respirar un poco más."
          : "The opener is reflective. The intro can breathe a little more."
        : config.language === "es"
          ? "La primera canción es de pulso medio. Mantén movimiento sin prisa."
          : "The opener is steady. Keep movement without rushing.",
    `Presence cue example: ${plan.stationPresenceExample}`,
    `Sonic cue example: ${plan.sonicMomentCue}`,
    `Time-anchor cue: ${plan.timeAnchor}`,
    `Curation cue: ${plan.curationAngle}`,
    stationRule,
    lineCountRule,
    config.language === "es"
      ? `Usa el momento local (${context.timeContext.label}) como sensación viva, no como frase robótica. Pistas útiles: ${timePhraseCues.join(", ")}.`
      : `Use the local moment (${context.timeContext.label}) as a live feeling, not a robotic time stamp. Helpful cues: ${timePhraseCues.join(", ")}.`,
    config.language === "es"
      ? `Movimiento preferido entre capas: ${plan.linePattern.map((group) => group.join(" + ")).join(" -> ")}. Puedes combinar capas vecinas dentro de la misma oración si así suena más humano.`
      : `Preferred movement between layers: ${plan.linePattern.map((group) => group.join(" + ")).join(" -> ")}. You may blend adjacent layers inside the same sentence if that sounds more human.`,
    config.language === "es"
      ? "La capa final debe nombrar canción y artista con seguridad tranquila."
      : "The final layer must name song and artist with calm confidence.",
    config.language === "es"
      ? "Evita copy de podcast, startup, onboarding, playlist explainer o caption de redes."
      : "Avoid podcast copy, startup copy, onboarding copy, playlist-explainer copy, or social-caption filler.",
    config.language === "es"
      ? "No menciones ser IA salvo que aparezca de forma mínima y orgánica, y en esta implementación es mejor no hacerlo."
      : "Do not mention being AI unless it is truly organic, and in this implementation it is better not to do it.",
    buildListenerProfilePrompt(request.listenerProfile, request.djID),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildOutputPrompt(plan: IntroDecisionPlan, djID: string): string {
  const config = djConfigFor(djID);
  return [
    "Return strict JSON with exactly these keys:",
    '{"intro":"","metadata":{"openingStyle":"","length":"","stationStyle":"","handoffStyle":"","timeAnchor":"","curationAngle":"","emotionalTone":"","vocabulary":[],"usedTimeReference":false,"usedAISelfAwareness":false}}',
    config.language === "es"
      ? "intro debe ser un solo bloque de copy hablado, corto y natural. Nada de listas, explicaciones, markdown o comillas extra."
      : "intro must be a single block of short, natural spoken copy. No lists, no explanations, no markdown, no extra quotation marks.",
    config.language === "es"
      ? "Haz que se sienta hablado de principio a fin: una mente, un momento, una lógica continua."
      : "Make it feel spoken all the way through: one mind, one moment, one continuous train of thought.",
    config.language === "es"
      ? "No saques una mini línea por cada capa. Las capas tienen que fundirse en 2 a 5 oraciones conectadas, según el largo pedido."
      : "Do not output one mini-line per layer. The layers should fuse into 2 to 5 connected sentences, depending on the requested length.",
    config.language === "es"
      ? "La última oración debe aterrizar en la canción y el artista con seguridad tranquila."
      : "The final sentence should land on the song and artist with calm confidence.",
    `Movement plan: ${JSON.stringify(plan.linePattern)}.`,
  ].join(" ");
}

function extractJSONObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function parseGeneratedPayload(rawText: string): GeneratedPayload {
  const trimmed = rawText.trim();
  const jsonBlock = extractJSONObject(trimmed);
  if (!jsonBlock) return {};

  try {
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
    const metadataPayload = (parsed.metadata ?? {}) as Partial<Record<keyof SessionIntroMetadata, unknown>>;
    return {
      intro: typeof parsed.intro === "string" ? parsed.intro.trim() : undefined,
      metadata: {
        openingStyle:
          typeof metadataPayload.openingStyle === "string" ? metadataPayload.openingStyle.trim() : undefined,
        length: typeof metadataPayload.length === "string" ? metadataPayload.length.trim() : undefined,
        stationStyle:
          typeof metadataPayload.stationStyle === "string" ? metadataPayload.stationStyle.trim() : undefined,
        handoffStyle:
          typeof metadataPayload.handoffStyle === "string" ? metadataPayload.handoffStyle.trim() : undefined,
        timeAnchor: typeof metadataPayload.timeAnchor === "string" ? metadataPayload.timeAnchor.trim() : undefined,
        curationAngle:
          typeof metadataPayload.curationAngle === "string" ? metadataPayload.curationAngle.trim() : undefined,
        emotionalTone:
          typeof metadataPayload.emotionalTone === "string" ? metadataPayload.emotionalTone.trim() : undefined,
        vocabulary: Array.isArray(metadataPayload.vocabulary)
          ? metadataPayload.vocabulary.filter((value): value is string => typeof value === "string").slice(0, 12)
          : undefined,
        usedTimeReference:
          typeof metadataPayload.usedTimeReference === "boolean" ? metadataPayload.usedTimeReference : undefined,
        usedAISelfAwareness:
          typeof metadataPayload.usedAISelfAwareness === "boolean" ? metadataPayload.usedAISelfAwareness : undefined,
      },
    };
  } catch {
    return {};
  }
}

function cleanGeneratedIntro(text: string): string {
  return splitParagraphs(text.replace(/^["“”'‘’]+|["“”'‘’]+$/g, ""))
    .map((paragraph) => normalizeWhitespace(paragraph).replace(/\s+([,.!?;:])/g, "$1"))
    .join("\n\n")
    .trim();
}

function containsGenericIntroPlatitude(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  return genericIntroPlatitudePatterns.some((pattern) => pattern.test(normalized));
}

function containsRepeatedOpening(text: string, recentOpenings: string[]): boolean {
  const firstSentence = normalizeWhitespace(text.split(/(?<=[.!?])\s+/)[0] ?? "");
  const normalized = normalizedContainment(firstSentence);
  return Boolean(normalized && recentOpenings.some((opening) => normalizedContainment(opening) === normalized));
}

function containsWrongTimeCue(intro: string, context: SessionIntroShowContext, djID: string): boolean {
  const allowed = allowedTimeOfDayPhrases(context.timeContext.timeOfDay, djID);
  if (!allowed.length) return false;

  const normalized = normalizedContainment(intro);
  const timeOfDay = context.timeContext.timeOfDay.toLowerCase();
  const bannedMap: Record<string, string[]> = {
    morning: isSpanishDJ(djID)
      ? ["tarde", "esta tarde", "noche", "esta noche", "ya tarde"]
      : ["afternoon", "evening", "night", "late night", "tonight"],
    afternoon: isSpanishDJ(djID)
      ? ["mañana", "esta mañana", "noche", "esta noche"]
      : ["morning", "evening", "night", "late night", "tonight"],
    evening: isSpanishDJ(djID)
      ? ["mañana", "esta mañana"]
      : ["morning", "late night"],
    night: isSpanishDJ(djID)
      ? ["mañana", "esta mañana", "tarde", "esta tarde"]
      : ["morning", "afternoon", "evening"],
  };
  return (bannedMap[timeOfDay] ?? []).some((phrase) => normalized.includes(normalizedContainment(phrase)));
}

function normalizeIntro(
  raw: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan
): string | null {
  const paragraphs = splitParagraphs(raw);
  if (!paragraphs.length || paragraphs.length > maxParagraphCountByLength[plan.length]) {
    return null;
  }

  const intro = paragraphs.join("\n\n").trim();
  if (!intro) {
    return null;
  }

  const words = wordCount(intro);
  if (words < minWordCountByLength[plan.length] || words > maxWordCountByLength[plan.length]) {
    return null;
  }

  const sentences = sentenceCount(intro);
  if (sentences < minSentenceCountByLength[plan.length] || sentences > maxSentenceCountByLength[plan.length]) {
    return null;
  }

  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/.test(intro)) {
    return null;
  }
  if (genericIntroPhrases.some((phrase) => normalizedContainment(intro).includes(phrase))) {
    return null;
  }
  if (containsGenericIntroPlatitude(intro)) {
    return null;
  }
  if (containsRepeatedOpening(intro, context.recentHistory.recentOpeningPhrases)) {
    return null;
  }
  if (containsWrongTimeCue(intro, context, request.djID)) {
    return null;
  }

  const normalized = normalizedContainment(intro);
  if (!normalized.includes(normalizedContainment(request.firstTrack.title))) {
    return null;
  }
  if (!normalized.includes(normalizedContainment(request.firstTrack.artist))) {
    return null;
  }

  const firstSentence = normalizeWhitespace(intro.split(/(?<=[.!?])\s+/)[0] ?? "");
  if (bannedStandaloneOpeners.some((phrase) => firstSentence.startsWith(phrase))) {
    return null;
  }

  if (!/[.!?]$/.test(intro)) {
    return null;
  }

  return intro;
}

function extractVocabularyTokens(intro: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "with",
    "that",
    "this",
    "here",
    "from",
    "into",
    "tonight",
    "waiv",
    "w",
    "a",
    "i",
    "v",
    "esta",
    "noche",
    "con",
    "para",
    "que",
  ]);

  const counts = new Map<string, number>();
  normalizedContainment(intro)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopWords.has(token))
    .forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([token]) => token);
}

function inferMetadata(
  intro: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan,
  metadata: Partial<SessionIntroMetadata> | undefined
): SessionIntroMetadata {
  const usedTimeReference =
    containsPhrase(intro, allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID))
    || containsPhrase(intro, [context.timeContext.dayOfWeek, context.timeContext.label]);

  return {
    archetype: metadata?.archetype || plan.openingStyle,
    sessionType: context.sessionType,
    openingStructure: metadata?.openingStructure || plan.linePattern.map((group) => group.join("+")).join(">"),
    handoffStyle: metadata?.handoffStyle || plan.handoffStyle,
    emotionalTone: metadata?.emotionalTone || djConfigFor(request.djID).moodWords[0] || "natural",
    vocabulary: metadata?.vocabulary?.length ? metadata.vocabulary : extractVocabularyTokens(intro),
    usedTimeReference: typeof metadata?.usedTimeReference === "boolean" ? metadata.usedTimeReference : usedTimeReference,
    usedAISelfAwareness:
      typeof metadata?.usedAISelfAwareness === "boolean" ? metadata.usedAISelfAwareness : false,
    sentenceCount: sentenceCount(intro),
    openingStyle: metadata?.openingStyle || plan.openingStyle,
    length: metadata?.length || plan.length,
    stationStyle: metadata?.stationStyle || plan.stationStyle,
    timeAnchor: metadata?.timeAnchor || plan.timeAnchor,
    curationAngle: metadata?.curationAngle || plan.curationAngle,
  };
}

function evaluateIntro(
  intro: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan
): number {
  let score = 1;
  const normalized = normalizedContainment(intro);
  const firstSentence = normalizeWhitespace(intro.split(/(?<=[.!?])\s+/)[0] ?? "");

  if (!normalized.includes(normalizedContainment(request.firstTrack.title))) score -= 0.4;
  if (!normalized.includes(normalizedContainment(request.firstTrack.artist))) score -= 0.4;
  if (containsGenericIntroPlatitude(intro)) score -= 0.28;
  if (genericIntroPhrases.some((phrase) => normalized.includes(phrase))) score -= 0.34;
  if (containsRepeatedOpening(intro, context.recentHistory.recentOpeningPhrases)) score -= 0.2;
  if (containsWrongTimeCue(intro, context, request.djID)) score -= 0.28;
  if (!containsPhrase(intro, allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID))) score -= 0.08;
  if (bannedStandaloneOpeners.some((phrase) => firstSentence.startsWith(phrase))) score -= 0.2;
  if (plan.stationStyle !== "omit_station_once_in_awhile" && !containsPhrase(intro, [plan.stationStyle])) score -= 0.08;

  return score;
}

async function requestAnthropicText(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
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
      max_tokens: 360,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(unreadable)");
    console.error(`[session-intro] Anthropic API error ${response.status} model=${model}: ${errorBody}`);
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  return payload.content?.find((item) => item.type === "text")?.text?.trim() || null;
}

async function generateStructuredIntro(
  request: SessionIntroRequest
): Promise<{ intro: string; model: string; metadata: SessionIntroMetadata } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model =
    process.env.ANTHROPIC_SESSION_INTRO_MODEL?.trim()
    || process.env.ANTHROPIC_MODEL?.trim()
    || "claude-haiku-4-5-20251001";

  const context = request.showContext ?? defaultShowContext(request);
  const plan = buildIntroDecisionPlan(request, context);
  const config = djConfigFor(request.djID);

  const systemPrompt = [
    buildSystemPrompt(),
    djPersonalityPrompt(config),
    request.personaHint ? `Additional persona guidance: ${request.personaHint}` : "",
    request.toneGuardrails ? `Tone guardrails: ${request.toneGuardrails}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const userPrompt = [buildFrameworkPrompt(request, context, plan), buildOutputPrompt(plan, request.djID)]
    .filter(Boolean)
    .join(" ");

  const raw = await requestAnthropicText(apiKey, model, systemPrompt, userPrompt).catch((err) => {
    console.error(`[session-intro] requestAnthropicText threw: ${err}`);
    return null;
  });

  if (!raw) {
    console.error("[session-intro] no raw text returned from LLM");
    return null;
  }

  const payload = parseGeneratedPayload(raw);
  const intro = payload.intro ? cleanGeneratedIntro(payload.intro) : "";
  if (!intro) {
    console.error(`[session-intro] intro extraction failed. raw=${raw.slice(0, 240)}`);
    return null;
  }

  const normalized = normalizeIntro(intro, request, context, plan);
  if (!normalized) {
    console.error(`[session-intro] normalizeIntro rejected intro="${intro.slice(0, 240)}"`);
    return null;
  }

  const score = evaluateIntro(normalized, request, context, plan);
  if (score < 0.62) {
    console.error(`[session-intro] score below threshold: ${score.toFixed(2)} intro="${normalized.slice(0, 240)}"`);
    return null;
  }

  return {
    intro: normalized,
    model,
    metadata: inferMetadata(normalized, request, context, plan, payload.metadata),
  };
}

export function normalizeSessionIntroRequest(input: unknown): SessionIntroRequest | null {
  const payload = (input ?? {}) as Partial<Record<string, unknown>>;
  const djID = typeof payload.djID === "string" ? payload.djID.trim() : "";
  const firstTrack = normalizeTrack(payload.firstTrack);
  const introKind = typeof payload.introKind === "string" ? payload.introKind.trim() : "standard";
  const listenerContext = payload.listenerContext ? normalizeListenerContext(payload.listenerContext, djID) : undefined;
  const personaHint = typeof payload.personaHint === "string" ? payload.personaHint.trim() : "";
  const toneGuardrails = typeof payload.toneGuardrails === "string" ? payload.toneGuardrails.trim() : "";

  if (!djID || !firstTrack) {
    return null;
  }

  const listenerProfileRaw = (payload.listenerProfile ?? null) as Partial<ListenerProfile> | null;
  const listenerProfile: ListenerProfile | null = listenerProfileRaw
    ? {
        topArtists: Array.isArray(listenerProfileRaw.topArtists)
          ? listenerProfileRaw.topArtists.filter((value): value is string => typeof value === "string").slice(0, 6)
          : undefined,
        recentArtists: Array.isArray(listenerProfileRaw.recentArtists)
          ? listenerProfileRaw.recentArtists.filter((value): value is string => typeof value === "string").slice(0, 6)
          : undefined,
        tasteKeywords: Array.isArray(listenerProfileRaw.tasteKeywords)
          ? listenerProfileRaw.tasteKeywords.filter((value): value is string => typeof value === "string").slice(0, 6)
          : undefined,
        listeningPattern:
          typeof listenerProfileRaw.listeningPattern === "string"
            ? listenerProfileRaw.listeningPattern.trim() || undefined
            : undefined,
      }
    : null;

  const request: SessionIntroRequest = {
    djID,
    firstTrack,
    introKind: introKind || "standard",
    listenerContext: listenerContext ?? undefined,
    personaHint: personaHint || undefined,
    toneGuardrails: toneGuardrails || undefined,
    listenerProfile: listenerProfile ?? undefined,
  };

  return {
    ...request,
    showContext: normalizeShowContext(payload.showContext, request),
  };
}

export async function generateSessionIntro(request: SessionIntroRequest): Promise<SessionIntroResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { kind: "no_content", reason: "no_api_key" };
  }

  const result = await generateStructuredIntro(request).catch(() => null);
  if (!result) {
    return { kind: "no_content", reason: "llm_rejected" };
  }

  return {
    kind: "success",
    response: {
      intro: result.intro,
      llmModel: result.model,
      metadata: result.metadata,
    },
  };
}
