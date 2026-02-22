import { describe, expect, it } from "vitest";
import {
  buildConstrainedTuneInMix,
  buildTuneInTrackKey,
  DEFAULT_TUNE_IN_DIVERSITY_CONFIG,
  type TuneInHistoryEntry,
  type TuneInSelectorTrack,
} from "./tuneInMixSelector";

function createTrack(index: number, source: "library" | "suggestion"): TuneInSelectorTrack {
  const genreCycle = [
    "Alternative",
    "Hip-Hop",
    "Electronic",
    "Folk",
    "R&B",
    "Post-Punk",
    "Pop",
  ];
  const artistBucket = source === "library" ? Math.floor(index / 3) : Math.floor(index / 2) + 80;

  return {
    id: `${source}_${index}`,
    title: `${source === "library" ? "Library" : "Suggestion"} Song ${index}`,
    artistName: `${source === "library" ? "Library" : "Suggestion"} Artist ${artistBucket}`,
    source,
    genreTag: genreCycle[index % genreCycle.length],
  };
}

describe("buildConstrainedTuneInMix", () => {
  it("never repeats tracks from recent cooldown windows", () => {
    const libraryTracks = Array.from({ length: 180 }, (_, index) => createTrack(index, "library"));
    const suggestionTracks = Array.from({ length: 100 }, (_, index) => createTrack(index, "suggestion"));

    const now = Date.now();
    const recentHistoryTracks = [...libraryTracks.slice(0, 35), ...suggestionTracks.slice(0, 35)];
    const historyEntries: TuneInHistoryEntry[] = recentHistoryTracks.map((track, index) => ({
      trackKey: buildTuneInTrackKey({ title: track.title, artistName: track.artistName }),
      trackId: track.id,
      artistKey: track.artistName.toLowerCase(),
      genreKey: track.genreTag?.toLowerCase() ?? null,
      playedAt: new Date(now - index * 60_000).toISOString(),
    }));

    const result = buildConstrainedTuneInMix({
      libraryTracks,
      suggestionTracks,
      targetSize: 72,
      historyEntries,
      seed: "cooldown-test-seed",
    });

    const blockedTrackKeys = new Set(historyEntries.map((entry) => entry.trackKey));
    const selectedTrackKeys = result.tracks.map((track) =>
      buildTuneInTrackKey({ title: track.title, artistName: track.artistName })
    );

    expect(result.tracks.length).toBeGreaterThanOrEqual(40);
    expect(new Set(selectedTrackKeys).size).toBe(selectedTrackKeys.length);
    expect(selectedTrackKeys.some((trackKey) => blockedTrackKeys.has(trackKey))).toBe(false);
  });

  it("enforces artist and genre diversity in rolling windows", () => {
    const libraryTracks = Array.from({ length: 220 }, (_, index) => createTrack(index, "library"));
    const suggestionTracks = Array.from({ length: 140 }, (_, index) => createTrack(index, "suggestion"));

    const result = buildConstrainedTuneInMix({
      libraryTracks,
      suggestionTracks,
      targetSize: 80,
      historyEntries: [],
      seed: "diversity-window-seed",
    });

    expect(result.tracks.length).toBeGreaterThanOrEqual(50);

    const windowSize = DEFAULT_TUNE_IN_DIVERSITY_CONFIG.artistRollingWindow;
    for (let end = windowSize; end <= result.tracks.length; end += 1) {
      const window = result.tracks.slice(end - windowSize, end);

      const artistCounts = new Map<string, number>();
      for (const track of window) {
        artistCounts.set(track.artistName, (artistCounts.get(track.artistName) ?? 0) + 1);
      }
      const maxArtistCount = Math.max(...artistCounts.values());
      expect(maxArtistCount).toBeLessThanOrEqual(
        DEFAULT_TUNE_IN_DIVERSITY_CONFIG.artistMaxPerRollingWindow
      );

      const distinctGenres = new Set(window.map((track) => (track.genreTag ?? "unknown").toLowerCase()));
      expect(distinctGenres.size).toBeGreaterThanOrEqual(
        DEFAULT_TUNE_IN_DIVERSITY_CONFIG.minDistinctGenresPerGenreWindow
      );
    }
  });
});
