import { NextRequest, NextResponse } from "next/server";

type FactType =
  | "sampledBy"
  | "samples"
  | "coverOf"
  | "awardWin"
  | "filmOrTVPlacement"
  | "chartMilestone"
  | "productionAnecdote"
  | "cultClassic";

type RawTrackFact = {
  type: FactType;
  body: string;
  source: string;
  confidence: number;
};

type StoryGenerateRequest = {
  isrc: string;
  title: string;
  artist: string;
  facts?: RawTrackFact[];
};

type StoryGenerateResponse = {
  isrc: string;
  djLine: string;
};

const SUPPORTED_FACT_TYPES = new Set<FactType>([
  "sampledBy",
  "samples",
  "coverOf",
  "awardWin",
  "filmOrTVPlacement",
  "chartMilestone",
  "productionAnecdote",
  "cultClassic",
]);

const MUSICBRAINZ_USER_AGENT = "WAIV/1.0 (story pipeline)";
let lastMusicBrainzRequestAt = 0;

function noContent(reason: "no_facts" | "llm_fallback"): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-WAIV-Story-Reason": reason,
    },
  });
}

function requireAppToken(request: NextRequest): NextResponse | null {
  const expectedAppToken = process.env.WAIV_API_APP_TOKEN?.trim();
  if (!expectedAppToken) {
    return NextResponse.json({ error: "Missing WAIV_API_APP_TOKEN." }, { status: 503 });
  }

  const providedAppToken = request.headers.get("x-waiv-app-token")?.trim();
  if (!providedAppToken || providedAppToken !== expectedAppToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

function normalizeFactType(value: unknown): FactType | null {
  if (typeof value !== "string") {
    return null;
  }
  return SUPPORTED_FACT_TYPES.has(value as FactType) ? (value as FactType) : null;
}

function normalizeFacts(facts: unknown): RawTrackFact[] {
  if (!Array.isArray(facts)) {
    return [];
  }

  const normalized: RawTrackFact[] = [];
  for (const fact of facts) {
    const type = normalizeFactType((fact as RawTrackFact).type);
    const body = typeof (fact as RawTrackFact).body === "string" ? (fact as RawTrackFact).body.trim() : "";
    const source =
      typeof (fact as RawTrackFact).source === "string" && (fact as RawTrackFact).source.trim().length > 0
        ? (fact as RawTrackFact).source.trim()
        : "unknown";
    const confidenceRaw = Number((fact as RawTrackFact).confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5;

    if (!type || body.length < 12) {
      continue;
    }

    normalized.push({
      type,
      body,
      source,
      confidence,
    });
  }

  return normalized;
}

function dedupeFacts(facts: RawTrackFact[]): RawTrackFact[] {
  const seen = new Set<string>();
  const deduped: RawTrackFact[] = [];

  for (const fact of facts) {
    const key = `${fact.type}|${fact.body.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(fact);
  }

  return deduped;
}

function isBoringFactBody(body: string): boolean {
  const normalized = body.toLowerCase();
  const boringSignals = [
    "released in",
    "release year",
    "from the album",
    "track length",
    "duration",
    "genre",
    "it is a song by",
  ];
  return boringSignals.some((signal) => normalized.includes(signal));
}

function interestingnessBoost(body: string): number {
  const normalized = body.toLowerCase();
  let boost = 0;
  const keywords = [
    "one take",
    "demo",
    "sample",
    "cover",
    "grammy",
    "award",
    "film",
    "soundtrack",
    "#1",
    "chart",
    "weeks",
    "recording session",
    "studio",
  ];
  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      boost += 0.08;
    }
  }
  return Math.min(boost, 0.4);
}

function chooseBestFact(facts: RawTrackFact[]): RawTrackFact | null {
  const viableFacts = facts.filter((fact) => !isBoringFactBody(fact.body));
  if (viableFacts.length === 0) {
    return null;
  }

  return viableFacts
    .map((fact) => ({
      fact,
      score: fact.confidence + interestingnessBoost(fact.body),
    }))
    .sort((a, b) => b.score - a.score)[0]?.fact ?? null;
}

function trimToWordCount(input: string, maxWords: number): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ").trim();
}

function heuristicDJLine(fact: RawTrackFact): string | null {
  if (fact.body.trim().length < 12) {
    return null;
  }

  let line = fact.body.trim();
  line = line.replace(/\s+/g, " ");
  if (!/[.!?]$/.test(line)) {
    line += ".";
  }

  // Keep stories concise enough for spoken pre-roll.
  return trimToWordCount(line, 30);
}

type MusicBrainzRecording = {
  score?: number | string;
  disambiguation?: string;
  relations?: Array<{
    type?: string;
    artist?: { name?: string };
    recording?: { title?: string };
    work?: { title?: string };
  }>;
};

async function waitForMusicBrainzRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastMusicBrainzRequestAt;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastMusicBrainzRequestAt = Date.now();
}

async function fetchMusicBrainzRecordings(endpoint: string): Promise<MusicBrainzRecording[]> {
  await waitForMusicBrainzRateLimit();
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": MUSICBRAINZ_USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { recordings?: MusicBrainzRecording[] };
  return data.recordings ?? [];
}

function musicBrainzFactsFromRecordings(recordings: MusicBrainzRecording[]): RawTrackFact[] {
  const facts: RawTrackFact[] = [];

  for (const recording of recordings) {
    const disambiguation = recording.disambiguation?.trim();
    if (disambiguation && disambiguation.length >= 8) {
      facts.push({
        type: "productionAnecdote",
        body: `MusicBrainz notes this recording as: ${disambiguation}.`,
        source: "musicbrainz",
        confidence: 0.75,
      });
    }

    for (const relation of recording.relations ?? []) {
      const relationType = relation.type?.toLowerCase() ?? "";
      const target = relation.recording?.title ?? relation.work?.title ?? relation.artist?.name;
      if (!target) {
        continue;
      }

      if (relationType.includes("cover")) {
        facts.push({
          type: "coverOf",
          body: `This one is linked to a cover relationship with "${target}".`,
          source: "musicbrainz",
          confidence: 0.9,
        });
        continue;
      }

      if (relationType.includes("sample")) {
        facts.push({
          type: relationType.includes("from") ? "samples" : "sampledBy",
          body: `It has a documented sampling link with "${target}".`,
          source: "musicbrainz",
          confidence: 0.9,
        });
        continue;
      }

      if (relationType.includes("producer") || relationType.includes("mix") || relationType.includes("remix")) {
        facts.push({
          type: "productionAnecdote",
          body: `MusicBrainz credits "${target}" in a ${relationType || "production"} role on this recording.`,
          source: "musicbrainz",
          confidence: 0.78,
        });
      }
    }
  }

  return dedupeFacts(facts);
}

async function fetchMusicBrainzFacts(isrc: string, title: string, artist: string): Promise<RawTrackFact[]> {
  const normalizedISRC = isrc.trim();
  const normalizedTitle = title.trim();
  const normalizedArtist = artist.trim();

  let recordings: MusicBrainzRecording[] = [];
  if (normalizedISRC.length >= 8) {
    const byISRC = `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(
      normalizedISRC
    )}?fmt=json&inc=recordings+artist-credits+relations+work-rels`;
    recordings = await fetchMusicBrainzRecordings(byISRC);
  }

  if (recordings.length === 0 && normalizedTitle && normalizedArtist) {
    const query = `recording:"${normalizedTitle.replace(/"/g, '\\"')}" AND artist:"${normalizedArtist.replace(/"/g, '\\"')}"`;
    const byTitleArtist = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=5&inc=artist-credits+relations+work-rels`;
    const searched = await fetchMusicBrainzRecordings(byTitleArtist);
    recordings = searched.filter((item) => Number(item.score ?? 0) >= 65).slice(0, 3);
  }

  if (recordings.length === 0) {
    return [];
  }
  return musicBrainzFactsFromRecordings(recordings);
}

async function fetchWikidataFacts(title: string, artist: string): Promise<RawTrackFact[]> {
  const normalizedTitle = title.trim();
  const normalizedArtist = artist.trim();
  if (!normalizedTitle || !normalizedArtist) {
    return [];
  }

  const escapedTitle = normalizedTitle.replace(/"/g, '\\"');
  const escapedArtist = normalizedArtist.replace(/"/g, '\\"');
  const query = `
    SELECT ?awardLabel ?chartLabel ?placementLabel WHERE {
      ?song wdt:P31/wdt:P279* wd:Q7366;
            wdt:P175 ?performer.
      ?song rdfs:label ?songLabel.
      ?performer rdfs:label ?artistLabel.
      FILTER(LANG(?songLabel) = "en")
      FILTER(LANG(?artistLabel) = "en")
      FILTER(CONTAINS(LCASE(?songLabel), LCASE("${escapedTitle}")))
      FILTER(CONTAINS(LCASE(?artistLabel), LCASE("${escapedArtist}")))
      OPTIONAL { ?song wdt:P166 ?award. }
      OPTIONAL { ?song wdt:P1352 ?chart. }
      OPTIONAL { ?song wdt:P1441 ?placement. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 10
  `;

  const response = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/sparql-query",
      "User-Agent": MUSICBRAINZ_USER_AGENT,
    },
    body: query,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: {
      bindings?: Array<{
        awardLabel?: { value?: string };
        chartLabel?: { value?: string };
        placementLabel?: { value?: string };
      }>;
    };
  };

  const facts: RawTrackFact[] = [];
  for (const binding of data.results?.bindings ?? []) {
    const award = binding.awardLabel?.value?.trim();
    if (award) {
      facts.push({
        type: "awardWin",
        body: `Wikidata links this track to the award "${award}".`,
        source: "wikidata",
        confidence: 0.8,
      });
    }

    const chart = binding.chartLabel?.value?.trim();
    if (chart) {
      facts.push({
        type: "chartMilestone",
        body: `It has a documented chart milestone in ${chart}.`,
        source: "wikidata",
        confidence: 0.75,
      });
    }

    const placement = binding.placementLabel?.value?.trim();
    if (placement) {
      facts.push({
        type: "filmOrTVPlacement",
        body: `Wikidata connects this track to ${placement}.`,
        source: "wikidata",
        confidence: 0.72,
      });
    }
  }

  return dedupeFacts(facts);
}

function extractInterestingSentence(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 20) {
    return null;
  }

  const sentences = cleaned.split(/(?<=[.?!])\s+/);
  const preferred = sentences.find((sentence) => {
    const normalized = sentence.toLowerCase();
    return (
      normalized.includes("demo") ||
      normalized.includes("recorded") ||
      normalized.includes("producer") ||
      normalized.includes("sample") ||
      normalized.includes("wrote")
    );
  });

  return preferred?.trim() ?? sentences[0]?.trim() ?? null;
}

async function fetchGeniusFacts(title: string, artist: string): Promise<RawTrackFact[]> {
  const geniusToken = process.env.GENIUS_ACCESS_TOKEN?.trim();
  if (!geniusToken) {
    return [];
  }

  const searchResponse = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    {
      headers: {
        Authorization: `Bearer ${geniusToken}`,
      },
      cache: "no-store",
    }
  );

  if (!searchResponse.ok) {
    return [];
  }

  const searchData = (await searchResponse.json()) as {
    response?: {
      hits?: Array<{
        result?: {
          id?: number;
          primary_artist?: { name?: string };
        };
      }>;
    };
  };

  const matchingHit = (searchData.response?.hits ?? []).find((hit) => {
    const candidate = hit.result?.primary_artist?.name?.toLowerCase() ?? "";
    return candidate.includes(artist.toLowerCase());
  });

  const songID = matchingHit?.result?.id;
  if (!songID) {
    return [];
  }

  const songResponse = await fetch(`https://api.genius.com/songs/${songID}`, {
    headers: {
      Authorization: `Bearer ${geniusToken}`,
    },
    cache: "no-store",
  });
  if (!songResponse.ok) {
    return [];
  }

  const songData = (await songResponse.json()) as {
    response?: {
      song?: {
        description?: {
          plain?: string;
        };
      };
    };
  };

  const sentence = extractInterestingSentence(songData.response?.song?.description?.plain ?? "");
  if (!sentence) {
    return [];
  }

  return [
    {
      type: "productionAnecdote",
      body: sentence,
      source: "genius",
      confidence: 0.65,
    },
  ];
}

async function fetchFactsFromSources(input: StoryGenerateRequest): Promise<RawTrackFact[]> {
  const [musicBrainzFacts, wikidataFacts, geniusFacts] = await Promise.all([
    fetchMusicBrainzFacts(input.isrc, input.title, input.artist).catch(() => []),
    fetchWikidataFacts(input.title, input.artist).catch(() => []),
    fetchGeniusFacts(input.title, input.artist).catch(() => []),
  ]);

  return dedupeFacts([...musicBrainzFacts, ...wikidataFacts, ...geniusFacts]).sort(
    (a, b) => b.confidence - a.confidence
  );
}

async function generateWithAnthropic(
  track: { title: string; artist: string },
  facts: RawTrackFact[]
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
  const factList = facts
    .slice(0, 8)
    .map((fact, index) => `${index + 1}. [${fact.type}] (${fact.confidence.toFixed(2)}) ${fact.body}`)
    .join("\n");

  const systemPrompt = `You are a knowledgeable radio DJ introducing a song. You have been given a list of facts about the track. Your job is to pick the single most surprising or compelling fact and rewrite it as 1-2 spoken sentences in a natural, conversational tone.

Rules:
- Never mention the release year unless it is part of a more interesting fact
- Never list multiple facts; choose one
- Never sound like a Wikipedia summary
- Keep it under 30 words
- If none are interesting enough, return exactly: NO_STORY`;

  const userPrompt = `Track: ${track.title} by ${track.artist}

Facts (ranked by confidence):
${factList}

Write the DJ line, or return NO_STORY.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 120,
      temperature: 0.35,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`anthropic_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = payload.content?.find((item) => item.type === "text")?.text?.trim();
  if (!text) {
    return null;
  }
  if (text === "NO_STORY") {
    return "NO_STORY";
  }

  const collapsed = text.replace(/\s+/g, " ").trim();
  const strippedOuterQuotes = collapsed
    .replace(/^["'“”‘’]+/, "")
    .replace(/["'“”‘’]+$/, "")
    .trim();
  return trimToWordCount(strippedOuterQuotes, 30);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tokenFailure = requireAppToken(request);
  if (tokenFailure) {
    return tokenFailure;
  }

  let input: StoryGenerateRequest;
  try {
    input = (await request.json()) as StoryGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const isrc = typeof input?.isrc === "string" ? input.isrc.trim() : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const artist = typeof input?.artist === "string" ? input.artist.trim() : "";
  if (!isrc || !title || !artist) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const providedFacts = normalizeFacts(input.facts);
  const fetchedFacts = providedFacts.length > 0 ? [] : await fetchFactsFromSources({ isrc, title, artist });
  const facts = dedupeFacts([...providedFacts, ...fetchedFacts]).sort((a, b) => b.confidence - a.confidence);

  const bestFact = chooseBestFact(facts);
  if (!bestFact) {
    return noContent("no_facts");
  }

  const llmResult = await generateWithAnthropic({ title, artist }, [bestFact]).catch(() => null);
  if (llmResult === "NO_STORY") {
    return noContent("llm_fallback");
  }

  const djLine = llmResult ?? heuristicDJLine(bestFact);
  if (!djLine) {
    return noContent("llm_fallback");
  }

  const responseBody: StoryGenerateResponse = {
    isrc,
    djLine: trimToWordCount(djLine, 30),
  };
  return NextResponse.json(responseBody, { status: 200 });
}
