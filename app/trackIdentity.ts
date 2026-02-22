const TITLE_SUFFIX_PATTERNS = [
  /\s[-–—]\s(?:live|remaster(?:ed)?(?:\s\d{4})?|deluxe|radio\sedit|edit|version|mono|stereo|acoustic|demo|instrumental|mix|extended|single\sedit)\b.*$/iu,
  /\s\b(?:live|remaster(?:ed)?(?:\s\d{4})?|deluxe|radio\sedit|mono|stereo|version)\b$/iu,
];

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDecoratorsFromTitle(value: string): string {
  let next = value.trim();
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

  return next.replace(/[\-–—,:;]+$/u, "").trim();
}

export function buildCanonicalArtistToken(artistName: string): string {
  return normalizeToken(artistName);
}

export function buildCanonicalTitleToken(title: string): string {
  return normalizeToken(stripDecoratorsFromTitle(title));
}

export function buildCanonicalTrackKey(input: {
  title: string;
  artistName: string;
}): string {
  return `${buildCanonicalTitleToken(input.title)}::${buildCanonicalArtistToken(input.artistName)}`;
}
