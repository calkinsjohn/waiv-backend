import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "DJ intro system reset in progress.",
      code: "intro_system_reset_in_progress",
    },
    { status: 503 }
  );
}
