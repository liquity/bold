import { NextResponse } from "next/server";

const { LIQUITY_STATS_URL } = process.env;

export async function GET() {
  if (!LIQUITY_STATS_URL) {
    throw new Error("LIQUITY_STATS_URL is not defined");
  }
  const response = await fetch(LIQUITY_STATS_URL);
  return NextResponse.json(await response.json());
}