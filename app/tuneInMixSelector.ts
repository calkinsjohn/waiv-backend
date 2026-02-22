import { buildCanonicalTrackKey } from "./trackIdentity";

export type TuneInTrackSource = "library" | "suggestion";

export type TuneInSelectorTrack = {
  id: string;
  title: string;
  artistName: string;
  source: TuneInTrackSource;
  genreTag?: string | null;
  albumId?: string | null;
  albumTitle?: string | null;
};

export type TuneInHistoryEntry = {
  trackKey: string;
  trackId?: string | null;
  artistKey?: string | null;
  genreKey?: string | null;
  playedAt: string;
};

export type TuneInDiversityConfig = {
  trackCooldownRecentCount: number;
  trackCooldownDays: number;
  artistRollingWindow: number;
  artistMaxPerRollingWindow: number;
  artistSessionCap: number;
  genreRollingWindow: number;
  minDistinctGenresPerGenreWindow: number;
  suggestionTargetShare: number;
};

export type TuneInSelectionTier = "tier1" | "tier2" | "tier3";

export type TuneInSelectionStats = {
  candidateCount: number;
  selectedCount: number;
  blockedByTrackCooldown: number;
  tierSelections: Record<TuneInSelectionTier, number>;
};

export type TuneInSelectionResult = {
  tracks: TuneInSelectorTrack[];
  stats: TuneInSelectionStats;
};

export const DEFAULT_TUNE_IN_DIVERSITY_CONFIG: TuneInDiversityConfig = {
  trackCooldownRecentCount: 50,
  trackCooldownDays: 7,
  artistRollingWindow: 10,
  artistMaxPerRollingWindow: 1,
  artistSessionCap: 4,
  genreRollingWindow: 10,
  minDistinctGenresPerGenreWindow: 3,
  suggestionTargetShare: 0.32,
};

const CLUSTER_BUCKETS = 9;

type PreparedCandidate = TuneInSelectorTrack & {
  trackKey: string;
  artistKey: string;
  genreKey: string;
  hasMetadataGenre: boolean;
};

type SelectorTierConfig = {
  tier: TuneInSelectionTier;
  genreDistinctFloor: number;
  artistSessionCapBump: number;
};

const TIERS: SelectorTierConfig[] = [
  {
    tier: "tier1",
    genreDistinctFloor: 3,
    artistSessionCapBump: 0,
  },
  {
    tier: "tier2",
    genreDistinctFloor: 2,
    artistSessionCapBump: 1,
  },
  {
    tier: "tier3",
    genreDistinctFloor: 1,
    artistSessionCapBump: 2,
  },
];

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTuneInTrackKey(input: { title: string; artistName: string }): string {
  return buildCanonicalTrackKey({
    title: input.title,
    artistName: input.artistName,
  });
}

export function buildTuneInArtistKey(artistName: string): string {
  return normalizeToken(artistName);
}

function hashStringToUint32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeGenreTag(value: string): string {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return "";
  }

  if (normalized.endsWith(" music")) {
    return normalized.replace(/\s+music$/u, "").trim() || normalized;
  }
  return normalized;
}

function buildGenreKey(track: TuneInSelectorTrack): { genreKey: string; hasMetadataGenre: boolean } {
  const metadataGenre =
    typeof track.genreTag === "string" && track.genreTag.trim().length > 0
      ? normalizeGenreTag(track.genreTag)
      : "";

  if (metadataGenre) {
    return {
      genreKey: `genre:${metadataGenre}`,
      hasMetadataGenre: true,
    };
  }

  const artistKey = buildTuneInArtistKey(track.artistName);
  const clusterId = hashStringToUint32(artistKey || `${track.title}::${track.artistName}`) % CLUSTER_BUCKETS;
  return {
    genreKey: `cluster:${clusterId}`,
    hasMetadataGenre: false,
  };
}

function rollingCount<T>(items: T[], window: number, predicate: (item: T) => boolean): number {
  const size = Math.max(1, window);
  let count = 0;
  for (let i = items.length - 1; i >= 0 && items.length - i <= size; i -= 1) {
    if (predicate(items[i])) {
      count += 1;
    }
  }
  return count;
}

function buildBlockedTrackSets(
  historyEntries: TuneInHistoryEntry[],
  config: TuneInDiversityConfig
): { blockedTrackKeys: Set<string>; blockedTrackIds: Set<string> } {
  const blockedTrackKeys = new Set<string>();
  const blockedTrackIds = new Set<string>();
  const recentEntries = historyEntries.slice(-Math.max(1, config.trackCooldownRecentCount));
  const dayCutoffMs = Date.now() - Math.max(1, config.trackCooldownDays) * 24 * 60 * 60 * 1000;

  for (const entry of recentEntries) {
    if (entry.trackKey) {
      blockedTrackKeys.add(entry.trackKey);
    }
    if (entry.trackId) {
      blockedTrackIds.add(entry.trackId);
    }
  }

  for (const entry of historyEntries) {
    const playedAtMs = new Date(entry.playedAt).getTime();
    if (Number.isFinite(playedAtMs) && playedAtMs >= dayCutoffMs) {
      if (entry.trackKey) {
        blockedTrackKeys.add(entry.trackKey);
      }
      if (entry.trackId) {
        blockedTrackIds.add(entry.trackId);
      }
    }
  }

  return {
    blockedTrackKeys,
    blockedTrackIds,
  };
}

function prepareCandidates(
  tracks: TuneInSelectorTrack[],
  blockedTrackKeys: Set<string>,
  blockedTrackIds: Set<string>
): {
  candidates: PreparedCandidate[];
  blockedByTrackCooldown: number;
} {
  const deduped: PreparedCandidate[] = [];
  const seenTrackKeys = new Set<string>();
  const seenIds = new Set<string>();
  let blockedByTrackCooldown = 0;

  for (const track of tracks) {
    const title = track.title?.trim();
    const artistName = track.artistName?.trim();
    const id = track.id?.trim();
    if (!title || !artistName || !id) {
      continue;
    }

    const trackKey = buildTuneInTrackKey({ title, artistName });
    const artistKey = buildTuneInArtistKey(artistName);
    if (!trackKey || !artistKey) {
      continue;
    }

    if (
      blockedTrackKeys.has(trackKey) ||
      blockedTrackIds.has(id)
    ) {
      blockedByTrackCooldown += 1;
      continue;
    }

    if (seenTrackKeys.has(trackKey) || seenIds.has(id)) {
      continue;
    }

    const genre = buildGenreKey(track);
    deduped.push({
      ...track,
      title,
      artistName,
      id,
      trackKey,
      artistKey,
      genreKey: genre.genreKey,
      hasMetadataGenre: genre.hasMetadataGenre,
    });
    seenTrackKeys.add(trackKey);
    seenIds.add(id);
  }

  return {
    candidates: deduped,
    blockedByTrackCooldown,
  };
}

function computeEffectiveGenreFloor(
  candidates: PreparedCandidate[],
  config: TuneInDiversityConfig,
  tier: SelectorTierConfig
): number {
  const availableGenres = new Set(candidates.map((candidate) => candidate.genreKey)).size;
  const baseFloor = Math.max(1, Math.min(config.minDistinctGenresPerGenreWindow, availableGenres));
  return Math.max(1, Math.min(baseFloor, tier.genreDistinctFloor));
}

function violatesGenreWindow(
  selected: PreparedCandidate[],
  candidate: PreparedCandidate,
  config: TuneInDiversityConfig,
  minDistinctGenres: number
): boolean {
  const window = Math.max(3, config.genreRollingWindow);
  const lookback = window - 1;
  if (selected.length < lookback) {
    return false;
  }

  const lastGenres = selected.slice(-lookback).map((item) => item.genreKey);
  const distinctCount = new Set([...lastGenres, candidate.genreKey]).size;
  return distinctCount < Math.max(1, minDistinctGenres);
}

function computeCandidateScore(input: {
  candidate: PreparedCandidate;
  selected: PreparedCandidate[];
  artistSessionCounts: Map<string, number>;
  suggestionCount: number;
  config: TuneInDiversityConfig;
  tier: SelectorTierConfig;
  rng: () => number;
}): number {
  const { candidate, selected, artistSessionCounts, suggestionCount, config, tier, rng } = input;

  const artistCount = artistSessionCounts.get(candidate.artistKey) ?? 0;
  const recentArtistHits = rollingCount(
    selected,
    Math.max(4, config.artistRollingWindow),
    (item) => item.artistKey === candidate.artistKey
  );
  const recentGenreHits = rollingCount(
    selected,
    Math.max(4, config.genreRollingWindow),
    (item) => item.genreKey === candidate.genreKey
  );

  const selectedCount = selected.length;
  const currentSuggestionShare = selectedCount > 0 ? suggestionCount / selectedCount : 0;
  const sourcePenalty =
    candidate.source === "suggestion"
      ? currentSuggestionShare > config.suggestionTargetShare + 0.14
        ? 5.6
        : 0
      : currentSuggestionShare < config.suggestionTargetShare - 0.14
        ? 3.8
        : 0;

  const tierBonus = tier.tier === "tier3" && candidate.source === "suggestion" ? -0.5 : 0;

  return (
    artistCount * 7 +
    recentArtistHits * 8 +
    recentGenreHits * 2.6 +
    sourcePenalty +
    tierBonus +
    rng() * 0.45
  );
}

function pickCandidateIndex(input: {
  candidates: PreparedCandidate[];
  selected: PreparedCandidate[];
  selectedTrackKeys: Set<string>;
  selectedTrackIds: Set<string>;
  artistSessionCounts: Map<string, number>;
  suggestionCount: number;
  config: TuneInDiversityConfig;
  tier: SelectorTierConfig;
  rng: () => number;
}): number {
  const {
    candidates,
    selected,
    selectedTrackKeys,
    selectedTrackIds,
    artistSessionCounts,
    suggestionCount,
    config,
    tier,
    rng,
  } = input;

  const minDistinctGenres = computeEffectiveGenreFloor(candidates, config, tier);
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];

    if (selectedTrackKeys.has(candidate.trackKey) || selectedTrackIds.has(candidate.id)) {
      continue;
    }

    const artistHitsInWindow = rollingCount(
      selected,
      Math.max(2, config.artistRollingWindow - 1),
      (item) => item.artistKey === candidate.artistKey
    );

    if (artistHitsInWindow >= Math.max(1, config.artistMaxPerRollingWindow)) {
      continue;
    }

    const artistSessionCap = Math.max(1, config.artistSessionCap + tier.artistSessionCapBump);
    if ((artistSessionCounts.get(candidate.artistKey) ?? 0) >= artistSessionCap) {
      continue;
    }

    if (violatesGenreWindow(selected, candidate, config, minDistinctGenres)) {
      continue;
    }

    const score = computeCandidateScore({
      candidate,
      selected,
      artistSessionCounts,
      suggestionCount,
      config,
      tier,
      rng,
    });

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function buildConstrainedTuneInMix(input: {
  libraryTracks: TuneInSelectorTrack[];
  suggestionTracks: TuneInSelectorTrack[];
  targetSize: number;
  historyEntries?: TuneInHistoryEntry[];
  config?: Partial<TuneInDiversityConfig>;
  seed?: string;
}): TuneInSelectionResult {
  const config: TuneInDiversityConfig = {
    ...DEFAULT_TUNE_IN_DIVERSITY_CONFIG,
    ...(input.config ?? {}),
  };

  const historyEntries = Array.isArray(input.historyEntries) ? input.historyEntries : [];
  const { blockedTrackKeys, blockedTrackIds } = buildBlockedTrackSets(historyEntries, config);

  const combinedTracks = [...input.libraryTracks, ...input.suggestionTracks];
  const prepared = prepareCandidates(combinedTracks, blockedTrackKeys, blockedTrackIds);
  const candidates = prepared.candidates;

  if (candidates.length === 0) {
    return {
      tracks: [],
      stats: {
        candidateCount: 0,
        selectedCount: 0,
        blockedByTrackCooldown: prepared.blockedByTrackCooldown,
        tierSelections: {
          tier1: 0,
          tier2: 0,
          tier3: 0,
        },
      },
    };
  }

  const normalizedTargetSize = Math.max(1, Math.min(160, Math.floor(input.targetSize)));
  const seedInput = input.seed ?? `${Date.now()}::${normalizedTargetSize}::${candidates.length}`;
  const rng = createMulberry32(hashStringToUint32(seedInput));

  const selected: PreparedCandidate[] = [];
  const selectedTrackKeys = new Set<string>();
  const selectedTrackIds = new Set<string>();
  const artistSessionCounts = new Map<string, number>();
  const tierSelections: Record<TuneInSelectionTier, number> = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
  };

  while (selected.length < normalizedTargetSize && selected.length < candidates.length) {
    let pickedIndex = -1;
    let pickedTier: SelectorTierConfig | null = null;

    const currentSuggestionCount = selected.filter((track) => track.source === "suggestion").length;

    for (const tier of TIERS) {
      const candidateIndex = pickCandidateIndex({
        candidates,
        selected,
        selectedTrackKeys,
        selectedTrackIds,
        artistSessionCounts,
        suggestionCount: currentSuggestionCount,
        config,
        tier,
        rng,
      });
      if (candidateIndex >= 0) {
        pickedIndex = candidateIndex;
        pickedTier = tier;
        break;
      }
    }

    if (pickedIndex < 0 || !pickedTier) {
      break;
    }

    const picked = candidates[pickedIndex];
    selected.push(picked);
    selectedTrackKeys.add(picked.trackKey);
    selectedTrackIds.add(picked.id);
    artistSessionCounts.set(picked.artistKey, (artistSessionCounts.get(picked.artistKey) ?? 0) + 1);
    tierSelections[pickedTier.tier] += 1;
  }

  return {
    tracks: selected.map((track) => ({
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      source: track.source,
      genreTag: track.genreTag ?? null,
    })),
    stats: {
      candidateCount: candidates.length,
      selectedCount: selected.length,
      blockedByTrackCooldown: prepared.blockedByTrackCooldown,
      tierSelections,
    },
  };
}
