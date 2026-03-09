const TITLE_SUFFIX_PATTERNS = [
  /\s[-–—]\s(?:live|remaster(?:ed)?(?:\s\d{4})?|deluxe|radio\sedit|edit|version|mono|stereo|acoustic|demo|instrumental|mix|extended|single\sedit)\b.*$/iu,
  /\s\b(?:live|remaster(?:ed)?(?:\s\d{4})?|deluxe|radio\sedit|mono|stereo|version)\b$/iu,
];

const UNSAFE_TERMS = [
  /\bfu+ck(?:ing|er|ed|s)?\b/giu,
  /\bsh(?:i|1)t(?:ty|ting|ted|s)?\b/giu,
  /\bb[i1]tch(?:es)?\b/giu,
  /\basshole(?:s)?\b/giu,
  /\bdamn\b/giu,
  /\bslut(?:s)?\b/giu,
  /\bn[i1]gg(?:a|er|ers|as)\b/giu,
  /\bfag(?:got|gots)?\b/giu,
  /\bcunt(?:s)?\b/giu,
];

const AMBIENT_TERMS = [
  "ambient",
  "chillhop",
  "lofi hip hop",
  "lo-fi hip hop",
  "lofi beats",
  "lo-fi beats",
  "study beats",
  "beats to study",
  "beats to relax",
  "instrumental beats",
  "drone",
  "soundscape",
  "meditation",
  "sleep",
  "rain sounds",
  "white noise",
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function spokenTitle(rawTitle: string): string {
  let next = rawTitle.trim();
  if (!next) {
    return "";
  }

  for (let i = 0; i < 5; i += 1) {
    const stripped = next.replace(/\s*[\[(][^\]()\[\]]*[\])]\s*/gu, " ").trim();
    if (!stripped || stripped === next) {
      break;
    }
    next = stripped;
  }

  for (const pattern of TITLE_SUFFIX_PATTERNS) {
    next = next.replace(pattern, "").trim();
  }

  next = next.replace(/[\-–—,:;]+$/u, "").trim();
  return collapseWhitespace(next);
}

export function sanitizeSpokenText(text: string): string {
  let next = text;
  for (const pattern of UNSAFE_TERMS) {
    next = next.replace(pattern, "—");
  }
  return collapseWhitespace(next);
}

export function sanitizeSpokenArtist(rawArtist: string): string {
  const cleaned = sanitizeSpokenText(rawArtist);
  return cleaned.length > 0 ? cleaned : "this artist";
}

export function sanitizeSpokenTitle(rawTitle: string): string {
  const title = spokenTitle(rawTitle);
  const cleaned = sanitizeSpokenText(title);
  return cleaned.length > 0 ? cleaned : "this track";
}

export function isAmbientLike(input: {
  title: string;
  genreTag?: string | null;
  albumTitle?: string | null;
}): boolean {
  const haystack = `${input.title} ${input.genreTag ?? ""} ${input.albumTitle ?? ""}`.toLowerCase();
  return AMBIENT_TERMS.some((term) => haystack.includes(term));
}
