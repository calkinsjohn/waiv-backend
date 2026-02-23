import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tokenFailure = requireAppToken(request);
  if (tokenFailure) {
    return tokenFailure;
  }

  const developerToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    return NextResponse.json({ error: "Missing APPLE_MUSIC_DEVELOPER_TOKEN." }, { status: 503 });
  }

  return NextResponse.json(
    {
      developerToken,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
