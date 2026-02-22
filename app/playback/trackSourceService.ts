import {
  buildAppleMusicTuneInSession,
  fetchAppleMusicFavoritedSongs,
  fetchAppleMusicHeavyRotationTracks,
  fetchAppleMusicLibrarySongs,
  type AppleMusicPlaylistTrackRef,
  type AppleMusicTuneInTrackRef,
} from "../appleMusicClient";
import { isSoundtrackOrScoreLike } from "../mediaContentFilter";
import { isAmbientLike } from "./sanitization";
import type { PlaybackTrack } from "./types";

export type SessionTrackSources = {
  heavyRotation: PlaybackTrack[];
  favorites: PlaybackTrack[];
  library: PlaybackTrack[];
  suggestions: PlaybackTrack[];
};

function toPlaybackTrack(
  track: AppleMusicPlaylistTrackRef | AppleMusicTuneInTrackRef,
  source: "library" | "suggestion"
): PlaybackTrack {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    source,
    genreTag: track.genreTag ?? null,
    albumId: track.albumId ?? null,
    albumTitle: track.albumTitle ?? null,
  };
}

function dedupeTracks(tracks: PlaybackTrack[], excludeIds?: Set<string>): PlaybackTrack[] {
  const seen = new Set<string>();
  const next: PlaybackTrack[] = [];
  for (const track of tracks) {
    const id = track.id?.trim();
    if (!id || seen.has(id) || excludeIds?.has(id)) {
      continue;
    }
    if (
      isAmbientLike({
        title: track.title,
        genreTag: track.genreTag,
        albumTitle: track.albumTitle,
      })
    ) {
      continue;
    }
    if (
      isSoundtrackOrScoreLike({
        title: track.title,
        artistName: track.artistName,
        genreTag: track.genreTag,
        albumTitle: track.albumTitle,
      })
    ) {
      continue;
    }
    seen.add(id);
    next.push({ ...track, id });
  }
  return next;
}

export class TrackSourceService {
  async loadSources(): Promise<SessionTrackSources> {
    const [heavyRotationRaw, favoritesRaw, libraryRaw, suggestionSeed] = await Promise.all([
      fetchAppleMusicHeavyRotationTracks({ limit: 180 }).catch(() => [] as AppleMusicPlaylistTrackRef[]),
      fetchAppleMusicFavoritedSongs({ limit: 180 }).catch(() => [] as AppleMusicPlaylistTrackRef[]),
      fetchAppleMusicLibrarySongs({ limit: 350 }).catch(() => [] as AppleMusicPlaylistTrackRef[]),
      buildAppleMusicTuneInSession({ targetSize: 80 }).catch(() => null),
    ]);

    const heavyRotation = dedupeTracks(heavyRotationRaw.map((track) => toPlaybackTrack(track, "library")));
    const favorites = dedupeTracks(
      favoritesRaw.map((track) => toPlaybackTrack(track, "library")),
      new Set(heavyRotation.map((track) => track.id))
    );

    const libraryExclusions = new Set<string>([
      ...heavyRotation.map((track) => track.id),
      ...favorites.map((track) => track.id),
    ]);

    const library = dedupeTracks(
      libraryRaw.map((track) => toPlaybackTrack(track, "library")),
      libraryExclusions
    );

    const suggestionExclusions = new Set<string>([
      ...libraryExclusions,
      ...library.map((track) => track.id),
    ]);

    const suggestions = dedupeTracks(
      (suggestionSeed?.tracks ?? [])
        .filter((track) => track.source === "suggestion")
        .map((track) => toPlaybackTrack(track, "suggestion")),
      suggestionExclusions
    );

    return {
      heavyRotation,
      favorites,
      library,
      suggestions,
    };
  }
}
