export type NarrativeSource = "wikipediaRecording" | "songfacts" | "geniusAbout" | "allMusic";

export type NarrativeContent = {
  source: NarrativeSource;
  prose: string;
  confidence: number;
};

export type StructuredContext = {
  notableGuest: string | null;
  isACoverOf: string | null;
  samplesTrack: string | null;
};

export type StoryGenerateRequest = {
  isrc: string;
  title: string;
  artist: string;
  narratives?: NarrativeContent[];
  context?: Partial<StructuredContext> | null;
};

export type StoryGenerateResponse = {
  isrc: string;
  djLine: string;
  sourceAttribution: NarrativeSource;
  llmModel: string;
};

export type NoContentReason = "no_narrative" | "llm_rejected";

export type StoryGenerationResult =
  | {
      kind: "success";
      response: StoryGenerateResponse;
    }
  | {
      kind: "no_content";
      reason: NoContentReason;
      sourcesTried: string[];
    };

type WikipediaSection = {
  index?: string;
  line?: string;
};

type WikipediaSectionsResponse = {
  parse?: {
    title?: string;
    sections?: WikipediaSection[];
  };
};

type WikipediaWikitextResponse = {
  parse?: {
    wikitext?: {
      "*"?: string;
    };
  };
};

type MusicBrainzRelation = {
  type?: string;
  artist?: { name?: string };
  recording?: { title?: string };
  work?: { title?: string };
};

type MusicBrainzRecording = {
  score?: number | string;
  relations?: MusicBrainzRelation[];
};

type MusicBrainzLookupResponse = {
  recordings?: MusicBrainzRecording[];
};

type GeniusSearchResponse = {
  response?: {
    hits?: Array<{
      result?: {
        id?: number;
        primary_artist?: { name?: string };
      };
    }>;
  };
};

type GeniusSongResponse = {
  response?: {
    song?: {
      description?: {
        plain?: string;
      };
    };
  };
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

type LLMDecision =
  | { status: "ok"; line: string; source: NarrativeSource }
  | { status: "no_story" };

const WIKIPEDIA_SECTION_TITLES = new Set(
  [
    "recording",
    "recordings",
    "production",
    "background",
    "development",
    "composition",
    "writing",
    "history",
    "making of",
    "legacy",
  ].map((value) => value.toLowerCase())
);

const NARRATIVE_SOURCE_ORDER: NarrativeSource[] = ["wikipediaRecording", "songfacts", "geniusAbout", "allMusic"];
const MAX_DJ_WORDS = 45;
const MUSICBRAINZ_USER_AGENT = "WAIV/2.0 (song stories narrative pipeline)";
let lastMusicBrainzRequestAt = 0;

export function normalizeNarratives(input: unknown): NarrativeContent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const narratives: NarrativeContent[] = [];
  for (const raw of input) {
    const source = normalizeNarrativeSource((raw as NarrativeContent).source);
    const prose = typeof (raw as NarrativeContent).prose === "string" ? (raw as NarrativeContent).prose.trim() : "";
    const confidenceValue = Number((raw as NarrativeContent).confidence);
    const confidence = Number.isFinite(confidenceValue) ? clamp(confidenceValue, 0, 1) : 0.5;

    if (!source || prose.length < 40) {
      continue;
    }

    narratives.push({ source, prose, confidence });
  }

  return dedupeNarratives(narratives).sort((a, b) => b.confidence - a.confidence);
}

export function normalizeStructuredContext(input: unknown): StructuredContext {
  const context = (input ?? {}) as Partial<StructuredContext>;
  return {
    notableGuest: normalizeOptionalString(context.notableGuest),
    isACoverOf: normalizeOptionalString(context.isACoverOf),
    samplesTrack: normalizeOptionalString(context.samplesTrack),
  };
}

function normalizeNarrativeSource(input: unknown): NarrativeSource | null {
  if (typeof input !== "string") {
    return null;
  }
  switch (input) {
    case "wikipediaRecording":
    case "songfacts":
    case "geniusAbout":
    case "allMusic":
      return input;
    default:
      return null;
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dedupeNarratives(narratives: NarrativeContent[]): NarrativeContent[] {
  const seen = new Set<string>();
  const deduped: NarrativeContent[] = [];

  for (const narrative of narratives) {
    const key = `${narrative.source}|${narrative.prose.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(narrative);
  }

  return deduped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function stripWikitext(raw: string): string {
  if (!raw) {
    return "";
  }

  let text = raw;

  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  text = text.replace(/<ref[^>]*\/\s*>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");

  for (let i = 0; i < 8; i += 1) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, " ");
    if (next === text) {
      break;
    }
    text = next;
  }

  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, "$1");

  text = text.replace(/^=+\s*.*?\s*=+$/gm, " ");
  text = text.replace(/^\s*[#*;:]\s*/gm, " ");
  text = text.replace(/'{2,}/g, "");

  text = decodeHtmlEntities(text);
  return normalizeWhitespace(text);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function buildWikipediaPageCandidates(title: string, artist: string): string[] {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  const candidates = [
    cleanTitle,
    `${cleanTitle} (song)`,
    cleanArtist ? `${cleanTitle} (${cleanArtist} song)` : "",
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function wikipediaAPIURL(params: Record<string, string>): string {
  const search = new URLSearchParams({
    action: "parse",
    format: "json",
    ...params,
  });
  return `https://en.wikipedia.org/w/api.php?${search.toString()}`;
}

async function waitForMusicBrainzRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastMusicBrainzRequestAt;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastMusicBrainzRequestAt = Date.now();
}

async function fetchJSON<T>(url: string, init?: RequestInit, timeoutMs = 5000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWikipediaNarratives(title: string, artist: string): Promise<NarrativeContent[]> {
  const narratives: NarrativeContent[] = [];

  for (const page of buildWikipediaPageCandidates(title, artist)) {
    const sectionsData = await fetchJSON<WikipediaSectionsResponse>(
      wikipediaAPIURL({
        page,
        prop: "sections",
      })
    );

    const sections = sectionsData?.parse?.sections ?? [];
    if (sections.length === 0) {
      continue;
    }

    const targetSections = sections.filter((section) => {
      const sectionTitle = section.line?.trim().toLowerCase() ?? "";
      return Array.from(WIKIPEDIA_SECTION_TITLES).some((keyword) => sectionTitle.includes(keyword));
    });

    if (targetSections.length === 0) {
      continue;
    }

    for (const section of targetSections) {
      if (!section.index) {
        continue;
      }

      const sectionData = await fetchJSON<WikipediaWikitextResponse>(
        wikipediaAPIURL({
          page,
          prop: "wikitext",
          section: section.index,
        })
      );

      const raw = sectionData?.parse?.wikitext?.["*"] ?? "";
      const prose = stripWikitext(raw);
      if (prose.length < 80) {
        continue;
      }

      narratives.push({
        source: "wikipediaRecording",
        prose,
        confidence: 0.85,
      });
    }

    if (narratives.length > 0) {
      break;
    }
  }

  return dedupeNarratives(narratives).sort((a, b) => b.confidence - a.confidence);
}

export async function fetchSongfactsNarratives(_title: string, _artist: string): Promise<NarrativeContent[]> {
  // Intentionally disabled for now.
  // Songfacts has no official API and HTML structure can change unexpectedly.
  // We can enable this behind a feature flag once we have a stable parser and monitoring.
  return [];
}

export async function fetchAllMusicNarratives(_title: string, _artist: string): Promise<NarrativeContent[]> {
  // Optional source. Not enabled in v2 initial rollout.
  return [];
}

export async function fetchGeniusNarratives(title: string, artist: string): Promise<NarrativeContent[]> {
  const token = process.env.GENIUS_ACCESS_TOKEN?.trim();
  if (!token) {
    return [];
  }

  const searchURL = `https://api.genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`;
  const searchData = await fetchJSON<GeniusSearchResponse>(searchURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const hits = searchData?.response?.hits ?? [];
  if (hits.length === 0) {
    return [];
  }

  const normalizedArtist = artist.trim().toLowerCase();
  const bestHit =
    hits.find((hit) => {
      const candidate = hit.result?.primary_artist?.name?.toLowerCase() ?? "";
      return candidate.includes(normalizedArtist) || normalizedArtist.includes(candidate);
    }) ?? hits[0];

  const songID = bestHit.result?.id;
  if (!songID) {
    return [];
  }

  const songURL = `https://api.genius.com/songs/${songID}?text_format=plain`;
  const songData = await fetchJSON<GeniusSongResponse>(songURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const prose = normalizeWhitespace(songData?.response?.song?.description?.plain ?? "");
  if (prose.length < 80) {
    return [];
  }

  return [
    {
      source: "geniusAbout",
      prose,
      confidence: 0.7,
    },
  ];
}

export async function fetchMusicBrainzStructuredContext(
  isrc: string,
  title: string,
  artist: string
): Promise<StructuredContext> {
  const normalizedISRC = isrc.trim();
  const normalizedArtist = artist.trim().toLowerCase();

  let recordings: MusicBrainzRecording[] = [];
  const looksLikeRealISRC = /^[A-Z]{2}/.test(normalizedISRC);
  if (normalizedISRC.length >= 8 && looksLikeRealISRC) {
    await waitForMusicBrainzRateLimit();
    const byISRC = await fetchJSON<MusicBrainzLookupResponse>(
      `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(normalizedISRC)}?fmt=json&inc=recordings+relations+artist-credits+work-rels`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": MUSICBRAINZ_USER_AGENT,
        },
      }
    );
    recordings = byISRC?.recordings ?? [];
  }

  if (recordings.length === 0) {
    const query = `recording:"${title.replace(/"/g, '\\"')}" AND artist:"${artist.replace(/"/g, '\\"')}"`;
    await waitForMusicBrainzRateLimit();
    const byTitleArtist = await fetchJSON<MusicBrainzLookupResponse>(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5&inc=relations+artist-credits+work-rels`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": MUSICBRAINZ_USER_AGENT,
        },
      }
    );
    recordings = (byTitleArtist?.recordings ?? []).filter((recording) => Number(recording.score ?? 0) >= 65).slice(0, 3);
  }

  let notableGuest: string | null = null;
  let isACoverOf: string | null = null;
  let samplesTrack: string | null = null;

  for (const recording of recordings) {
    for (const relation of recording.relations ?? []) {
      const relationType = relation.type?.toLowerCase() ?? "";
      const relationArtist = normalizeOptionalString(relation.artist?.name) ?? null;
      const relationWork = normalizeOptionalString(relation.work?.title) ?? normalizeOptionalString(relation.recording?.title);

      if (!notableGuest && relationArtist && !relationArtist.toLowerCase().includes(normalizedArtist)) {
        if (relationType.includes("perform") || relationType.includes("instrument") || relationType.includes("guest")) {
          notableGuest = relationArtist;
        }
      }

      if (!isACoverOf && relationWork && relationType.includes("cover")) {
        isACoverOf = relationWork;
      }

      if (!samplesTrack && relationWork && relationType.includes("sample")) {
        samplesTrack = relationWork;
      }
    }
  }

  return {
    notableGuest,
    isACoverOf,
    samplesTrack,
  };
}

function renderNarrativeList(narratives: NarrativeContent[]): string {
  return narratives
    .map((narrative, index) => `${index + 1}. [${narrative.source}] (${narrative.confidence.toFixed(2)}) ${narrative.prose}`)
    .join("\n\n");
}

function renderOptionalContext(context: StructuredContext): string {
  const entries = [
    ["notableGuest", context.notableGuest],
    ["isACoverOf", context.isACoverOf],
    ["samplesTrack", context.samplesTrack],
  ].filter((entry) => Boolean(entry[1]));

  if (entries.length === 0) {
    return "None";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

function trimToWordCount(text: string, maxWords: number): string {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ").trim();
}

function isGenericLowQualityLine(line: string): boolean {
  const normalized = line.toLowerCase();
  const bannedPatterns = [
    "recorded live",
    "known for",
    "released in",
    "from the album",
    "distinctive sound",
  ];
  return bannedPatterns.some((pattern) => normalized.includes(pattern));
}

function normalizeLLMLine(line: string): string {
  const collapsed = normalizeWhitespace(line)
    .replace(/^['"“”‘’]+/, "")
    .replace(/['"“”‘’]+$/, "")
    .trim();
  return trimToWordCount(collapsed, MAX_DJ_WORDS);
}

async function generateDJLineWithAnthropic(
  title: string,
  artist: string,
  narratives: NarrativeContent[],
  context: StructuredContext
): Promise<{ outcome: LLMDecision; model: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";

  const systemPrompt = `You are a warm, knowledgeable radio DJ introducing a song. You are given editorial prose and optional context.

Your job: find one compelling human moment and retell it in 1-2 spoken sentences.

A valid moment must include at least two of:
- a named person
- a specific event/decision
- hesitation/conflict/surprise/personal significance
- something listener can hear in the song

STRICT RULES:
- If no narrative moment meets the bar, return: {"status":"no_story"}
- Never mention release year unless part of a richer fact
- Never list multiple facts
- Never say "recorded live" as standalone story
- Never invent details not present in provided prose
- Keep output under 45 words
- Use optional context only when that relationship is already present in prose
- Return valid JSON only in one of these forms:
  {"status":"ok","line":"...","source":"wikipediaRecording"}
  {"status":"no_story"}`;

  const userPrompt = `Track: "${title}" by ${artist}

Editorial prose (read all before deciding):
${renderNarrativeList(narratives)}

Optional context:
${renderOptionalContext(context)}

Write JSON only.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 220,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  const text = payload.content?.find((chunk) => chunk.type === "text")?.text?.trim();
  if (!text) {
    return { outcome: { status: "no_story" }, model };
  }

  const parsed = safeParseLLMDecision(text);
  if (!parsed) {
    return { outcome: { status: "no_story" }, model };
  }

  if (parsed.status === "no_story") {
    return { outcome: parsed, model };
  }

  const sourceValid = narratives.some((narrative) => narrative.source === parsed.source);
  const normalizedLine = normalizeLLMLine(parsed.line);
  if (!sourceValid || normalizedLine.length < 16 || isGenericLowQualityLine(normalizedLine)) {
    return { outcome: { status: "no_story" }, model };
  }

  return {
    outcome: {
      status: "ok",
      line: normalizedLine,
      source: parsed.source,
    },
    model,
  };
}

function safeParseLLMDecision(raw: string): LLMDecision | null {
  const normalized = raw.trim();
  if (normalized === "NO_STORY") {
    return { status: "no_story" };
  }

  const jsonCandidate = extractJSONObject(normalized);
  if (!jsonCandidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as { status?: string; line?: string; source?: string };
    if (parsed.status === "no_story") {
      return { status: "no_story" };
    }

    const source = normalizeNarrativeSource(parsed.source);
    const line = typeof parsed.line === "string" ? parsed.line : "";
    if (parsed.status === "ok" && source && line.trim().length > 0) {
      return {
        status: "ok",
        line,
        source,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function extractJSONObject(raw: string): string | null {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return raw.slice(first, last + 1);
}

export async function generateStoryV2(input: StoryGenerateRequest): Promise<StoryGenerationResult> {
  const isrc = input.isrc.trim();
  const title = input.title.trim();
  const artist = input.artist.trim();

  const explicitNarrativesProvided = Array.isArray(input.narratives);
  const providedNarratives = normalizeNarratives(input.narratives);
  const providedContext = normalizeStructuredContext(input.context);

  if (explicitNarrativesProvided && providedNarratives.length === 0) {
    return {
      kind: "no_content",
      reason: "no_narrative",
      sourcesTried: [],
    };
  }

  const [wikipediaNarratives, songfactsNarratives, geniusNarratives, allMusicNarratives, fetchedContext] =
    explicitNarrativesProvided
      ? [[], [], [], [], providedContext]
      : await Promise.all([
          fetchWikipediaNarratives(title, artist).catch(() => []),
          fetchSongfactsNarratives(title, artist).catch(() => []),
          fetchGeniusNarratives(title, artist).catch(() => []),
          fetchAllMusicNarratives(title, artist).catch(() => []),
          fetchMusicBrainzStructuredContext(isrc, title, artist).catch(() => ({
            notableGuest: null,
            isACoverOf: null,
            samplesTrack: null,
          })),
        ]);

  const collectedNarratives = dedupeNarratives(
    (explicitNarrativesProvided
      ? providedNarratives
      : [...wikipediaNarratives, ...songfactsNarratives, ...geniusNarratives, ...allMusicNarratives]
    ).filter((narrative) => narrative.prose.length >= 40)
  ).sort((a, b) => b.confidence - a.confidence);

  if (collectedNarratives.length === 0) {
    return {
      kind: "no_content",
      reason: "no_narrative",
      sourcesTried: NARRATIVE_SOURCE_ORDER,
    };
  }

  const llm = await generateDJLineWithAnthropic(title, artist, collectedNarratives, fetchedContext).catch(() => null);
  if (!llm || llm.outcome.status === "no_story") {
    return {
      kind: "no_content",
      reason: "llm_rejected",
      sourcesTried: Array.from(new Set(collectedNarratives.map((narrative) => narrative.source))),
    };
  }

  const response: StoryGenerateResponse = {
    isrc,
    djLine: llm.outcome.line,
    sourceAttribution: llm.outcome.source,
    llmModel: llm.model,
  };

  return {
    kind: "success",
    response,
  };
}
