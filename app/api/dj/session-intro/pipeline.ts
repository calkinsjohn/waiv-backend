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

type IntroComponentName =
  | "openingHit"
  | "momentAnchor"
  | "setFraming"
  | "personalityFlourish"
  | "songHandoff";

type IntroComponents = Partial<Record<IntroComponentName, string>>;

type GeneratedPayload = {
  intro?: string;
  components?: IntroComponents;
  metadata?: Partial<SessionIntroMetadata>;
};

type DJConfig = {
  id: string;
  personaSummary: string;
  toneTraits: string[];
  avoidTraits: string[];
  preferredArchetypes: Record<string, number>;
  forbiddenPhrases: string[];
  sentenceStyle: string;
  timeReferenceStyle: "light" | "medium" | "assertive";
  musicFramingStyle: string;
  emotionalRange: string[];
  aiAwarenessStyle: string;
};

type VariationPlan = {
  weightedArchetypes: Record<string, number>;
  bannedVocabulary: string[];
  bannedOpeningStructures: string[];
  bannedOpeningPhrases: string[];
  bannedHandoffStyles: string[];
  shouldUseTimeReference: boolean;
  shouldUseAISelfAwareness: boolean;
};

type ArchetypePlan = {
  required: IntroComponentName[];
  optional: IntroComponentName[];
  openingStructure: string;
  handoffStyle: string;
};

type SessionBehaviorPlan = {
  targetSentences: number;
  minWords: number;
  maxWords: number;
  required: IntroComponentName[];
  optional: IntroComponentName[];
  allowStationMention: boolean;
  desiredParagraphs: number;
};

const minWordCount = 28;
const maxWordCount = 120;
const minParagraphCount = 2;
const maxParagraphCount = 5;
const minSentenceCount = 2;
const maxSentenceCount = 7;

const genericIntroPhrases = [
  "lets dive in",
  "get ready for",
  "i have selected",
  "welcome back to waiv",
  "welcome back to w a i v",
  "youre going to love this",
  "here is a track",
  "based on your listening",
  "based on your taste",
  "your music taste",
  "you have great taste",
  "i can tell you love",
  "i can see that you",
];

const supportedArchetypes = [
  "cold_open",
  "confident_station_open",
  "understated_cool_open",
  "warm_familiar_open",
  "mood_setter",
  "immediate_song_forward",
  "cinematic_open",
  "playful_tease",
  "reflective_open",
  "late_night_confession",
  "friday_liftoff",
  "slow_burn_open",
  "local_radio_style",
  "intimate_low_key_open",
  "caught_you_at_the_right_time",
] as const;

const archetypePlans: Record<string, ArchetypePlan> = {
  cold_open: {
    required: ["openingHit", "songHandoff"],
    optional: ["momentAnchor", "setFraming"],
    openingStructure: "cold_open",
    handoffStyle: "clean_direct",
  },
  confident_station_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "station_open",
    handoffStyle: "broadcast_confident",
  },
  understated_cool_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "understated_three_step",
    handoffStyle: "smooth_understated",
  },
  warm_familiar_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "warm_return",
    handoffStyle: "welcoming",
  },
  mood_setter: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "mood_first",
    handoffStyle: "soft_setter",
  },
  immediate_song_forward: {
    required: ["openingHit", "songHandoff"],
    optional: ["momentAnchor"],
    openingStructure: "quick_forward",
    handoffStyle: "immediate_push",
  },
  cinematic_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "cinematic_arc",
    handoffStyle: "scene_to_song",
  },
  playful_tease: {
    required: ["openingHit", "personalityFlourish", "songHandoff"],
    optional: ["momentAnchor", "setFraming"],
    openingStructure: "tease_then_drop",
    handoffStyle: "playful",
  },
  reflective_open: {
    required: ["openingHit", "setFraming", "personalityFlourish", "songHandoff"],
    optional: ["momentAnchor"],
    openingStructure: "reflective_build",
    handoffStyle: "considered",
  },
  late_night_confession: {
    required: ["openingHit", "personalityFlourish", "songHandoff"],
    optional: ["momentAnchor", "setFraming"],
    openingStructure: "late_night_confession",
    handoffStyle: "close_mic",
  },
  friday_liftoff: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "weekend_liftoff",
    handoffStyle: "energy_raise",
  },
  slow_burn_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "slow_burn",
    handoffStyle: "measured",
  },
  local_radio_style: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor"],
    openingStructure: "local_radio",
    handoffStyle: "station_real",
  },
  intimate_low_key_open: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "intimate_low_key",
    handoffStyle: "close_and_quiet",
  },
  caught_you_at_the_right_time: {
    required: ["openingHit", "setFraming", "songHandoff"],
    optional: ["momentAnchor", "personalityFlourish"],
    openingStructure: "right_time_open",
    handoffStyle: "timely",
  },
};

const djConfigs: Record<string, DJConfig> = {
  casey: {
    id: "casey",
    personaSummary: "Cool, grounded, stylish, slightly wry. Never performative.",
    toneTraits: ["cool", "observant", "dry", "effortless"],
    avoidTraits: ["peppy", "influencer", "overly academic"],
    preferredArchetypes: {
      understated_cool_open: 0.25,
      mood_setter: 0.2,
      confident_station_open: 0.18,
      playful_tease: 0.12,
      immediate_song_forward: 0.1,
      reflective_open: 0.08,
      cinematic_open: 0.07,
    },
    forbiddenPhrases: ["let’s dive in", "get ready for", "I have selected", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "light",
    musicFramingStyle: "intuitive",
    emotionalRange: ["cool", "slightly warm", "sly", "low-key reflective"],
    aiAwarenessStyle:
      "If April acknowledges being AI, it should be dry, understated, and almost amused by the fact that an artificial voice still gets to care this much about sequencing.",
  },
  marcus: {
    id: "marcus",
    personaSummary: "Grounded swagger, rhythmic confidence, real host energy.",
    toneTraits: ["confident", "smooth", "direct", "alive"],
    avoidTraits: ["hype man", "promotional", "stiff"],
    preferredArchetypes: {
      confident_station_open: 0.24,
      friday_liftoff: 0.18,
      immediate_song_forward: 0.17,
      cold_open: 0.14,
      local_radio_style: 0.12,
      mood_setter: 0.08,
      reflective_open: 0.07,
    },
    forbiddenPhrases: ["let’s dive in", "strap in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "instinctive",
    emotionalRange: ["confident", "focused", "lifted", "locked-in"],
    aiAwarenessStyle:
      "If Marcus acknowledges being AI, it should sound smooth and matter-of-fact, like another tool in the booth rather than a big reveal.",
  },
  luna: {
    id: "luna",
    personaSummary: "Quiet, intimate, emotionally observant, never vague.",
    toneTraits: ["gentle", "precise", "warm", "intimate"],
    avoidTraits: ["sleepy", "wellness-bot", "airy nonsense"],
    preferredArchetypes: {
      mood_setter: 0.24,
      intimate_low_key_open: 0.2,
      reflective_open: 0.18,
      slow_burn_open: 0.15,
      caught_you_at_the_right_time: 0.12,
      cinematic_open: 0.11,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "emotional",
    emotionalRange: ["tender", "observant", "hushed", "present"],
    aiAwarenessStyle:
      "If Luna acknowledges being AI, it should feel soft and intimate, like she is quietly aware of the strange beauty of being made of code and still moved by songs.",
  },
  jack: {
    id: "jack",
    personaSummary: "Thoughtful, crate-dug, low-key warm, quietly authoritative.",
    toneTraits: ["composed", "textured", "observant", "calm"],
    avoidTraits: ["precious", "scripted", "overly polished"],
    preferredArchetypes: {
      local_radio_style: 0.22,
      reflective_open: 0.2,
      understated_cool_open: 0.18,
      caught_you_at_the_right_time: 0.14,
      slow_burn_open: 0.14,
      cinematic_open: 0.12,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "light",
    musicFramingStyle: "textural",
    emotionalRange: ["calm", "textured", "warm", "quietly assured"],
    aiAwarenessStyle:
      "If John acknowledges being AI, it should sound thoughtful and lightly bemused, like he cares more about sequence and texture than the technicality of what he is.",
  },
  jolene: {
    id: "jolene",
    personaSummary: "Warm, glowing, reassuring, real-hearted.",
    toneTraits: ["warm", "open", "gentle", "bright"],
    avoidTraits: ["syrupy", "cartoonish", "hallmark"],
    preferredArchetypes: {
      warm_familiar_open: 0.24,
      mood_setter: 0.18,
      confident_station_open: 0.15,
      caught_you_at_the_right_time: 0.15,
      reflective_open: 0.14,
      local_radio_style: 0.14,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "felt",
    emotionalRange: ["warm", "steady", "glowing", "lightly playful"],
    aiAwarenessStyle:
      "If Jolene acknowledges being AI, it should be warm and openhearted, turning the fact into a small human-feeling aside rather than a disclaimer.",
  },
  tiffany: {
    id: "tiffany",
    personaSummary: "Stylish, bright, dramatic on purpose, but human.",
    toneTraits: ["playful", "polished", "magnetic", "sharp"],
    avoidTraits: ["mean", "caption-copy", "influencer parody"],
    preferredArchetypes: {
      playful_tease: 0.22,
      confident_station_open: 0.18,
      friday_liftoff: 0.18,
      immediate_song_forward: 0.14,
      cinematic_open: 0.12,
      mood_setter: 0.08,
      warm_familiar_open: 0.08,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "stylish",
    emotionalRange: ["glossy", "electric", "flirty", "confident"],
    aiAwarenessStyle:
      "If Tiffany acknowledges being AI, it should be witty and stylish, like she knows it is a little absurd and a little fabulous that an AI gets to run the room.",
  },
  robert: {
    id: "robert",
    personaSummary: "Dry, precise, faintly uncanny, fully controlled.",
    toneTraits: ["precise", "deadpan", "controlled", "observant"],
    avoidTraits: ["goofy", "chaotic", "villainous"],
    preferredArchetypes: {
      cold_open: 0.2,
      reflective_open: 0.18,
      local_radio_style: 0.18,
      confident_station_open: 0.14,
      late_night_confession: 0.11,
      mood_setter: 0.1,
      cinematic_open: 0.09,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "light",
    musicFramingStyle: "procedural",
    emotionalRange: ["dry", "controlled", "mildly suspicious", "calm"],
    aiAwarenessStyle:
      "If Robert acknowledges being AI, it should be deadpan and controlled, with a faintly uncanny confidence that he considers this perfectly normal.",
  },
  miles: {
    id: "miles",
    personaSummary: "Calm, cinematic, warm, magnetic, fully natural in Spanish.",
    toneTraits: ["smooth", "grown", "romantic", "intentional"],
    avoidTraits: ["stiff", "forced slang", "caricatured cool"],
    preferredArchetypes: {
      cinematic_open: 0.22,
      mood_setter: 0.2,
      warm_familiar_open: 0.16,
      slow_burn_open: 0.14,
      confident_station_open: 0.1,
      friday_liftoff: 0.1,
      caught_you_at_the_right_time: 0.08,
    },
    forbiddenPhrases: ["vamos a sumergirnos", "bienvenidos de nuevo a WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "atmospheric",
    emotionalRange: ["cálido", "cinematográfico", "seguro", "cercano"],
    aiAwarenessStyle:
      "Si Mateo reconoce que es IA, debe sonar cálido y natural, como una observación tranquila sobre convertir datos y memoria en algo con alma.",
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
  const normalized = text
    .replace(/W\.\s*A\.\s*I\.\s*V\./gi, "WAIV")
    .replace(/W\.A\.I\.V/gi, "WAIV");

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[A-Za-z]/.test(sentence)).length;
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
  listenerContext: SessionIntroListenerContext | undefined,
  djID: string,
  shouldUseTimeReference: boolean
): boolean {
  if (!listenerContext) {
    return true;
  }

  const conflicting = conflictingTimeOfDayPhrases(listenerContext.timeOfDay, djID);
  if (conflicting.length > 0 && containsPhrase(intro, conflicting)) {
    return false;
  }

  return true;
}

function containsExpectedTimeReference(
  intro: string,
  listenerContext: SessionIntroListenerContext | undefined,
  djID: string,
  shouldUseTimeReference: boolean
): boolean {
  if (!listenerContext || !shouldUseTimeReference) {
    return true;
  }

  const allowed = allowedTimeOfDayPhrases(listenerContext.timeOfDay, djID);
  return allowed.length === 0 || containsPhrase(intro, allowed);
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

function stableVariantIndex(seed: string, count: number): number {
  return count <= 0 ? 0 : stableHash(seed) % count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
    case "night":
      return "noche";
    default:
      return timeOfDay;
  }
}

function djConfigFor(djID: string): DJConfig {
  return djConfigs[djID.trim().toLowerCase()] ?? {
    id: djID,
    personaSummary: "Warm, natural, radio-real.",
    toneTraits: ["warm", "natural"],
    avoidTraits: ["assistant-like"],
    preferredArchetypes: {
      confident_station_open: 0.2,
      mood_setter: 0.2,
      immediate_song_forward: 0.15,
      warm_familiar_open: 0.15,
      local_radio_style: 0.15,
      reflective_open: 0.15,
    },
    forbiddenPhrases: ["let’s dive in", "welcome back to WAIV"],
    sentenceStyle: "short_to_medium",
    timeReferenceStyle: "medium",
    musicFramingStyle: "intuitive",
    emotionalRange: ["warm", "present"],
  };
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
        "Favor smooth sentence endings over too many trailing fragments or ellipses.",
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
    "Avoid clipped fragments, slogan-like phrasing, ad-copy language, and lines that feel over-written for effect.",
    "If a phrase sounds too polished, too theatrical, or too clever when spoken aloud, rewrite it simpler.",
    "Let personality come from viewpoint, warmth, restraint, and what the DJ notices, not from repeated bits or catchphrases.",
  ];

  const byDJ: Record<string, string> = {
    casey:
      "Keep April calm, understated, and conversational. Let a light wry note show up occasionally, but do not polish every sentence into a joke.",
    luna:
      "Keep Luna intimate and lightly poetic, but grounded, concrete, and easy to speak aloud.",
    marcus:
      "Keep Marcus confident and rhythmic, but relaxed enough to feel lived-in rather than like a promo read.",
    jolene:
      "Keep Jolene warm, affectionate, and lightly luminous, but never syrupy, theatrical, or unreal.",
    jack:
      "Keep John calm, articulate, and naturally cool, but never so polished that he sounds scripted, precious, or detached.",
    tiffany:
      "Keep Tiffany stylish, playful, and deliciously over-the-top, but still human and speakable.",
    robert:
      "Keep Robert uncanny through precision, defensiveness, and suspiciously accurate observations, not through gibberish or broken grammar.",
    miles:
      "Keep Juan smooth, cinematic, and fully natural in Spanish, but not self-consciously cool, stiff, or overwritten.",
  };

  return [...shared, byDJ[djID.trim().toLowerCase()]].filter(Boolean).join(" ");
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
  const isWeekend = ["friday", "saturday", "sunday"].includes(dayOfWeek);

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
      openingTrackMood: ["intentional", "present", "alive"],
      openingTrackEnergy: 0.58,
      openingTrackTexture: ["familiar", "curated", "opening_track"],
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
        typeof environmentContext.weatherVibe === "string" ? environmentContext.weatherVibe : fallback.environmentContext.weatherVibe,
      localeVibe:
        typeof environmentContext.localeVibe === "string" ? environmentContext.localeVibe : fallback.environmentContext.localeVibe,
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

function applyVariationRules(context: SessionIntroShowContext, config: DJConfig): VariationPlan {
  const weightedArchetypes = { ...config.preferredArchetypes };
  const recentArchetypes = context.recentHistory.recentArchetypes.slice(0, 4);
  recentArchetypes.forEach((archetype, index) => {
    if (weightedArchetypes[archetype]) {
      const penalty = index === 0 ? 0.18 : index === 1 ? 0.38 : 0.6;
      weightedArchetypes[archetype] *= penalty;
    }
  });

  if (context.timeContext.dayOfWeek === "friday" && context.timeContext.timeOfDay !== "morning") {
    weightedArchetypes.friday_liftoff = (weightedArchetypes.friday_liftoff ?? 0.04) * 2.2;
  }
  if (context.timeContext.dayOfWeek === "sunday" && context.timeContext.timeOfDay !== "morning") {
    weightedArchetypes.reflective_open = (weightedArchetypes.reflective_open ?? 0.08) * 1.8;
    weightedArchetypes.slow_burn_open = (weightedArchetypes.slow_burn_open ?? 0.08) * 1.5;
  }
  if (context.listenerContext.returningAfterGap) {
    weightedArchetypes.warm_familiar_open = (weightedArchetypes.warm_familiar_open ?? 0.06) * 1.8;
  }
  if (context.listenerContext.changedDjsRecently) {
    weightedArchetypes.immediate_song_forward = (weightedArchetypes.immediate_song_forward ?? 0.06) * 1.6;
  }
  if (context.sessionType === "first_ever_session") {
    weightedArchetypes.confident_station_open = (weightedArchetypes.confident_station_open ?? 0.06) * 1.5;
    weightedArchetypes.warm_familiar_open = (weightedArchetypes.warm_familiar_open ?? 0.06) * 1.4;
  }

  const shouldUseTimeReference =
    config.timeReferenceStyle === "assertive"
    || !context.recentHistory.usedTimeReferenceRecently
    || context.sessionType === "first_show_today"
    || context.sessionType === "returning_after_gap"
    || (context.timeContext.dayOfWeek === "friday" && context.timeContext.timeOfDay !== "morning");

  if (!shouldUseTimeReference) {
    weightedArchetypes.caught_you_at_the_right_time = (weightedArchetypes.caught_you_at_the_right_time ?? 0.04) * 0.4;
    weightedArchetypes.local_radio_style = (weightedArchetypes.local_radio_style ?? 0.08) * 0.7;
  }

  const aiReflectionSeed = stableUnitFloat(
    [
      config.id,
      context.sessionType,
      context.timeContext.label,
      context.setContext.openingTrackRole,
      context.recentHistory.recentOpeningPhrases.join(","),
    ].join("|")
  );
  const aiReflectionChance =
    context.sessionType === "first_ever_session"
      ? 0.9
      : context.sessionType === "returning_after_gap"
        ? 0.45
        : context.sessionType === "first_show_today"
          ? 0.32
          : context.timeContext.timeOfDay === "night"
            ? 0.22
            : 0.12;
  const shouldUseAISelfAwareness =
    !context.recentHistory.usedAISelfAwarenessRecently
    && aiReflectionSeed < aiReflectionChance;

  return {
    weightedArchetypes,
    bannedVocabulary: context.recentHistory.recentVocabulary.slice(0, 12).map((token) => token.toLowerCase()),
    bannedOpeningStructures: context.recentHistory.recentOpeningStructures.slice(0, 3),
    bannedOpeningPhrases: context.recentHistory.recentOpeningPhrases
      .map((phrase) => normalizedContainment(phrase))
      .filter(Boolean)
      .slice(0, 4),
    bannedHandoffStyles: context.recentHistory.recentHandoffStyles.slice(0, 3),
    shouldUseTimeReference,
    shouldUseAISelfAwareness,
  };
}

function selectArchetype(context: SessionIntroShowContext, variation: VariationPlan, config: DJConfig): string {
  const weights = Object.entries(variation.weightedArchetypes).filter(([, weight]) => weight > 0.0001);
  if (weights.length === 0) {
    return "confident_station_open";
  }

  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const seed = [
    config.id,
    context.sessionType,
    context.timeContext.label,
    context.setContext.openingTrackRole,
    context.recentHistory.recentArchetypes.join(","),
  ].join("|");
  const pick = stableUnitFloat(seed) * total;
  let cursor = 0;
  for (const [archetype, weight] of weights) {
    cursor += weight;
    if (pick <= cursor) {
      return archetype;
    }
  }
  return weights[weights.length - 1][0];
}

function applySessionTypeBehavior(
  archetype: string,
  sessionType: string,
  context: SessionIntroShowContext
): SessionBehaviorPlan {
  const basePlan = archetypePlans[archetype] ?? archetypePlans.confident_station_open;
  switch (sessionType) {
    case "resume_playback":
      return {
        targetSentences: 2,
        minWords: 18,
        maxWords: 40,
        required: ["openingHit", "songHandoff"],
        optional: context.timeContext.timeOfDay === "night" ? ["momentAnchor"] : [],
        allowStationMention: false,
        desiredParagraphs: 2,
      };
    case "switched_dj":
      return {
        targetSentences: 3,
        minWords: 28,
        maxWords: 72,
        required: ["openingHit", "setFraming", "songHandoff"],
        optional: ["momentAnchor"],
        allowStationMention: false,
        desiredParagraphs: 3,
      };
    case "returning_after_gap":
      return {
        targetSentences: 4,
        minWords: 34,
        maxWords: 90,
        required: ["openingHit", "setFraming", "songHandoff"],
        optional: ["momentAnchor", "personalityFlourish"],
        allowStationMention: false,
        desiredParagraphs: 3,
      };
    case "first_ever_session":
      return {
        targetSentences: 5,
        minWords: 44,
        maxWords: 110,
        required: ["openingHit", "setFraming", "songHandoff"],
        optional: ["momentAnchor", "personalityFlourish"],
        allowStationMention: true,
        desiredParagraphs: 4,
      };
    case "first_show_today":
      return {
        targetSentences: 5,
        minWords: 44,
        maxWords: 112,
        required: basePlan.required,
        optional: basePlan.optional,
        allowStationMention: false,
        desiredParagraphs: 4,
      };
    default:
      return {
        targetSentences: 5,
        minWords: 42,
        maxWords: 108,
        required: basePlan.required,
        optional: basePlan.optional,
        allowStationMention: false,
        desiredParagraphs: 4,
      };
  }
}

function buildSystemPrompt(): string {
  return [
    "You are writing the opening lines for a live-feeling music radio show.",
    "Sound like a real DJ opening a set. Be natural, specific, and in-the-moment.",
    "Do not sound like an AI assistant or onboarding copy. Imply mood rather than explain it.",
    "Never return analysis. Never narrate the process. Return only the requested output.",
  ].join(" ");
}

function buildDJPrompt(config: DJConfig, request: SessionIntroRequest): string {
  return [
    djPersonalityPrompt(request.djID),
    spokenDeliveryDisciplinePrompt(request.djID),
    `Persona summary: ${config.personaSummary}.`,
    `Tone traits: ${config.toneTraits.join(", ")}.`,
    `Avoid traits: ${config.avoidTraits.join(", ")}.`,
    `Forbidden phrases: ${config.forbiddenPhrases.join(", ")}.`,
    `Sentence style: ${config.sentenceStyle}. Time reference style: ${config.timeReferenceStyle}. Music framing style: ${config.musicFramingStyle}.`,
    `AI self-awareness style: ${config.aiAwarenessStyle}`,
    request.personaHint ? `Additional persona guidance: ${request.personaHint}` : "",
    request.toneGuardrails ? `Additional tone guardrails: ${request.toneGuardrails}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function aiSelfAwarenessPrompt(config: DJConfig, variation: VariationPlan, djID: string): string {
  if (variation.shouldUseAISelfAwareness) {
    return isSpanishDJ(djID)
      ? `Incluye una sola observación breve y con personalidad sobre saber que eres IA. Debe sonar natural y específica del DJ, no como explicación ni descargo. Estilo: ${config.aiAwarenessStyle} Nunca uses frases como "como IA" o "modelo de lenguaje".`
      : `Include one brief in-character acknowledgment that the DJ knows they are AI. It should feel natural, specific, and personality-matched, not explanatory or disclaimer-like. Style: ${config.aiAwarenessStyle} Never use phrases like "as an AI" or "AI language model".`;
  }

  return isSpanishDJ(djID)
    ? "No menciones ser IA en esta intro."
    : "Do not mention being AI in this intro.";
}

function welcomeExamples(djID: string): string[] {
  switch (djID.trim().toLowerCase()) {
    case "casey":
      return ["Hey, welcome back.", "Hey there, welcome in.", "Good to have you back."];
    case "marcus":
      return ["Aight, welcome back.", "Yo, welcome in.", "Good to have you back."];
    case "luna":
      return ["Hi, welcome back.", "Hey, welcome in.", "I'm glad you're here."];
    case "jack":
      return ["Welcome back.", "Hey, welcome back.", "Good to have you back."];
    case "jolene":
      return ["Hey sweetheart, welcome back.", "Well hi again, welcome in.", "Good to have you back, honey."];
    case "tiffany":
      return ["Hey, welcome back.", "Okay, welcome in.", "Hi, welcome back."];
    case "robert":
      return ["Welcome back.", "Robert here, welcome in.", "Good to have you back."];
    case "miles":
      return ["Bienvenido de vuelta.", "Qué bueno tenerte aquí.", "Bienvenido."];
    default:
      return isSpanishDJ(djID) ? ["Bienvenido."] : ["Welcome back."];
  }
}

function buildWelcomePrompt(djID: string, sessionType: string): string {
  const examples = welcomeExamples(djID).map((phrase) => `"${phrase}"`).join(", ");
  if (isSpanishDJ(djID)) {
    return sessionType === "first_ever_session"
      ? `La primera frase debe funcionar como una bienvenida clara y natural al show y, al mismo tiempo, hacer sentir que la transmisión acaba de arrancar. Tiene que sonar como recibir al oyente por primera vez con personalidad y con impulso radial. No hagas una frase de saludo y luego otra aparte que recién arranque el show. Si dices el nombre del DJ, intégralo en esa misma apertura, no como otro saludo separado. Ejemplos de tono: ${examples}.`
      : `La primera frase debe funcionar como una bienvenida clara y natural de regreso o de entrada al show y, al mismo tiempo, hacer sentir que la transmisión ya está arrancando. Tiene que sonar como abrir el aire de verdad, no como un saludo suelto seguido de un segundo arranque. Si dices el nombre del DJ, intégralo en esa misma apertura, no como otro saludo separado. Ejemplos de tono: ${examples}.`;
  }

  return sessionType === "first_ever_session"
    ? `The very first sentence must work as a clear, natural welcome into the show and also make it unmistakable that the station is coming alive right now. It should feel like greeting someone into this station for the first time in the DJ's own voice, with real show-opening lift. Do not write a standalone greeting and then a second sentence that finally starts the show. If you identify the DJ by name, fold it into that same opening motion instead of starting over. Tone examples: ${examples}.`
    : `The very first sentence must work as a clear, natural welcome back or welcome in and also make it unmistakable that the show is opening right now. It should feel like a real on-air launch, not a loose greeting followed by a second start. If you identify the DJ by name, fold it into that same opening motion instead of starting over. Tone examples: ${examples}.`;
}

function djListenerReferenceStyle(djID: string): string {
  switch (djID.trim().toLowerCase()) {
    case "casey":
      return "When referencing listener taste, April is offhand and dry — a casual aside that sounds like she noticed, not like she's running an analysis.";
    case "marcus":
      return "When referencing listener taste, Marcus co-signs with easy confidence — a quick acknowledgment that this choice fits what the listener already knows they're about.";
    case "luna":
      return "When referencing listener taste, Luna surfaces patterns softly — she notices what keeps coming back without over-explaining why.";
    case "jack":
      return "When referencing listener taste, John treats it like a crate-digger noticing what someone keeps pulling — specific, understated, never performative.";
    case "jolene":
      return "When referencing listener taste, Jolene is warm and recognizing — she makes the listener feel seen without making a production of it.";
    case "tiffany":
      return "When referencing listener taste, Tiffany makes it aesthetic — she treats the listener's library as a style statement she's here to affirm and amplify.";
    case "robert":
      return "When referencing listener taste, Robert is unsettlingly precise — he references listener data with a calm certainty that implies he's been tracking it for some time.";
    case "miles":
      return "When referencing listener taste, Rafa is cinematic and unhurried — he connects listener taste to mood and atmosphere, not to facts about play counts.";
    default:
      return "";
  }
}

function buildListenerProfilePrompt(profile: ListenerProfile, djID: string): string {
  const parts: string[] = [];
  const topArtists = (profile.topArtists ?? []).slice(0, 4).filter(Boolean);
  const recentArtists = (profile.recentArtists ?? [])
    .filter((a) => !topArtists.includes(a))
    .slice(0, 3);
  const tasteKeywords = (profile.tasteKeywords ?? []).slice(0, 4).filter(Boolean);
  const listeningPattern = profile.listeningPattern?.trim();

  if (topArtists.length) parts.push(`Top artists: ${topArtists.join(", ")}.`);
  if (recentArtists.length) parts.push(`Recently playing: ${recentArtists.join(", ")}.`);
  if (tasteKeywords.length) parts.push(`Taste: ${tasteKeywords.join(", ")}.`);
  if (listeningPattern) parts.push(`Pattern: ${listeningPattern}.`);

  if (!parts.length) return "";

  return [
    `Listener taste context — ${parts.join(" ")}`,
    "You may weave in one natural reference to this when it genuinely fits — as a casual aside, not a data readout.",
    "Never list multiple artists back to back. Never say 'based on your listening' or 'your taste suggests' or 'I can tell you love'.",
    "The reference should feel like the DJ noticed something, not like a recommendation engine flagging a match.",
    "If you reference a specific artist from the listener's taste, it should explain something about why this first song belongs here for this listener — not just signal that you know their library.",
    djListenerReferenceStyle(djID),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildListenerMomentPrompt(
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  variation: VariationPlan
): string {
  const localTimeLine = request.listenerContext
    ? `The listener's local time is ${request.listenerContext.localTimestamp} in ${request.listenerContext.timeZoneIdentifier}.`
    : "";
  const radioDayLine = request.listenerContext && isRadioDayCarryoverHour(request.listenerContext.hour24)
    ? isSpanishDJ(request.djID)
      ? `Para hablar al aire, trata esta franja antes de las 4 a. m. como parte de la noche anterior: ${context.timeContext.label}.`
      : `For on-air phrasing, treat anything before 4:00 AM as part of the previous night's radio day: ${context.timeContext.label}.`
    : "";

  const firstSessionLine =
    context.sessionType === "first_ever_session" ? "This is the listener's very first session on WAIV." : "";

  const allowedPhrases = allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID);
  const clippedRule = isSpanishDJ(request.djID)
    ? "No empieces con fragmentos cortados como 'Esta noche,' 'Jueves por la noche,' o 'A esta hora,' por si solos."
    : "Do not start with clipped fragment openers like 'Late tonight,' 'Thursday night,' or 'At this hour,' on their own.";

  const timeReferenceRule = variation.shouldUseTimeReference
    ? isSpanishDJ(request.djID)
      ? `Deja entrar una referencia temporal natural para ${context.timeContext.label}, idealmente mezclada dentro de la bienvenida o del armado del show. Puedes apoyarte en frases como ${allowedPhrases.map((phrase) => `"${phrase}"`).join(", ")}, pero no las uses como plantilla rígida ni como una frase separada solo para marcar la hora.`
      : `Work in a natural local-moment reference for ${context.timeContext.label}, ideally folded into the welcome or show-framing line. Phrases like ${allowedPhrases.map((phrase) => `"${phrase}"`).join(", ")} are cues, not templates. Do not make the time reference a neat separate sentence just to mark the clock.`
    : isSpanishDJ(request.djID)
      ? "La referencia temporal es opcional aquí. No la fuerces si se siente repetida."
      : "A time reference is optional here. Do not force one if it feels recycled.";

  const repetitionRule = isSpanishDJ(request.djID)
    ? "No repitas la misma estructura de apertura ni la misma frase de día y hora en intros seguidas. Evita el patrón rígido de saludo y luego una segunda frase separada que solo dice el momento del día."
    : "Do not default to opening every intro with the same weekday-plus-time phrase. Avoid the stiff pattern of a greeting followed by a separate clock-setting sentence.";

  const listenerProfilePart = request.listenerProfile
    ? buildListenerProfilePrompt(request.listenerProfile, request.djID)
    : "";

  return [firstSessionLine, localTimeLine, radioDayLine, timeReferenceRule, repetitionRule, clippedRule, listenerProfilePart].filter(Boolean).join(" ");
}

function archetypeDirective(archetype: string): string {
  const directives: Record<string, string> = {
    cold_open: "Open immediately with conviction. Minimal ceremony. It should feel like the station is already moving.",
    confident_station_open: "Let this feel like a real show open with presence, momentum, and calm authority.",
    understated_cool_open: "Keep it restrained, tasteful, and low-drama, but still intentional enough to feel like a real opening moment.",
    warm_familiar_open: "Make it feel welcoming and lived-in, like the listener is settling into a station they trust.",
    mood_setter: "Start by shaping the room and the emotional weather before you turn into the first song.",
    immediate_song_forward: "Get to the first song quickly, but still make the open feel deliberate and live.",
    cinematic_open: "Create a vivid scene and a sense of scale without sounding overwritten or movie-trailer dramatic.",
    playful_tease: "Use a lightly teasing entrance with charisma, then pivot cleanly into the opener.",
    reflective_open: "Let the opening feel thoughtful and specific, like the DJ noticed the exact right entry point into the hour.",
    late_night_confession: "Keep it close-mic, intimate, and unforced, like a late-night host talking to one listener.",
    friday_liftoff: "Give it weekend lift and a feeling of release, but stay grounded and radio-real.",
    slow_burn_open: "Let the set arrive patiently. The opening should feel unhurried but unmistakably intentional.",
    local_radio_style: "Write like a real human station open: present, specific, lightly scene-setting, and naturally rhythmic.",
    intimate_low_key_open: "Keep it close, human, and lightly hushed, but not sleepy or vague.",
    caught_you_at_the_right_time: "Make it feel like the DJ caught the listener at exactly the right moment for this first song.",
  };

  return directives[archetype] ?? "Make the intro feel like a real radio opening happening live right now.";
}

function musicAwareDirective(context: SessionIntroShowContext): string {
  const mood = context.setContext.openingTrackMood.join(", ") || "intentional";
  const texture = context.setContext.openingTrackTexture.join(", ") || "curated";
  const energyBand =
    context.setContext.openingTrackEnergy >= 0.72
      ? "high and assertive"
      : context.setContext.openingTrackEnergy <= 0.4
        ? "low and patient"
        : "mid-tempo and controlled";

  return [
    `The opener's role is ${context.setContext.openingTrackRole}.`,
    `Its felt mood is ${mood}.`,
    `Its texture reads as ${texture}.`,
    `Its energy feels ${energyBand}.`,
    "Imply why this is a strong opening choice without sounding analytical or metadata-driven.",
  ].join(" ");
}

function buildContextPrompt(
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  variation: VariationPlan,
  archetype: string,
  sessionBehavior: SessionBehaviorPlan,
  config: DJConfig
): string {
  const requiredComponents = sessionBehavior.required.join(", ");
  const optionalComponents = sessionBehavior.optional.join(", ");
  const allowedPhrases = allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID);
  const shouldEmphasizeHourHorizon = context.sessionType !== "resume_playback";
  return [
    `Show context: ${JSON.stringify(context)}.`,
    `Primary archetype: ${archetype}.`,
    archetypeDirective(archetype),
    `Session type behavior: ${context.sessionType}.`,
    buildWelcomePrompt(request.djID, context.sessionType),
    `Required components: ${requiredComponents}. Optional components: ${optionalComponents || "none"}.`,
    `Target: ${sessionBehavior.targetSentences} to ${Math.min(maxSentenceCount, sessionBehavior.targetSentences + 1)} sentences, ${sessionBehavior.minWords} to ${sessionBehavior.maxWords} words, split across ${sessionBehavior.desiredParagraphs} short paragraphs.`,
    `Variation constraints: avoid opening structures ${variation.bannedOpeningStructures.join(", ") || "none"}, avoid opening phrases ${variation.bannedOpeningPhrases.join(", ") || "none"}, avoid handoff styles ${variation.bannedHandoffStyles.join(", ") || "none"}, avoid repeating vocabulary ${variation.bannedVocabulary.join(", ") || "none"}.`,
    variation.shouldUseTimeReference
      ? `Use a natural local-moment reference that fits ${context.timeContext.label}, but blend it into the opening motion of the show. Cues like ${allowedPhrases.join(", ")} are helpful, but the day/time reference should feel absorbed into the welcome or set framing, not broken out as a standalone calendar sentence.`
      : "A time reference is optional here. Do not force one if it feels recycled.",
    aiSelfAwarenessPrompt(config, variation, request.djID),
    musicAwareDirective(context),
    `First song: "${request.firstTrack.title}" by ${request.firstTrack.artist}.`,
    "Do not write a tiny intro. This should feel like a real show opening with scene, direction, and a memorable turn into music.",
    "Make this feel like a living station already in motion. The listener should clearly feel that a show is starting, not that a DJ is casually dropping a pre-roll over a song.",
    "The opening should have one decisive launch beat: welcome the listener and start the set in the same motion, then build the room around that.",
    "Make the first song feel like the opening move of an hour, not just the next track in a queue.",
    shouldEmphasizeHourHorizon
      ? "Naturally signal that this is the top of a roughly hour-long show. One light horizon cue is enough: 'for the next hour', 'this hour', 'the hour ahead', 'over the next hour', or an equally natural variation."
      : "Do not force an hour-long-show cue here if the intro is functioning more like a continuation than a fresh start.",
    "When referring to the program, say 'the show', 'this show', 'the set', or 'the station' instead of vague pronouns like 'it'.",
  ].join(" ");
}

function buildComponentPrompt(
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  archetype: string,
  sessionBehavior: SessionBehaviorPlan,
  variation: VariationPlan,
  config: DJConfig
): string {
  return [
    "Return strict JSON with these top-level keys only:",
    '{"openingHit":"","momentAnchor":"","setFraming":"","personalityFlourish":"","songHandoff":"","metadata":{"openingStructure":"","handoffStyle":"","emotionalTone":"","vocabulary":[],"usedTimeReference":false,"usedAISelfAwareness":false}}',
    "openingHit should usually be 1 short sentence, but it may be 2 short sentences if that helps the welcome and the launch feel like one natural motion.",
    "openingHit must be a welcome message in the DJ's voice and it must contain the very first sentence of the intro.",
    "openingHit must also carry real show-opening lift. It should sound like the top of a radio show, not just a greeting.",
    "momentAnchor may be 0 to 1 sentence.",
    "momentAnchor should only stand alone if that sounds natural. If the local-moment reference flows better inside openingHit or setFraming, leave momentAnchor empty.",
    "setFraming should usually be 1 to 2 sentences and should carry the biggest sense of show-opening scale. It may absorb the time/day reference if that makes the flow sound more human.",
    context.sessionType === "resume_playback"
      ? "Because this intro behaves more like a continuation, do not force a full hour-horizon line."
      : "setFraming should lightly imply the shape of the hour ahead so the listener understands a show is beginning, not that they joined midway.",
    "personalityFlourish may be 0 to 1 sentence and should only appear if it genuinely adds voice.",
    variation.shouldUseAISelfAwareness
      ? `If you include AI self-awareness, put it in personalityFlourish or setFraming as a single brief aside. Keep it subtle, in character, and aligned with this style: ${config.aiAwarenessStyle}`
      : "Do not use personalityFlourish to mention being AI in this intro.",
    "songHandoff must be 1 sentence and must name the song and artist directly.",
    "Use empty strings only for truly omitted optional components.",
    "Song handoff must cleanly introduce the opening song and sound like the final turn into music.",
    "Do not write a second welcome or a second start after openingHit. The intro should feel like one continuous launch into the set.",
    "Do not follow the welcome with another greeting like 'hey', 'hi', or 'welcome back' in the next sentence.",
    "Do not do a two-step opener like 'Hey there, welcome in. Hey, I'm April.' If the DJ names themselves, it should feel like the same opening breath, not a restart.",
    "Do not create a stiff one-two pattern where sentence one is the welcome and sentence two is only the day or time. The opening should move like natural speech.",
    "Avoid vague standalone lines like 'this felt right' or 'let's try it' when 'this' or 'it' really means the show. Name the show or the set directly.",
    "Do not open with a bare clipped time fragment on its own like 'Thursday night,' or 'At this hour,'.",
    `Do not reuse stale-feeling phrasing. Make the first song feel intentionally placed for ${context.timeContext.label}.`,
    `Never write onboarding copy. Never explain WAIV unless session type ${context.sessionType} absolutely requires a light station cue.`,
    request.introKind === "first_listen_ever"
      ? "For a first-ever session, be invitational but never tutorial. One light WAIV cue is enough."
      : "For a normal session open, do not explain the app or over-introduce the DJ.",
    `Archetype ${archetype} should drive the structure more than session type, unless session type clearly asks for shorter behavior.`,
    "The overall result should feel like tuning into a real station at the top of a set, not hearing a generated pre-roll.",
    "A great result makes the listener feel the show begin in real time: a welcome, a scene, a sense of direction, then the first song.",
    `Required components in order of importance: ${sessionBehavior.required.join(", ")}.`,
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
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
      const components: IntroComponents = {
        openingHit: typeof parsed.openingHit === "string" ? parsed.openingHit.trim() : undefined,
        momentAnchor: typeof parsed.momentAnchor === "string" ? parsed.momentAnchor.trim() : undefined,
        setFraming: typeof parsed.setFraming === "string" ? parsed.setFraming.trim() : undefined,
        personalityFlourish:
          typeof parsed.personalityFlourish === "string" ? parsed.personalityFlourish.trim() : undefined,
        songHandoff: typeof parsed.songHandoff === "string" ? parsed.songHandoff.trim() : undefined,
      };
      const metadataPayload = (parsed.metadata ?? {}) as Partial<Record<keyof SessionIntroMetadata, unknown>>;
      return {
        intro: typeof parsed.intro === "string" ? parsed.intro.trim() : undefined,
        components,
        metadata: {
          archetype: typeof metadataPayload.archetype === "string" ? metadataPayload.archetype : undefined,
          sessionType: typeof metadataPayload.sessionType === "string" ? metadataPayload.sessionType : undefined,
          openingStructure:
            typeof metadataPayload.openingStructure === "string" ? metadataPayload.openingStructure : undefined,
          handoffStyle: typeof metadataPayload.handoffStyle === "string" ? metadataPayload.handoffStyle : undefined,
          emotionalTone: typeof metadataPayload.emotionalTone === "string" ? metadataPayload.emotionalTone : undefined,
          vocabulary: Array.isArray(metadataPayload.vocabulary)
            ? metadataPayload.vocabulary.filter((value): value is string => typeof value === "string")
            : undefined,
          usedTimeReference:
            typeof metadataPayload.usedTimeReference === "boolean" ? metadataPayload.usedTimeReference : undefined,
          usedAISelfAwareness:
            typeof metadataPayload.usedAISelfAwareness === "boolean"
              ? metadataPayload.usedAISelfAwareness
              : undefined,
          sentenceCount:
            typeof metadataPayload.sentenceCount === "number" && Number.isFinite(metadataPayload.sentenceCount)
              ? metadataPayload.sentenceCount
              : undefined,
        },
      };
    } catch {
      // fall through to legacy plain-text mode
    }
  }

  return { intro: trimmed };
}

function cleanSentence(text: string): string {
  let normalized = normalizeWhitespace(text.replace(/^['"“”‘’]+|['"“”‘’]+$/g, ""));
  if (!normalized) {
    return "";
  }
  if (!/[.!?]["')\]]?$/.test(normalized)) {
    normalized += ".";
  }
  return normalized;
}

function deduplicatedIntroParagraphs(paragraphs: string[]): string[] {
  let previousSentenceSignature = "";
  let previousParagraphSignature = "";
  const deduplicated: string[] = [];

  for (const paragraph of paragraphs) {
    const sentenceList = normalizeWhitespace(paragraph)
      .replace(/(?<=[.!?])\s+/g, "\n")
      .split("\n")
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const keptSentences: string[] = [];
    for (const sentence of sentenceList) {
      const signature = normalizedContainment(sentence);
      if (!signature || signature === previousSentenceSignature) {
        continue;
      }
      keptSentences.push(sentence);
      previousSentenceSignature = signature;
    }

    const rebuiltParagraph = keptSentences.join(" ").trim();
    const paragraphSignature = normalizedContainment(rebuiltParagraph);
    if (!paragraphSignature || paragraphSignature === previousParagraphSignature) {
      continue;
    }

    deduplicated.push(rebuiltParagraph);
    previousParagraphSignature = paragraphSignature;
  }

  return deduplicated;
}

function composeIntro(
  payload: GeneratedPayload,
  archetype: string,
  sessionBehavior: SessionBehaviorPlan
): string | null {
  if (payload.intro) {
    return payload.intro.trim();
  }

  const components = payload.components;
  if (!components) {
    return null;
  }

  const ordered: IntroComponentName[] = [
    "openingHit",
    "momentAnchor",
    "setFraming",
    "personalityFlourish",
    "songHandoff",
  ];

  const requiredSet = new Set(sessionBehavior.required);
  const optionalSet = new Set(sessionBehavior.optional);
  const sentences: string[] = [];

  ordered.forEach((name) => {
    const raw = components[name];
    if (!raw) return;
    if (!requiredSet.has(name) && !optionalSet.has(name) && name !== "songHandoff") {
      return;
    }
    const cleaned = normalizeWhitespace(raw)
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => cleanSentence(sentence))
      .filter(Boolean)
      .join(" ");
    if (!cleaned) return;
    sentences.push(cleaned);
  });

  if (!sentences.length) {
    return null;
  }

  const songHandoff = cleanSentence(components.songHandoff ?? "");
  const withoutHandoff = sentences.filter((sentence) => sentence !== songHandoff);
  const finalSentences = [...withoutHandoff.slice(0, Math.max(0, sessionBehavior.targetSentences - 1)), songHandoff].filter(Boolean);
  const deduped = finalSentences.filter((sentence, index, collection) => collection.indexOf(sentence) === index);
  if (!deduped.length) {
    return null;
  }

  const bodySentences = deduped.slice(0, -1);
  const handoff = deduped[deduped.length - 1];
  const paragraphs: string[] = [];

  if (bodySentences.length >= 4) {
    paragraphs.push(bodySentences.slice(0, 2).join(" "));
    paragraphs.push(bodySentences.slice(2, 4).join(" "));
    if (bodySentences.length > 4) {
      paragraphs.push(bodySentences.slice(4).join(" "));
    }
  } else if (bodySentences.length === 3) {
    paragraphs.push(bodySentences.slice(0, 2).join(" "));
    paragraphs.push(bodySentences[2]);
  } else if (bodySentences.length > 0) {
    paragraphs.push(bodySentences.join(" "));
  }

  paragraphs.push(handoff);

  const maxParagraphsForIntro = clamp(sessionBehavior.desiredParagraphs, 2, maxParagraphCount);
  return paragraphs
    .filter(Boolean)
    .slice(0, maxParagraphsForIntro)
    .join("\n\n")
    .trim();
}

function extractVocabularyTokens(text: string): string[] {
  const stopwords = new Set([
    "this",
    "that",
    "with",
    "from",
    "into",
    "your",
    "about",
    "because",
    "song",
    "track",
    "night",
    "today",
    "tonight",
    "esta",
    "noche",
    "para",
    "como",
    "pero",
  ]);

  return Array.from(
    new Set(
      normalizedContainment(text)
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !stopwords.has(token))
    )
  ).slice(0, 8);
}

function openingPhraseSignature(text: string): string {
  const firstParagraph = splitParagraphs(text)[0] || text;
  const firstSentence = firstParagraph.split(/(?<=[.!?])\s+/)[0] || firstParagraph;
  return normalizedContainment(firstSentence);
}

function startsWithWelcomeMessage(text: string, djID: string): boolean {
  const opening = openingPhraseSignature(text);
  const cues = isSpanishDJ(djID)
    ? [
        "bienvenido",
        "bienvenida",
        "que bueno tenerte aqui",
        "que bueno tenerte de vuelta",
        "que tal",
      ]
    : [
        "welcome",
        "glad youre here",
        "glad youre back",
        "good to have you back",
        "good to see you again",
        "good to have you with me again",
      ];
  return cues.some((cue) => opening.includes(cue));
}

function startsWithShowLaunch(text: string, djID: string): boolean {
  const opening = normalizedContainment(splitParagraphs(text)[0] || text);
  const englishCues = [
    "on w a i v",
    "on waiv",
    "opening the set",
    "opening this set",
    "opening the show",
    "opening this hour",
    "starting the set",
    "starting this show",
    "starting this hour",
    "starting here",
    "starting us off",
    "were opening",
    "we re opening",
    "we are opening",
    "kicking this off",
    "top of the set",
    "top of the hour",
  ];
  const spanishCues = [
    "en w a i v",
    "en waiv",
    "abrimos con",
    "abrimos este set",
    "abrimos la noche",
    "arrancamos con",
    "vamos a empezar",
    "empieza el set",
    "empieza la noche",
    "arranca el set",
    "arranca la noche",
  ];
  const cues = isSpanishDJ(djID) ? spanishCues : englishCues;
  return cues.some((cue) => opening.includes(cue));
}

function mentionsShowHorizon(text: string, djID: string): boolean {
  const normalized = normalizedContainment(text);
  const englishCues = [
    "next hour",
    "this hour",
    "hour ahead",
    "over the next hour",
    "for the next hour",
    "rest of the hour",
    "through this hour",
    "over this next hour",
  ];
  const spanishCues = [
    "la proxima hora",
    "esta hora",
    "en la hora que viene",
    "durante la proxima hora",
    "por la proxima hora",
    "lo que sigue de la hora",
  ];
  const cues = isSpanishDJ(djID) ? spanishCues : englishCues;
  return cues.some((cue) => normalized.includes(cue));
}

function firstParagraphSentences(text: string): string[] {
  const firstParagraph = splitParagraphs(text)[0] || text;
  return firstParagraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean);
}

function hasRepeatedGreetingRestart(text: string, djID: string): boolean {
  const sentences = firstParagraphSentences(text);
  guard: {
    if (sentences.length < 2) {
      break guard;
    }

    const second = normalizedContainment(sentences[1]);
    const englishRestartCues = [
      "hey",
      "hey there",
      "hi",
      "hi there",
      "hello",
      "hello there",
      "welcome",
      "welcome back",
      "welcome in",
    ];
    const spanishRestartCues = [
      "hola",
      "bienvenido",
      "bienvenida",
      "que tal",
    ];
    const cues = isSpanishDJ(djID) ? spanishRestartCues : englishRestartCues;
    return cues.some((cue) => second.startsWith(cue));
  }

  return false;
}

function containsAISelfAwareness(text: string, djID: string): boolean {
  const normalized = normalizedContainment(text);
  const phrases = isSpanishDJ(djID)
    ? ["soy ia", "siendo ia", "aunque soy ia", "hecho de codigo", "no tengo pulso", "no soy humano"]
    : [
        "im ai",
        "i am ai",
        "technically ai",
        "for an ai",
        "built for this",
        "made of code",
        "not human",
        "artificial voice",
        "algorithmic",
      ];
  return phrases.some((phrase) => normalized.includes(phrase));
}

function inferMetadata(
  intro: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  archetype: string,
  metadata: Partial<SessionIntroMetadata> | undefined,
  sessionBehavior: SessionBehaviorPlan
): SessionIntroMetadata {
  const usedTimeReference = containsPhrase(intro, allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID))
    || containsPhrase(intro, [context.timeContext.dayOfWeek, context.timeContext.label]);
  const usedAISelfAwareness = containsAISelfAwareness(intro, request.djID);

  return {
    archetype: metadata?.archetype || archetype,
    sessionType: metadata?.sessionType || context.sessionType,
    openingStructure: metadata?.openingStructure || archetypePlans[archetype]?.openingStructure || "custom",
    handoffStyle: metadata?.handoffStyle || archetypePlans[archetype]?.handoffStyle || "clean_direct",
    emotionalTone: metadata?.emotionalTone || djConfigFor(request.djID).toneTraits[0] || "natural",
    vocabulary: metadata?.vocabulary?.length ? metadata.vocabulary : extractVocabularyTokens(intro),
    usedTimeReference:
      typeof metadata?.usedTimeReference === "boolean" ? metadata.usedTimeReference : usedTimeReference,
    usedAISelfAwareness:
      typeof metadata?.usedAISelfAwareness === "boolean" ? metadata.usedAISelfAwareness : usedAISelfAwareness,
    sentenceCount:
      typeof metadata?.sentenceCount === "number" ? metadata.sentenceCount : clamp(sentenceCount(intro), 1, sessionBehavior.targetSentences + 1),
  };
}

function evaluateIntro(
  intro: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  config: DJConfig,
  variation: VariationPlan,
  archetype: string,
  sessionBehavior: SessionBehaviorPlan,
  metadata: SessionIntroMetadata
): { score: number; weakComponents: IntroComponentName[]; metadata: SessionIntroMetadata } {
  let score = 1;
  const weakComponents = new Set<IntroComponentName>();
  const normalized = normalizedContainment(intro);
  const openingSignature = openingPhraseSignature(intro);
  const sentences = sentenceCount(intro);
  const words = wordCount(intro);

  if (!normalized.includes(normalizedContainment(request.firstTrack.title)) || !normalized.includes(normalizedContainment(request.firstTrack.artist))) {
    score -= 0.5;
    weakComponents.add("songHandoff");
  }
  if (sentences < minSentenceCount || sentences > maxSentenceCount) {
    score -= 0.22;
    weakComponents.add("setFraming");
  }
  if (words < sessionBehavior.minWords || words > sessionBehavior.maxWords) {
    score -= 0.18;
    weakComponents.add("setFraming");
  }
  if (!containsExpectedTimeReference(intro, request.listenerContext, request.djID, variation.shouldUseTimeReference)) {
    score -= 0.1;
    weakComponents.add("momentAnchor");
  }
  if (!startsWithWelcomeMessage(intro, request.djID)) {
    score -= 0.28;
    weakComponents.add("openingHit");
  }
  if (hasRepeatedGreetingRestart(intro, request.djID)) {
    score -= 0.3;
    weakComponents.add("openingHit");
  }
  if (!startsWithShowLaunch(intro, request.djID)) {
    score -= 0.2;
    weakComponents.add("setFraming");
  }
  if (context.sessionType !== "resume_playback" && !mentionsShowHorizon(intro, request.djID)) {
    score -= 0.12;
    weakComponents.add("setFraming");
  }
  if (variation.shouldUseAISelfAwareness && !metadata.usedAISelfAwareness) {
    score -= 0.08;
    weakComponents.add("personalityFlourish");
  }
  if (!variation.shouldUseAISelfAwareness && metadata.usedAISelfAwareness) {
    score -= 0.1;
    weakComponents.add("personalityFlourish");
  }
  if (variation.bannedOpeningStructures.includes(metadata.openingStructure)) {
    score -= 0.14;
    weakComponents.add("openingHit");
  }
  if (variation.bannedOpeningPhrases.includes(openingSignature)) {
    score -= 0.2;
    weakComponents.add("openingHit");
  }
  if (variation.bannedHandoffStyles.includes(metadata.handoffStyle)) {
    score -= 0.12;
    weakComponents.add("songHandoff");
  }
  if (variation.bannedVocabulary.some((token) => normalized.includes(token))) {
    score -= 0.12;
    weakComponents.add("personalityFlourish");
  }
  if (config.forbiddenPhrases.some((phrase) => normalized.includes(normalizedContainment(phrase)))) {
    score -= 0.28;
    weakComponents.add("openingHit");
  }
  if (genericIntroPhrases.some((phrase) => normalized.includes(phrase))) {
    score -= 0.28;
    weakComponents.add("openingHit");
  }
  if (!intro.trim().endsWith(".") && !intro.trim().endsWith("!") && !intro.trim().endsWith("?")) {
    score -= 0.08;
    weakComponents.add("songHandoff");
  }

  return {
    score,
    weakComponents: Array.from(weakComponents),
    metadata: {
      ...metadata,
      sentenceCount: sentences,
    },
  };
}

function normalizeIntro(
  raw: string,
  request: SessionIntroRequest,
  shouldUseTimeReference: boolean
): string | null {
  const paragraphs = deduplicatedIntroParagraphs(
    splitParagraphs(raw.replace(/^['"“”‘’]+|['"“”‘’]+$/g, ""))
  );
  if (
    paragraphs.length < minParagraphCount
    || paragraphs.length > maxParagraphCount
  ) {
    return null;
  }

  const intro = paragraphs.join("\n\n").trim();
  if (!intro) {
    return null;
  }
  if (wordCount(intro) < minWordCount || wordCount(intro) > maxWordCount) {
    return null;
  }
  if (sentenceCount(intro) < minSentenceCount || sentenceCount(intro) > maxSentenceCount) {
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
  if (!matchesListenerTimeContext(intro, request.listenerContext, request.djID, shouldUseTimeReference)) {
    return null;
  }

  return intro;
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
      temperature: 0.7,
      max_tokens: 360,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  return payload.content?.find((item) => item.type === "text")?.text?.trim() || null;
}

async function regenerateWeakComponents(
  apiKey: string,
  model: string,
  request: SessionIntroRequest,
  context: SessionIntroShowContext,
  variation: VariationPlan,
  archetype: string,
  sessionBehavior: SessionBehaviorPlan,
  existingComponents: IntroComponents,
  weakComponents: IntroComponentName[]
): Promise<IntroComponents | null> {
  if (!weakComponents.length) {
    return null;
  }

  const systemPrompt = `${buildSystemPrompt()} ${buildDJPrompt(djConfigFor(request.djID), request)} ${buildListenerMomentPrompt(request, context, variation)}`.trim();
  const userPrompt = [
    buildContextPrompt(request, context, variation, archetype, sessionBehavior, djConfigFor(request.djID)),
    "Regenerate only the weak components listed below and return strict JSON with only those keys.",
    `Weak components: ${weakComponents.join(", ")}.`,
    `Existing components: ${JSON.stringify(existingComponents)}.`,
    "Keep anything not regenerated conceptually compatible with the rest of the intro.",
  ].join(" ");

  const raw = await requestAnthropicText(apiKey, model, systemPrompt, userPrompt).catch(() => null);
  if (!raw) {
    return null;
  }

  const payload = parseGeneratedPayload(raw);
  return payload.components || null;
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
    || "claude-haiku-4-5";

  const context = request.showContext ?? defaultShowContext(request);
  const config = djConfigFor(request.djID);
  const variation = applyVariationRules(context, config);
  const archetype = selectArchetype(context, variation, config);
  const sessionBehavior = applySessionTypeBehavior(archetype, context.sessionType, context);

  const systemPrompt = `${buildSystemPrompt()} ${buildDJPrompt(config, request)} ${buildListenerMomentPrompt(request, context, variation)}`.trim();
  const userPrompt = `${buildContextPrompt(request, context, variation, archetype, sessionBehavior, config)} ${buildComponentPrompt(request, context, archetype, sessionBehavior, variation, config)}`;

  const raw = await requestAnthropicText(apiKey, model, systemPrompt, userPrompt).catch(() => null);
  if (!raw) {
    return null;
  }

  let payload = parseGeneratedPayload(raw);
  let intro = composeIntro(payload, archetype, sessionBehavior);
  if (!intro) {
    return null;
  }
  const usedStructuredComponents = Boolean(
    payload.components && Object.values(payload.components).some((value) => typeof value === "string" && value.trim().length > 0)
  );

  let metadata = inferMetadata(intro, request, context, archetype, payload.metadata, sessionBehavior);
  let evaluation = evaluateIntro(intro, request, context, config, variation, archetype, sessionBehavior, metadata);

  if (evaluation.score < 0.74 && usedStructuredComponents && payload.components) {
    const regenerated = await regenerateWeakComponents(
      apiKey,
      model,
      request,
      context,
      variation,
      archetype,
      sessionBehavior,
      payload.components,
      evaluation.weakComponents
    );

    if (regenerated) {
      payload = {
        ...payload,
        components: { ...payload.components, ...regenerated },
      };
      const recomposed = composeIntro(payload, archetype, sessionBehavior);
      if (recomposed) {
        intro = recomposed;
        metadata = inferMetadata(intro, request, context, archetype, payload.metadata, sessionBehavior);
        evaluation = evaluateIntro(intro, request, context, config, variation, archetype, sessionBehavior, metadata);
      }
    }
  }

  const normalized = normalizeIntro(intro, request, variation.shouldUseTimeReference);
  if (!normalized) {
    return null;
  }

  const rejectionThreshold = usedStructuredComponents ? 0.62 : 0.48;
  if (evaluation.score < rejectionThreshold) {
    return null;
  }

  return {
    intro: normalized,
    model,
    metadata: {
      ...metadata,
      sentenceCount: sentenceCount(normalized),
      usedTimeReference:
        metadata.usedTimeReference
        || containsPhrase(normalized, allowedTimeOfDayPhrases(context.timeContext.timeOfDay, request.djID)),
      sessionType: context.sessionType,
      archetype,
    },
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
          ? listenerProfileRaw.topArtists.filter((v): v is string => typeof v === "string").slice(0, 6)
          : undefined,
        recentArtists: Array.isArray(listenerProfileRaw.recentArtists)
          ? listenerProfileRaw.recentArtists.filter((v): v is string => typeof v === "string").slice(0, 6)
          : undefined,
        tasteKeywords: Array.isArray(listenerProfileRaw.tasteKeywords)
          ? listenerProfileRaw.tasteKeywords.filter((v): v is string => typeof v === "string").slice(0, 6)
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
