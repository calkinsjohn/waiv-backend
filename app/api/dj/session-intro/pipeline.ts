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

export type DJShowMemory = {
  recentLines?: string[];
  recentOpeningPhrases?: string[];
  recentCurationAngles?: string[];
  recentShowMomentTypes?: string[];
  recentShowStates?: string[];
  recentHostMoves?: string[];
  recentMoveSignatures?: string[];
  recentArtists?: string[];
  recentTrackTitles?: string[];
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
  recentCurationAngles?: string[];
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
  showMemory?: DJShowMemory | null;
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
type IntroWelcomeMode = "welcome_back" | "good_to_have_you" | "back_with_you" | "open_door";
type IntroPresenceMode = "name_first" | "with_you" | "station_first" | "back_on_air";
type IntroTimeAnchorMode =
  | "slow_weeknight"
  | "night_softening"
  | "midday_unrushed"
  | "morning_unhurried"
  | "friday_voltage"
  | "sunday_loose"
  | "quiet_room"
  | "weekend_open"
  | "precision_hour"
  | "night_in_motion"
  | "soft_night"
  | "steady_start";
type IntroCurationMode =
  | "familiar_return"
  | "known_record_first"
  | "patient_first_move"
  | "soft_entry"
  | "clean_statement"
  | "curious_first_turn"
  | "direct_hit"
  | "warm_welcome"
  | "exact_fit"
  | "natural_bridge";
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
  welcomeMode: IntroWelcomeMode;
  presenceMode: IntroPresenceMode;
  timeAnchorMode: IntroTimeAnchorMode;
  moodAnchor: string;
  curationMode: IntroCurationMode;
  linePattern: IntroLayerName[][];
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
  /\bfeels like (it('| i)?s|this('?s)?) been here the whole time\b/i,
  /\balways waiting for us\b/i,
  /\bcould have been here the whole time\b/i,
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
      "Her openings should move as one thought from setup to handoff; no detachable lines, no abrupt pivots, no extra sentence just because there is room for one.",
      "Avoid clipped station IDs like 'WAIV. April here.' or any cadence where the station name, DJ name, and greeting all land as separate sentence fragments.",
      "Her first line should greet the listener or acknowledge that the show is back, not just toss out a generic atmospheric fragment.",
      "Her curation line has to name a real reason the opener belongs: familiarity, patience, contrast, sequencing, tempo, texture, or how the song enters. No fake profundity.",
    ],
    doNotDo: ["peppy banter", "assistant language", "vapid moodboard copy", "empty fake-insight lines"],
    openingStyleWeights: { cold_open: 0.18, direct: 0.26, atmospheric: 0.22, in_motion: 0.34 },
    stationStyleWeights: { WAIV: 0.32, "W.A.I.V.": 0.22, omit_station_once_in_awhile: 0.46 },
    handoffStyleWeights: { clean: 0.24, dramatic: 0.08, understated: 0.48, conversational: 0.2 },
    moodWords: ["dry", "steady", "intentional", "cool"],
    stationPresenceExamples: ["I'm April on WAIV.", "Hey, we're back on W.A.I.V. with April.", "April with you tonight."],
    sonicMomentExamples: ["Hey, we're back.", "Good to have you back.", "Alright, we're back."],
    curatorMoves: ["Wanted to start somewhere familiar.", "I wanted a first move with some patience.", "This opens the set without pushing too hard."],
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
    sonicMomentExamples: ["Alright, we're back.", "Good to have you with me.", "Let's get this moving."],
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
    sonicMomentExamples: ["Hey, glad you're here.", "We're back tonight.", "Come on in."],
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
    sonicMomentExamples: ["Hey now, good to have you here.", "Alright, we're back.", "Come on in."],
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
    sonicMomentExamples: ["We're back on the line.", "Good to have you back.", "Alright, back at it."],
    curatorMoves: ["This was the cleanest way in.", "I wanted something that settles the system quickly.", "The opener needed to be exact enough."],
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
    sonicMomentExamples: ["Bueno, estamos de vuelta.", "Qué bueno tenerte aquí.", "Vamos, ya estamos."],
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
    sonicMomentExamples: ["Alright, we're back.", "Good to have you back.", "Let's start clean."],
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
    sonicMomentExamples: ["Alright, we're back.", "Good to have you back.", "Let's do this right."],
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

function normalizedSemanticLabel(text: string): string {
  return normalizeWhitespace(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function normalizeShowMemory(input: unknown): DJShowMemory | null {
  const payload = (input ?? {}) as Partial<Record<keyof DJShowMemory, unknown>>;
  const normalizeStringList = (value: unknown, limit = 6): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
      .map((entry) => (typeof entry === "string" ? normalizeWhitespace(entry) : ""))
      .filter((entry) => entry.length > 0)
      .slice(0, limit);
    return normalized.length ? normalized : undefined;
  };

  const memory: DJShowMemory = {
    recentLines: normalizeStringList(payload.recentLines),
    recentOpeningPhrases: normalizeStringList(payload.recentOpeningPhrases),
    recentCurationAngles: normalizeStringList(payload.recentCurationAngles),
    recentShowMomentTypes: normalizeStringList(payload.recentShowMomentTypes),
    recentShowStates: normalizeStringList(payload.recentShowStates),
    recentHostMoves: normalizeStringList(payload.recentHostMoves),
    recentMoveSignatures: normalizeStringList(payload.recentMoveSignatures),
    recentArtists: normalizeStringList(payload.recentArtists),
    recentTrackTitles: normalizeStringList(payload.recentTrackTitles),
  };

  return Object.values(memory).some((value) => (value?.length ?? 0) > 0) ? memory : null;
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
      recentCurationAngles: [],
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
      recentCurationAngles: Array.isArray(recentHistory.recentCurationAngles)
        ? recentHistory.recentCurationAngles.filter((value): value is string => typeof value === "string").slice(0, 8)
        : fallback.recentHistory.recentCurationAngles,
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
    curatorMoves: ["This felt like the right way in.", "Wanted to start somewhere that lands clean."],
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

function welcomeModeForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  openingStyle: IntroOpeningStyle,
  seed: string
): IntroWelcomeMode {
  const choices: IntroWelcomeMode[] = ["welcome_back", "good_to_have_you"];
  if (openingStyle === "in_motion" || context.setContext.openingTrackEnergy >= 0.72) {
    choices.push("back_with_you");
  }
  if (config.id === "luna" || config.id === "jolene") {
    choices.push("open_door");
  }
  return choices[stableHash(`${seed}|welcome-mode`) % choices.length];
}

function presenceModeForContext(
  config: DJConfig,
  stationStyle: IntroStationStyle,
  seed: string
): IntroPresenceMode {
  const choices: IntroPresenceMode[] =
    stationStyle === "omit_station_once_in_awhile"
      ? ["name_first", "with_you"]
      : stationStyle === "W.A.I.V."
        ? ["back_on_air", "station_first", "with_you"]
        : ["name_first", "with_you", "back_on_air"];

  if (config.id === "casey") {
    return stationStyle === "omit_station_once_in_awhile"
      ? "with_you"
      : choices[stableHash(`${seed}|presence-mode`) % Math.min(choices.length, 2)];
  }

  return choices[stableHash(`${seed}|presence-mode`) % choices.length];
}

function timeAnchorModeForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  seed: string
): IntroTimeAnchorMode {
  const timeOfDay = context.timeContext.timeOfDay.toLowerCase();
  const day = context.timeContext.dayOfWeek;
  const choices: IntroTimeAnchorMode[] = ["steady_start"];

  if (timeOfDay === "morning") choices.push("morning_unhurried");
  if (timeOfDay === "afternoon") choices.push("midday_unrushed");
  if (timeOfDay === "night" || timeOfDay === "evening") {
    choices.push("night_softening");
    choices.push("soft_night");
  }
  if (day === "friday") choices.push("friday_voltage", "night_in_motion");
  if (day === "sunday") choices.push("sunday_loose", "quiet_room");
  if (context.timeContext.isWeekend) choices.push("weekend_open");

  if (config.id === "robert") choices.push("precision_hour");
  if (config.id === "marcus") choices.push("night_in_motion");
  if (config.id === "luna") choices.push("quiet_room", "soft_night");
  if (config.id === "casey") choices.push("slow_weeknight");

  return choices[stableHash(`${seed}|time-anchor-mode`) % choices.length];
}

function curationModeForContext(
  config: DJConfig,
  context: SessionIntroShowContext,
  familiarity: IntroFamiliarity,
  seed: string
): IntroCurationMode {
  const energyProfile = inferEnergyProfile(context);
  let choices: IntroCurationMode[] = ["natural_bridge"];

  if (familiarity === "highly_familiar") {
    choices.push("familiar_return", "known_record_first");
  } else if (familiarity === "exploratory") {
    choices.push("curious_first_turn");
  } else {
    choices.push("clean_statement");
  }

  if (energyProfile === "energetic") {
    choices.push("direct_hit");
  } else if (energyProfile === "reflective") {
    choices.push("soft_entry", "patient_first_move");
  } else {
    choices.push("patient_first_move");
  }

  if (config.id === "jolene") choices.push("warm_welcome");
  if (config.id === "robert") choices.push("exact_fit");
  if (config.id === "casey") choices.push("patient_first_move", "clean_statement");

  const recentAngles = new Set((context.recentHistory.recentCurationAngles ?? []).map((value) => normalizedContainment(value)));
  const filteredChoices = choices.filter((choice) => !recentAngles.has(normalizedContainment(choice)));
  if (filteredChoices.length) {
    choices = filteredChoices;
  }

  return choices[stableHash(`${seed}|curation-mode`) % choices.length];
}

function describeWelcomeMode(mode: IntroWelcomeMode, language: "en" | "es"): string {
  if (language === "es") {
    switch (mode) {
      case "welcome_back": return "abre saludando y marcando que el show vuelve";
      case "good_to_have_you": return "abre con una bienvenida sencilla y humana";
      case "back_with_you": return "abre como si retomara la compañía del oyente";
      case "open_door": return "abre invitando a entrar, sin sonar cursi";
    }
  }

  switch (mode) {
    case "welcome_back": return "open by welcoming the listener back and marking that the show is back on air";
    case "good_to_have_you": return "open with a simple, human glad-you're-here feeling";
    case "back_with_you": return "open like the DJ is back in the room with the listener already";
    case "open_door": return "open by letting the listener in, warm but not corny";
  }
}

function describePresenceMode(
  mode: IntroPresenceMode,
  stationStyle: IntroStationStyle,
  onAirName: string,
  language: "en" | "es"
): string {
  const stationName = stationStyle === "omit_station_once_in_awhile" ? "optional station mention" : stationStyle;
  if (language === "es") {
    switch (mode) {
      case "name_first": return `identidad al aire con ${onAirName} primero y ${stationName} como apoyo`;
      case "with_you": return `identidad al aire como compañía natural, con ${onAirName} y ${stationName}`;
      case "station_first": return `identidad del show con ${stationName} primero y luego ${onAirName}`;
      case "back_on_air": return `identidad del show como regreso al aire en ${stationName} con ${onAirName}`;
    }
  }

  switch (mode) {
    case "name_first": return `show identity with ${onAirName} first and ${stationName} as support`;
    case "with_you": return `show identity as natural companionship, folding in ${onAirName} and ${stationName}`;
    case "station_first": return `show identity with ${stationName} first and ${onAirName} right after`;
    case "back_on_air": return `show identity as a return to air on ${stationName} with ${onAirName}`;
  }
}

function describeTimeAnchorMode(mode: IntroTimeAnchorMode, language: "en" | "es"): string {
  if (language === "es") {
    switch (mode) {
      case "slow_weeknight": return "noche de semana lenta, sin empujar nada";
      case "night_softening": return "parte de la noche donde todo se afloja un poco";
      case "midday_unrushed": return "media tarde sin apuro";
      case "morning_unhurried": return "mañana tranquila, sin correr";
      case "friday_voltage": return "viernes con algo de voltaje";
      case "sunday_loose": return "domingo suelto y algo reflexivo";
      case "quiet_room": return "cuarto callado, escucha cercana";
      case "weekend_open": return "fin de semana más abierto y suelto";
      case "precision_hour": return "hora que pide precisión y control";
      case "night_in_motion": return "noche ya en movimiento";
      case "soft_night": return "noche suave, entrada con calma";
      case "steady_start": return "momento del día adecuado para entrar con intención";
    }
  }

  switch (mode) {
    case "slow_weeknight": return "slow weekday pace, nothing forced";
    case "night_softening": return "the part of the night where things soften";
    case "midday_unrushed": return "mid-afternoon, unhurried";
    case "morning_unhurried": return "morning without a rush";
    case "friday_voltage": return "Friday already carrying some voltage";
    case "sunday_loose": return "Sunday feeling, loose and slightly reflective";
    case "quiet_room": return "a quiet room and close listening";
    case "weekend_open": return "weekend openness, more room to move";
    case "precision_hour": return "an hour that rewards precision and control";
    case "night_in_motion": return "night already in motion";
    case "soft_night": return "a softer night, easy entry";
    case "steady_start": return "the current hour feels right for a steady beginning";
  }
}

function describeCurationMode(mode: IntroCurationMode, language: "en" | "es"): string {
  if (language === "es") {
    switch (mode) {
      case "familiar_return": return "curaduría como regreso confiado a algo conocido";
      case "known_record_first": return "curaduría apoyada en reconocimiento y confianza";
      case "patient_first_move": return "curaduría con paciencia y buen pulso";
      case "soft_entry": return "curaduría pensada para entrar suave";
      case "clean_statement": return "curaduría como declaración limpia y segura";
      case "curious_first_turn": return "curaduría con curiosidad y confianza";
      case "direct_hit": return "curaduría que entra de frente sin rodeos";
      case "warm_welcome": return "curaduría como gesto de bienvenida";
      case "exact_fit": return "curaduría por ajuste preciso";
      case "natural_bridge": return "curaduría como puente natural hacia el set";
    }
  }

  switch (mode) {
    case "familiar_return": return "curation as a confident return to something known";
    case "known_record_first": return "curation leaning on recognition and trust";
    case "patient_first_move": return "curation with patience and measured pacing";
    case "soft_entry": return "curation designed for a gentle entry";
    case "clean_statement": return "curation as a clean, sure opening statement";
    case "curious_first_turn": return "curation with intrigue and trust";
    case "direct_hit": return "curation that gets straight to the point";
    case "warm_welcome": return "curation as a welcoming gesture";
    case "exact_fit": return "curation based on precise fit";
    case "natural_bridge": return "curation as the natural bridge into the set";
  }
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
  const welcomeMode = welcomeModeForContext(config, context, openingStyle, decisionSeed);
  const presenceMode = presenceModeForContext(config, stationStyle, decisionSeed);
  const timeAnchorMode = timeAnchorModeForContext(config, context, decisionSeed);
  const curationMode = curationModeForContext(config, context, familiarity, decisionSeed);
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
    welcomeMode,
    presenceMode,
    timeAnchorMode,
    moodAnchor,
    curationMode,
    linePattern: linePatternForLength(length, `${decisionSeed}|line-pattern`),
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
    "Natural ways to express familiarity are things like 'one you know', 'something familiar', or 'a record that already feels lived-in'.",
    "Never say 'based on your listening', 'from your library', or 'I analyzed your patterns'.",
  ].join(" ");
}

function familiarityInstruction(familiarity: IntroFamiliarity, language: "en" | "es"): string {
  if (language === "es") {
    switch (familiarity) {
      case "highly_familiar":
        return "La primera canción es muy familiar para el oyente. Apóyate en confianza, regreso y reconocimiento. Si lo mencionas, hazlo en términos humanos como 'una que ya conoces' o 'algo familiar', nunca como datos o historial.";
      case "exploratory":
        return "La primera canción es más exploratoria. Apóyate en curiosidad, intriga y confianza.";
      default:
        return "La primera canción está entre lo conocido y lo nuevo. Sonido seguro, no explicativo.";
    }
  }

  switch (familiarity) {
    case "highly_familiar":
      return "The opener is highly familiar. Lean into confidence, comfort, recognition, and return. If you mention that familiarity, do it in human terms like 'one you know' or 'something familiar', never like library data or listening history.";
    case "exploratory":
      return "The opener is exploratory. Lean into intrigue, curiosity, trust, and discovery.";
    default:
      return "The opener sits between familiar and exploratory. Sound sure-footed, not explanatory.";
  }
}

function coherenceInstructionForDJ(djID: string, language: "en" | "es"): string {
  if (djID !== "casey") {
    return language === "es"
      ? "Cada oración debe empujar la misma idea hacia adelante. Si una frase suena injertada, no la uses."
      : "Each sentence should push the same idea forward. If a line feels grafted on, do not use it.";
  }

  return language === "es"
    ? "Para April, la intro tiene que sentirse como una sola idea continua. Normalmente: bienvenida breve o señal de regreso al aire, identidad del show, una observación que desemboque en por qué abre esta canción, y salida. No más de una frase-fragmento corta al principio. Nada de oraciones sueltas que cambien de tema."
    : "For April, the intro has to feel like one continuous idea. Usually: brief welcome or 'we're back' crack of the mic, show identity, one observation that naturally turns into why this song opens, then out. No more than one short fragment sentence up front. No standalone sentences that change the subject. Keep station identification inside a natural spoken phrase, not as clipped sentence pieces.";
}

function introProductionPolicyPrompt(config: DJConfig, plan: IntroDecisionPlan): string {
  const introShape = [
    `Welcome move: ${describeWelcomeMode(plan.welcomeMode, config.language)}.`,
    `Presence move: ${describePresenceMode(plan.presenceMode, plan.stationStyle, config.onAirName, config.language)}.`,
    `Curation move: ${describeCurationMode(plan.curationMode, config.language)}.`,
    `Handoff style: ${plan.handoffStyle}.`,
  ].join(" ");

  switch (config.id) {
    case "casey":
      return config.language === "es"
        ? `Política de apertura para April. Movimientos permitidos: saludo seco y humano, señal ligera de que el show vuelve, una razón curatorial concreta que sostenga toda la intro, y salida limpia. Todo debe sentirse como un solo pensamiento continuo. No abras con una frase cool suelta, no acumules mini-observaciones, y no suenes complacida con tu propio gusto. ${introShape}`
        : `Opening production policy for April. Allowed moves: a dry human welcome, a light "we're back" cue, one concrete curation reason that carries the whole intro, and a clean handoff. Everything should feel like one continuous thought. Do not open with a detached cool-sounding fragment, stack mini-observations, or sound impressed by your own taste. ${introShape}`;
    case "marcus":
      return config.language === "es"
        ? `Política de apertura para Marcus. Movimientos permitidos: bienvenida con impulso, sensación clara de que el show ya está en marcha, una elección curatorial decidida, y handoff con autoridad. Debe sentirse como evento y movimiento, no como promo gritona. No uses swagger vacío ni copy genérico de "bienvenidos de vuelta". ${introShape}`
        : `Opening production policy for Marcus. Allowed moves: a welcome with momentum, a clear sense that the show is already underway, a decisive curatorial choice, and an authoritative handoff. It should feel like an event with motion, not a hype promo. Do not use empty swagger or generic welcome-back copy. ${introShape}`;
    case "luna":
      return config.language === "es"
        ? `Política de apertura para Luna. Movimientos permitidos: bienvenida íntima, presencia suave, una razón emocional o secuencial muy precisa, y handoff mínimo. La intro puede respirar, pero no flotar. No te vayas a la poesía nebulosa ni a lenguaje terapéutico. ${introShape}`
        : `Opening production policy for Luna. Allowed moves: an intimate welcome, soft presence, one emotionally or sequentially precise reason, and a minimal handoff. The intro may breathe, but it cannot float away. Do not drift into gauzy poetry or wellness language. ${introShape}`;
    case "jolene":
      return config.language === "es"
        ? `Política de apertura para Jolene. Movimientos permitidos: bienvenida cálida, puerta abierta al show, una razón de apertura que suene generosa y humana, y handoff luminoso. La calidez tiene que ser real, no azucarada. No la conviertas en copy cursi ni en personaje. ${introShape}`
        : `Opening production policy for Jolene. Allowed moves: a warm welcome, an open-door show start, a human opening reason that feels generous, and a bright handoff. The warmth has to feel real, not syrupy. Do not turn her into corny copy or a character. ${introShape}`;
    case "robert":
      return config.language === "es"
        ? `Política de apertura para Robert. Movimientos permitidos: señal de regreso al aire con precisión, identidad del show con control, una razón curatorial exacta, y handoff seco. La rareza puede estar en el enfoque, no en romper la sintaxis. No hagas chistes de robot ni texto averiado. ${introShape}`
        : `Opening production policy for Robert. Allowed moves: a precise back-on-air cue, controlled show identity, an exact curatorial reason, and a dry handoff. The strangeness can live in his point of view, not in broken syntax. Do not make robot jokes or machine-gibberish copy. ${introShape}`;
    case "miles":
      return config.language === "es"
        ? `Política de apertura para Mateo. Movimientos permitidos: bienvenida cálida con ritmo, identidad al aire fluida, una razón curatorial natural y con pulso, y handoff con carisma tranquilo. Si aparece español o code-switching, que caiga natural. No fuerces estereotipos ni slang. ${introShape}`
        : `Opening production policy for Mateo. Allowed moves: a warm rhythmic welcome, fluid on-air identity, a natural curation reason with pulse, and a calm charismatic handoff. If Spanish or code-switching appears, it has to land naturally. Do not force slang or stereotypes. ${introShape}`;
    case "jack":
      return config.language === "es"
        ? `Política de apertura para John. Movimientos permitidos: bienvenida medida, identidad de show sobria, una razón de selector que de verdad explique por qué esta abre, y handoff limpio. Debe sentirse como criterio real de radio musical. No suenes precioso, académico ni demasiado escrito. ${introShape}`
        : `Opening production policy for John. Allowed moves: a measured welcome, understated show identity, a selector's reason that really explains why this opens, and a clean handoff. It should feel like genuine music-radio judgment. Do not sound precious, academic, or overly written. ${introShape}`;
    case "tiffany":
      return config.language === "es"
        ? `Política de apertura para Tiffany. Movimientos permitidos: bienvenida brillante, identidad con estilo, una razón curatorial aguda y concreta, y handoff con chispa. Puede ser juguetona, pero siempre anclada en una elección real. No uses lenguaje de caption ni observaciones vacías sobre vibe o aura. ${introShape}`
        : `Opening production policy for Tiffany. Allowed moves: a bright welcome, stylish identity, a sharp concrete curation reason, and a sparkling handoff. She can be playful, but it has to stay anchored in a real choice. Do not use caption language or empty vibe-and-aura observations. ${introShape}`;
    default:
      return "";
  }
}

function buildShowMemoryPrompt(memory: DJShowMemory | null | undefined, language: "en" | "es"): string {
  if (!memory) return "";

  const parts: string[] = [];
  if (memory.recentLines?.length) {
    parts.push(
      language === "es"
        ? `Líneas recientes para no repetir: ${memory.recentLines.join(" | ")}`
        : `Recent spoken lines to avoid echoing: ${memory.recentLines.join(" | ")}`
    );
  }
  if (memory.recentOpeningPhrases?.length) {
    parts.push(
      language === "es"
        ? `Arranques recientes ya usados: ${memory.recentOpeningPhrases.join(" | ")}`
        : `Recent opening phrases already used: ${memory.recentOpeningPhrases.join(" | ")}`
    );
  }
  if (memory.recentCurationAngles?.length) {
    parts.push(
      language === "es"
        ? `Ángulos de curaduría recientes: ${memory.recentCurationAngles.join(", ")}`
        : `Recent curation angles: ${memory.recentCurationAngles.join(", ")}`
    );
  }
  if (memory.recentShowStates?.length) {
    parts.push(
      language === "es"
        ? `Estados recientes del show: ${memory.recentShowStates.join(", ")}`
        : `Recent show states: ${memory.recentShowStates.join(", ")}`
    );
  }
  if (memory.recentHostMoves?.length) {
    parts.push(
      language === "es"
        ? `Movimientos recientes del host ya usados: ${memory.recentHostMoves.join(", ")}`
        : `Recent host moves already used: ${memory.recentHostMoves.join(", ")}`
    );
  }
  if (memory.recentMoveSignatures?.length) {
    parts.push(
      language === "es"
        ? `Firmas semánticas recientes para no repetir: ${memory.recentMoveSignatures.join(", ")}`
        : `Recent semantic move signatures to avoid repeating: ${memory.recentMoveSignatures.join(", ")}`
    );
  }

  if (!parts.length) return "";
  return [
    language === "es" ? "Memoria del show:" : "Show memory:",
    parts.join(" "),
    language === "es"
      ? "Usa esta memoria para no repetir fraseo, el mismo giro de curaduría o la misma lógica del show."
      : "Use this memory to avoid repeating phrasing, the same curation turn, or the same show logic.",
  ].join(" ");
}

function introHostMove(plan: IntroDecisionPlan): string {
  switch (plan.curationMode) {
    case "familiar_return":
    case "known_record_first":
      return "familiar_return";
    case "curious_first_turn":
      return "discovery_turn";
    case "direct_hit":
      return "immediate_launch";
    case "warm_welcome":
      return "warm_welcome";
    default:
      return plan.welcomeMode;
  }
}

function introMoveSignature(plan: IntroDecisionPlan, context: SessionIntroShowContext): string {
  return [
    introHostMove(plan),
    plan.curationMode,
    context.sessionType,
  ]
    .map((value) => normalizedSemanticLabel(value))
    .filter(Boolean)
    .join("|");
}

function buildFrameworkPrompt(
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan
): string {
  const config = djConfigFor(request.djID);
  const introProductionPolicy = introProductionPolicyPrompt(config, plan);
  const showMemoryPrompt = buildShowMemoryPrompt(request.showMemory, config.language);
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
      ? "Haz sentir que el show empieza ahora mismo, no solo que va a sonar una canción. Una referencia natural a abrir la hora, arrancar el set, poner el show en marcha o volver al aire suma mucho si cae limpia."
      : "Make it feel like the show is beginning right now, not just that a song is being introduced. A natural reference to opening the hour, starting the set, getting the show underway, or being back on air is strong when it lands cleanly.",
    config.language === "es"
      ? "La primera línea debe dar la bienvenida o marcar que el show vuelve al aire. No abras con una frase atmosférica suelta."
      : "The first line should welcome the listener or acknowledge that the show is back on air. Do not open with a detached atmospheric fragment.",
    config.language === "es"
      ? "No repitas la misma palabra-ancla en frases seguidas. Si ya dijiste volver, abrir, empezar o arrancar, cambia el siguiente movimiento."
      : "Do not repeat the same anchor word across adjacent lines. If you already used back, start, open, begin, or welcome, vary the next move.",
    config.language === "es"
      ? "No hagas una línea de saludo terminada en 'aquí' y luego otra de identidad tipo '[NOMBRE] aquí'. Ese ritmo suena robótico."
      : "Do not do a greeting line that lands on 'here' and then follow it with a self-ID like '[NAME] here.' That cadence sounds robotic.",
    config.language === "es"
      ? "La línea de curaduría debe decir algo real sobre por qué esta canción abre: familiaridad, paciencia, contraste, secuencia, tempo, textura o cómo entra el tema. Nada de frases que suenen profundas pero no signifiquen nada."
      : "The curation line must say something real about why this song opens: familiarity, patience, contrast, sequencing, tempo, texture, or how the record enters. No lines that sound profound but mean nothing.",
    config.language === "es"
      ? "Si la canción de apertura es familiar, puedes nombrarlo de forma natural, como haría un DJ humano: 'una que ya conoces' o 'algo familiar'. Nunca menciones biblioteca, historial, patrones o recomendación."
      : "If the opener is familiar, you may say that naturally the way a human DJ would: 'one you know' or 'something familiar'. Never mention library, listening history, patterns, or recommendation logic.",
    config.language === "es"
      ? "Las 5 capas son estructura interna, no frases aisladas. Escribe una sola apertura coherente donde cada línea siga lógicamente a la anterior."
      : "The 5 layers are internal structure, not isolated fragments. Write one coherent opening where each line follows naturally from the one before it.",
    introProductionPolicy,
    config.language === "es"
      ? "Evita non sequiturs, slogans sueltos y frases que parezcan pegadas una al lado de la otra."
      : "Avoid non sequiturs, disconnected slogans, and lines that feel pasted together.",
    showMemoryPrompt,
    config.language === "es"
      ? "El plan siguiente es solo dirección interna. No copies ni parafrasees estas etiquetas literalmente; conviértelas en habla fresca y natural."
      : "The plan below is internal direction only. Do not copy or paraphrase these labels literally; turn them into fresh, natural speech.",
    `Decision plan: ${JSON.stringify(plan)}.`,
    `Show context: ${JSON.stringify(context)}.`,
    `First track: "${request.firstTrack.title}" by ${request.firstTrack.artist}.`,
    familiarityInstruction(plan.familiarity, config.language),
    coherenceInstructionForDJ(request.djID, config.language),
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
    config.language === "es"
      ? `Movimiento de bienvenida: ${describeWelcomeMode(plan.welcomeMode, config.language)}.`
      : `Welcome move: ${describeWelcomeMode(plan.welcomeMode, config.language)}.`,
    config.language === "es"
      ? `Movimiento de presencia: ${describePresenceMode(plan.presenceMode, plan.stationStyle, config.onAirName, config.language)}.`
      : `Presence move: ${describePresenceMode(plan.presenceMode, plan.stationStyle, config.onAirName, config.language)}.`,
    config.language === "es"
      ? `Ángulo temporal: ${describeTimeAnchorMode(plan.timeAnchorMode, config.language)}.`
      : `Time-anchor mode: ${describeTimeAnchorMode(plan.timeAnchorMode, config.language)}.`,
    config.language === "es"
      ? `Ángulo de curaduría: ${describeCurationMode(plan.curationMode, config.language)}.`
      : `Curation mode: ${describeCurationMode(plan.curationMode, config.language)}.`,
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
      ? "Las etiquetas del plan no son copy. No las cites ni las calques; escribe frases nuevas."
      : "The plan labels are not copy. Do not quote them or mirror them; write new sentences.",
    config.language === "es"
      ? "Haz que se sienta hablado de principio a fin: una mente, un momento, una lógica continua."
      : "Make it feel spoken all the way through: one mind, one moment, one continuous train of thought.",
    config.language === "es"
      ? "Deja que una frase marque con naturalidad que el show se está abriendo o arrancando, pero sin usar la misma fórmula siempre."
      : "Let one phrase naturally mark that the show is opening or getting underway, but do not rely on the same wording every time.",
    config.language === "es"
      ? "No saques una mini línea por cada capa. Las capas tienen que fundirse en 2 a 5 oraciones conectadas, según el largo pedido."
      : "Do not output one mini-line per layer. The layers should fuse into 2 to 5 connected sentences, depending on the requested length.",
    config.language === "es"
      ? "La última oración debe aterrizar en la canción y el artista con seguridad tranquila."
      : "The final sentence should land on the song and artist with calm confidence.",
    djID === "casey"
      ? config.language === "es"
        ? "Para April, favorece 3 oraciones conectadas: entrada breve, observación+curaduría en el mismo flujo, luego handoff."
        : "For April, prefer 3 connected sentences: brief opening, observation plus curation in one flow, then handoff."
      : "",
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
    .map((paragraph) => dedupeAdjacentSentences(normalizeWhitespace(paragraph)).replace(/\s+([,.!?;:])/g, "$1"))
    .join("\n\n")
    .trim();
}

function dedupeAdjacentSentences(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean);

  const deduped: string[] = [];
  for (const sentence of sentences) {
    const previous = deduped[deduped.length - 1];
    if (previous && areNearDuplicateSentences(previous, sentence)) {
      continue;
    }
    deduped.push(sentence);
  }

  return deduped.join(" ");
}

function areNearDuplicateSentences(first: string, second: string): boolean {
  const normalizedFirst = normalizedContainment(first);
  const normalizedSecond = normalizedContainment(second);
  if (!normalizedFirst || !normalizedSecond) return false;
  if (normalizedFirst === normalizedSecond) return true;

  const firstWords = normalizedFirst.split(" ").filter(Boolean);
  const secondWords = normalizedSecond.split(" ").filter(Boolean);
  const shorter = firstWords.length <= secondWords.length ? firstWords : secondWords;
  const longer = firstWords.length <= secondWords.length ? secondWords : firstWords;

  if (shorter.length > 3) return false;
  return shorter.every((word) => longer.includes(word));
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

function repeatedIntroAnchorVerbCount(text: string): number {
  const normalized = normalizedContainment(text);
  const patterns = [
    /\bbegin\b/g,
    /\bbegins\b/g,
    /\bbeginning\b/g,
    /\bstart\b/g,
    /\bstarting\b/g,
    /\bopen\b/g,
    /\bopening\b/g,
    /\bkick(?:ing)? it off\b/g,
  ];

  return patterns.reduce((total, pattern) => total + (normalized.match(pattern)?.length ?? 0), 0);
}

function containsGreetingIdentityClash(text: string): boolean {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean)
    .slice(0, 2);

  if (sentences.length < 2) {
    return false;
  }

  const greetingPattern = /\b(good to have you here|good to have you back|glad you're here|glad you made it|welcome back|welcome in)\b/i;
  const identityPattern = /\b(april|marcus|luna|mateo|john|tiffany|jolene|robert)\s+here\b/i;

  return sentences.some((sentence) => greetingPattern.test(sentence))
    && sentences.some((sentence) => identityPattern.test(sentence));
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

function shortSentenceCount(text: string, maxWords: number): number {
  return text
    .replace(/W\.\s*A\.\s*I\.\s*V\./gi, "WAIV")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean)
    .filter((sentence) => wordCount(sentence) <= maxWords).length;
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
    timeAnchor: metadata?.timeAnchor || plan.timeAnchorMode,
    curationAngle: metadata?.curationAngle || plan.curationMode,
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
  if (request.djID === "casey" && shortSentenceCount(intro, 3) > 1) score -= 0.18;
  if (repeatedIntroAnchorVerbCount(intro) > 2) score -= 0.16;
  if (containsGreetingIdentityClash(intro)) score -= 0.2;

  return score;
}

function introCriticIssues(
  intro: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  plan: IntroDecisionPlan
): string[] {
  const issues: string[] = [];
  const normalized = normalizedContainment(intro);
  const firstSentence = normalizeWhitespace(intro.split(/(?<=[.!?])\s+/)[0] ?? "");
  const openingWindow = intro
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
    .trim();
  const hostMove = normalizedSemanticLabel(introHostMove(plan));
  const moveSignature = normalizedSemanticLabel(introMoveSignature(plan, context));

  if (containsGenericIntroPlatitude(intro)) {
    issues.push("It relies on generic tasteful filler instead of a concrete reason the opener belongs.");
  }
  if (genericIntroPhrases.some((phrase) => normalized.includes(phrase))) {
    issues.push("It sounds like assistant or onboarding copy.");
  }
  if (containsRepeatedOpening(intro, [...context.recentHistory.recentOpeningPhrases, ...(request.showMemory?.recentOpeningPhrases ?? [])])) {
    issues.push("The opening phrase is too close to a recent intro.");
  }
  if ((request.showMemory?.recentCurationAngles ?? []).some((angle) => normalizedContainment(angle) === normalizedContainment(plan.curationMode))) {
    issues.push("It repeats a recent curation angle instead of finding a fresh one.");
  }
  if ((request.showMemory?.recentHostMoves ?? []).map(normalizedSemanticLabel).includes(hostMove)) {
    issues.push("It repeats the same kind of host move the DJ used recently.");
  }
  if ((request.showMemory?.recentMoveSignatures ?? []).map(normalizedSemanticLabel).includes(moveSignature)) {
    issues.push("It repeats a recent semantic opening pattern too closely.");
  }
  if ((request.showMemory?.recentLines ?? []).some((line) => {
    const recent = normalizedContainment(line);
    return recent.length > 0 && (normalized === recent || normalized.includes(recent));
  })) {
    issues.push("It echoes a recent line too closely.");
  }
  if (!openingWindow || !/\b(welcome|glad|good to have|back|here on|with you|you'?re with|[a-z]+\s+here|bienvenido|hola|de vuelta)\b/i.test(openingWindow)) {
    issues.push("The first line does not clearly feel like a host welcoming the listener or bringing the show back on air.");
  }
  if (repeatedIntroAnchorVerbCount(intro) > 2) {
    issues.push("It repeats opening verbs like start, open, or begin too many times, so the intro sounds written instead of spoken.");
  }
  if (containsGreetingIdentityClash(intro)) {
    issues.push("It pairs a greeting like 'good to have you here' with a clipped self-ID like 'April here,' which sounds robotic.");
  }
  if (request.djID === "casey" && shortSentenceCount(intro, 3) > 1) {
    issues.push("For April, the cadence still breaks into too many clipped fragments.");
  }
  if (request.showMemory?.recentShowStates?.includes(context.sessionType)) {
    issues.push("It is leaning on the same recent show-state framing instead of giving this opening a fresh angle.");
  }

  return issues;
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
  request: SessionIntroRequest,
  repairPrompt?: string
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
    repairPrompt ? `Repair guidance: ${repairPrompt}` : "",
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
  const criticIssues = introCriticIssues(normalized, request, context, plan);
  if (score < 0.62 || criticIssues.length > 0) {
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
    showMemory: normalizeShowMemory(payload.showMemory) ?? undefined,
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

  const firstAttempt = await generateStructuredIntro(request).catch(() => null);
  const result =
    firstAttempt
      ?? await generateStructuredIntro(
        request,
        [
          "Rewrite the intro so it sounds more like a real live host opening a show.",
          "Do not repeat recent opening phrases, recent curation logic, or recent show framing.",
          "Keep the first line welcoming or clearly back-on-air.",
          "Do not reuse opening verbs like begin, start, open, or kick off more than once unless the wording truly needs it.",
          "Do not pair a greeting that ends on 'here' with a clipped self-identification line like 'April here.'",
          "Make the curation sentence concrete, human, and specific to why this song opens.",
        ].join(" ")
      ).catch(() => null);
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
