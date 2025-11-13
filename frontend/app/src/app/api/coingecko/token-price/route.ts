import { NextRequest, NextResponse } from "next/server";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddresses = searchParams.get("contract_addresses");

  if (!contractAddresses) {
    return NextResponse.json({ error: "Missing contract_addresses parameter" }, { status: 400 });
  }

  if (!COINGECKO_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${contractAddresses}&vs_currencies=usd&x_cg_demo_api_key=${COINGECKO_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch token prices" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
