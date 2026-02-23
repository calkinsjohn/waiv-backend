import { NextRequest, NextResponse } from "next/server";

type AppleContextRequest = {
  storefront?: string;
};

type TrackRef = {
  id: string;
  title: string;
  artist: string;
};

type AppleContextResponse = {
  recentPlayed: TrackRef[];
  recentlyAdded: TrackRef[];
  heavyRotation: TrackRef[];
  favorites: TrackRef[];
  recommendations: TrackRef[];
  fetchedAt: string;
};

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

function parseInput(raw: unknown): AppleContextRequest {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const input = raw as AppleContextRequest;
  return {
    storefront: typeof input.storefront === "string" ? input.storefront.trim() : undefined,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pickTrackRef(node: unknown): TrackRef | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const record = node as {
    id?: unknown;
    attributes?: {
      name?: unknown;
      title?: unknown;
      artistName?: unknown;
      artist_name?: unknown;
      playParams?: {
        id?: unknown;
        kind?: unknown;
      };
    };
  };

  const titleRaw =
    typeof record.attributes?.name === "string"
      ? record.attributes.name
      : typeof record.attributes?.title === "string"
      ? record.attributes.title
      : "";

  const artistRaw =
    typeof record.attributes?.artistName === "string"
      ? record.attributes.artistName
      : typeof record.attributes?.artist_name === "string"
      ? record.attributes.artist_name
      : "";

  const title = normalizeWhitespace(titleRaw);
  const artist = normalizeWhitespace(artistRaw);
  const nodeID = typeof record.id === "string" ? normalizeWhitespace(record.id) : "";
  const playParamID =
    typeof record.attributes?.playParams?.id === "string"
      ? normalizeWhitespace(record.attributes.playParams.id)
      : "";

  const id = playParamID || nodeID;
  if (!id || !title || !artist) {
    return null;
  }

  return {
    id,
    title,
    artist,
  };
}

function collectTrackRefs(node: unknown, out: TrackRef[], cap: number): void {
  if (out.length >= cap || node == null) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      if (out.length >= cap) {
        return;
      }
      collectTrackRefs(item, out, cap);
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const maybeTrack = pickTrackRef(node);
  if (maybeTrack) {
    out.push(maybeTrack);
    if (out.length >= cap) {
      return;
    }
  }

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (out.length >= cap) {
      return;
    }
    if (value && (Array.isArray(value) || typeof value === "object")) {
      collectTrackRefs(value, out, cap);
    }
  }
}

function dedupeTrackRefs(trackRefs: TrackRef[], cap = 100): TrackRef[] {
  const seen = new Set<string>();
  const deduped: TrackRef[] = [];

  for (const track of trackRefs) {
    const key = `${track.id.toLowerCase()}|${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(track);
    if (deduped.length >= cap) {
      break;
    }
  }

  return deduped;
}

async function fetchAppleMusicJSON(path: string, developerToken: string, userToken: string): Promise<unknown | null> {
  const url = path.startsWith("http") ? path : `https://api.music.apple.com${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": userToken,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json().catch(() => null);
}

async function fetchTrackRefsFromCandidatePaths(
  candidatePaths: string[],
  developerToken: string,
  userToken: string,
  cap = 100
): Promise<TrackRef[]> {
  for (const path of candidatePaths) {
    const payload = await fetchAppleMusicJSON(path, developerToken, userToken);
    if (!payload) {
      continue;
    }

    const collected: TrackRef[] = [];
    collectTrackRefs(payload, collected, cap);
    const deduped = dedupeTrackRefs(collected, cap);
    if (deduped.length > 0) {
      return deduped;
    }
  }

  return [];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tokenFailure = requireAppToken(request);
  if (tokenFailure) {
    return tokenFailure;
  }

  const headerDeveloperToken = request.headers.get("x-apple-music-developer-token")?.trim();
  const envDeveloperToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim();
  const developerToken = headerDeveloperToken || envDeveloperToken;
  if (!developerToken) {
    return NextResponse.json({ error: "Missing APPLE_MUSIC_DEVELOPER_TOKEN." }, { status: 503 });
  }

  const userToken = request.headers.get("x-apple-music-user-token")?.trim();
  if (!userToken) {
    return NextResponse.json({ error: "Missing Apple Music user token." }, { status: 400 });
  }

  let input: AppleContextRequest = {};
  try {
    const raw = (await request.json()) as unknown;
    input = parseInput(raw);
  } catch {
    input = {};
  }

  void input.storefront;

  const [recentPlayed, recentlyAdded, heavyRotation, favorites, recommendations] = await Promise.all([
    fetchTrackRefsFromCandidatePaths(
      ["/v1/me/recent/played/tracks?limit=100", "/v1/me/recent/played?limit=100"],
      developerToken,
      userToken
    ),
    fetchTrackRefsFromCandidatePaths(["/v1/me/library/recently-added?limit=100"], developerToken, userToken),
    fetchTrackRefsFromCandidatePaths(
      [
        "/v1/me/history/heavy-rotation/tracks?limit=100",
        "/v1/me/history/heavy-rotation?limit=100",
        "/v1/me/history-heavy-rotation/tracks?limit=100",
        "/v1/me/history-heavy-rotation?limit=100",
      ],
      developerToken,
      userToken
    ),
    fetchTrackRefsFromCandidatePaths(
      [
        "/v1/me/library/songs?filter[favorited]=true&limit=100&include=catalog",
        "/v1/me/library/songs?filter[favorite]=true&limit=100&include=catalog",
      ],
      developerToken,
      userToken
    ),
    fetchTrackRefsFromCandidatePaths(["/v1/me/recommendations?limit=25"], developerToken, userToken, 120),
  ]);

  const responseBody: AppleContextResponse = {
    recentPlayed,
    recentlyAdded,
    heavyRotation,
    favorites,
    recommendations,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(responseBody, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
