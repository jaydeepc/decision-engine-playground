import { NextResponse } from "next/server";
import { PRESETS } from "@/lib/presets";

export async function GET() {
  return NextResponse.json({ presets: PRESETS.map(({ id, name, tagline, stateKey, sample, questions }) => ({ id, name, tagline, stateKey, sample, questions })) });
}
