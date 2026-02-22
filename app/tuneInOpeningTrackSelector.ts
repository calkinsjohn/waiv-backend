import { buildCanonicalTrackKey } from "./trackIdentity";

export type TuneInFirstTrackSource =
  | "heavy_rotation"
  | "most_played"
  | "favorites"
  | "recently_played"
  | "suggestion_fallback";

export type TuneInOpeningTrackCandidate = {
  id: string;
  title: string;
  artistName: string;
  source: "library" | "suggestion";
};

export type TuneInOpeningTrackBuckets = {
  heavyRotation: TuneInOpeningTrackCandidate[];
  mostPlayed: TuneInOpeningTrackCandidate[];
  favorites: TuneInOpeningTrackCandidate[];
  recentlyPlayed: TuneInOpeningTrackCandidate[];
  suggestionFallback: TuneInOpeningTrackCandidate[];
};

export type TuneInOpeningTrackSelection = {
  source: TuneInFirstTrackSource;
  track: TuneInOpeningTrackCandidate;
};

type OpeningTrackSelectionPolicy = {
  previousSessionFirstTrackId?: string | null;
  previousSessionFirstTrackKey?: string | null;
  recentFirstTrackIds?: string[];
  recentFirstTrackKeys?: string[];
  random?: () => number;
};

function buildOpeningCandidateKey(candidate: TuneInOpeningTrackCandidate): string {
  return buildCanonicalTrackKey({
    title: candidate.title,
    artistName: candidate.artistName,
  });
}

function dedupeCandidates(
  candidates: TuneInOpeningTrackCandidate[]
): TuneInOpeningTrackCandidate[] {
  const seen = new Set<string>();
  const seenKeys = new Set<string>();
  const deduped: TuneInOpeningTrackCandidate[] = [];
  for (const candidate of candidates) {
    const id = candidate.id?.trim();
    const key = buildOpeningCandidateKey(candidate);
    if (!id || !key || seen.has(id) || seenKeys.has(key)) {
      continue;
    }
    seen.add(id);
    seenKeys.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function pickOpeningTrackWithGuards(input: {
  candidates: TuneInOpeningTrackCandidate[];
  policy?: OpeningTrackSelectionPolicy;
}): TuneInOpeningTrackCandidate | null {
  const candidates = input.candidates;
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const policy = input.policy;
  const random = policy?.random ?? Math.random;
  const recentWindow = (policy?.recentFirstTrackIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .slice(-5);
  const previousSessionFirstTrackId = policy?.previousSessionFirstTrackId?.trim() ?? "";
  const recentKeyWindow = (policy?.recentFirstTrackKeys ?? [])
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .slice(-8);
  const previousSessionFirstTrackKey = policy?.previousSessionFirstTrackKey?.trim() ?? "";
  const recentCounts = new Map<string, number>();
  for (const trackId of recentWindow) {
    recentCounts.set(trackId, (recentCounts.get(trackId) ?? 0) + 1);
  }
  const recentKeyCounts = new Map<string, number>();
  for (const trackKey of recentKeyWindow) {
    recentKeyCounts.set(trackKey, (recentKeyCounts.get(trackKey) ?? 0) + 1);
  }
  const recentKeySet = new Set(recentKeyWindow);

  let eligible = [...candidates];

  if (previousSessionFirstTrackId) {
    const withoutPrevious = eligible.filter((candidate) => candidate.id !== previousSessionFirstTrackId);
    if (withoutPrevious.length > 0) {
      eligible = withoutPrevious;
    }
  }
  if (previousSessionFirstTrackKey) {
    const withoutPreviousKey = eligible.filter(
      (candidate) => buildOpeningCandidateKey(candidate) !== previousSessionFirstTrackKey
    );
    if (withoutPreviousKey.length > 0) {
      eligible = withoutPreviousKey;
    }
  }

  const overusedIds = new Set(
    [...recentCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  );
  const overusedKeys = new Set(
    [...recentKeyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
  );
  if (overusedIds.size > 0) {
    const withoutOverused = eligible.filter((candidate) => !overusedIds.has(candidate.id));
    if (withoutOverused.length > 0) {
      eligible = withoutOverused;
    }
  }
  if (overusedKeys.size > 0) {
    const withoutOverusedKeys = eligible.filter(
      (candidate) => !overusedKeys.has(buildOpeningCandidateKey(candidate))
    );
    if (withoutOverusedKeys.length > 0) {
      eligible = withoutOverusedKeys;
    }
  }

  if (recentKeySet.size > 0) {
    const withoutRecentKeys = eligible.filter(
      (candidate) => !recentKeySet.has(buildOpeningCandidateKey(candidate))
    );
    if (withoutRecentKeys.length > 0) {
      eligible = withoutRecentKeys;
    }
  }

  const pickFrom = eligible.length > 0 ? eligible : candidates;
  const sampled = random();
  const raw = Number.isFinite(sampled) ? sampled : Math.random();
  const normalized = raw >= 1 ? 0.999999 : raw < 0 ? 0 : raw;
  const index = Math.floor(normalized * pickFrom.length);
  return pickFrom[Math.max(0, Math.min(pickFrom.length - 1, index))] ?? pickFrom[0];
}

export function selectOpeningTrackByPriority(input: {
  buckets: TuneInOpeningTrackBuckets;
  isPlayable: (trackId: string) => boolean;
  selectionPolicy?: OpeningTrackSelectionPolicy;
}): TuneInOpeningTrackSelection | null {
  const orderedBuckets: Array<{
    source: TuneInFirstTrackSource;
    candidates: TuneInOpeningTrackCandidate[];
  }> = [
    { source: "heavy_rotation", candidates: input.buckets.heavyRotation },
    { source: "most_played", candidates: input.buckets.mostPlayed },
    { source: "favorites", candidates: input.buckets.favorites },
    { source: "recently_played", candidates: input.buckets.recentlyPlayed },
    { source: "suggestion_fallback", candidates: input.buckets.suggestionFallback },
  ];

  for (const bucket of orderedBuckets) {
    const deduped = dedupeCandidates(bucket.candidates);
    const playable = deduped.filter((candidate) => input.isPlayable(candidate.id));
    const picked = pickOpeningTrackWithGuards({
      candidates: playable,
      policy: input.selectionPolicy,
    });
    if (picked) {
      return {
        source: bucket.source,
        track: picked,
      };
    }
  }

  return null;
}
