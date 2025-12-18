import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const CACHE_KEY_PREFIX = "profile_avatar:";
const CACHE_TTL = 86400 * 30; // 30 days

// CORS headers
function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// GET: Avatar URL'ini oku
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "Invalid wallet address" },
          { status: 400 }
        )
      );
    }

    if (!redis) {
      return setCorsHeaders(
        NextResponse.json({ url: null })
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cachedUrl = await redis.get<string>(`${CACHE_KEY_PREFIX}${normalizedAddress}`);

    return setCorsHeaders(
      NextResponse.json({ url: cachedUrl || null })
    );
  } catch (error: any) {
    console.error("[Avatar API] GET error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to fetch avatar", detail: error.message },
        { status: 500 }
      )
    );
  }
}

// POST: Avatar URL'ini kaydet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, url } = body;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json(
          { error: "Invalid wallet address" },
          { status: 400 }
        )
      );
    }

    if (!url || typeof url !== "string") {
      return setCorsHeaders(
        NextResponse.json(
          { error: "Invalid URL" },
          { status: 400 }
        )
      );
    }

    if (!redis) {
      return setCorsHeaders(
        NextResponse.json({ success: true, cached: false })
      );
    }

    const normalizedAddress = address.toLowerCase();
    await redis.set(`${CACHE_KEY_PREFIX}${normalizedAddress}`, url, { ex: CACHE_TTL });

    return setCorsHeaders(
      NextResponse.json({ success: true, cached: true })
    );
  } catch (error: any) {
    console.error("[Avatar API] POST error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to save avatar", detail: error.message },
        { status: 500 }
      )
    );
  }
}

