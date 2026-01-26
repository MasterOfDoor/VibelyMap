import { NextResponse } from "next/server";

// Google Maps JavaScript API key'i client-side'a güvenli şekilde döndür
// Not: Bu key domain restriction ile korunmalıdır
export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_KEY || "";
  
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ apiKey });
}
