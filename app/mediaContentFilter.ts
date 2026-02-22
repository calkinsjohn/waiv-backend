function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STRONG_ALBUM_MARKERS = [
  "original motion picture soundtrack",
  "motion picture soundtrack",
  "music from the motion picture",
  "music from and inspired by",
  "original score",
  "film score",
  "original game soundtrack",
  "video game soundtrack",
  "game soundtrack",
  "official soundtrack",
  "soundtrack from",
];

const STRONG_GENRE_MARKERS = [
  "soundtrack",
  "score",
  "film",
  "movie",
  "stage and screen",
  "stage screen",
  "video game",
  "game soundtrack",
];

const TITLE_SCORE_MARKERS = [
  "main title",
  "opening titles",
  "end credits",
  "original score",
  "theme from",
  "ost",
];

const VISUAL_MEDIA_CONTEXT_MARKERS = [
  "motion picture",
  "film",
  "movie",
  "video game",
  "game",
  "soundtrack",
  "score",
  "ost",
];

function hasMarker(haystack: string, markers: string[]): boolean {
  return markers.some((marker) => haystack.includes(marker));
}

export function isSoundtrackOrScoreLike(input: {
  title: string;
  artistName?: string | null;
  albumTitle?: string | null;
  genreTag?: string | null;
}): boolean {
  const title = normalize(input.title ?? "");
  const artist = normalize(input.artistName ?? "");
  const album = normalize(input.albumTitle ?? "");
  const genre = normalize(input.genreTag ?? "");

  if (album && hasMarker(album, STRONG_ALBUM_MARKERS)) {
    return true;
  }

  if (genre && hasMarker(genre, STRONG_GENRE_MARKERS)) {
    return true;
  }

  if (title && hasMarker(title, TITLE_SCORE_MARKERS)) {
    return true;
  }

  // Catch combined "ost"/"score"/"soundtrack" phrasing with media context.
  const albumLooksMedia = hasMarker(album, VISUAL_MEDIA_CONTEXT_MARKERS);
  const titleLooksMedia = hasMarker(title, VISUAL_MEDIA_CONTEXT_MARKERS);
  const artistLooksMedia =
    artist.includes("soundtrack") ||
    artist.includes("original score") ||
    artist.includes("composer");

  if ((albumLooksMedia || titleLooksMedia) && (album.includes("score") || album.includes("soundtrack"))) {
    return true;
  }

  if (artistLooksMedia && (albumLooksMedia || titleLooksMedia || genre.includes("soundtrack"))) {
    return true;
  }

  return false;
}
