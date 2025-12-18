import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const PROFILE_KEY_PREFIX = "user:profile:";
const USERNAME_KEY_PREFIX = "username:to:address:";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return setCorsHeaders(NextResponse.json({ results: [] }));
    }

    if (!redis) {
      return setCorsHeaders(NextResponse.json({ error: "Database not configured" }, { status: 500 }));
    }

    // 1. Eğer sorgu bir wallet adresi ise (0x...)
    if (query.match(/^0x[a-fA-F0-9]{40}$/)) {
      const profile = await redis.get(`${PROFILE_KEY_PREFIX}${query.toLowerCase()}`);
      return setCorsHeaders(NextResponse.json({ results: profile ? [profile] : [] }));
    }

    // 2. Kullanıcı adı araması
    // Redis'te tam eşleşme kontrolü (SCAN yerine index bazlı hızlı arama)
    // Upstash'te pattern search için SCAN kullanılabilir ama büyük veride yavaşlar.
    // Şimdilik tam eşleşme veya basit username index üzerinden gidiyoruz.
    const normalizedQuery = query.toLowerCase().trim();
    const address = await redis.get<string>(`${USERNAME_KEY_PREFIX}${normalizedQuery}`);
    
    if (address) {
      const profile = await redis.get(`${PROFILE_KEY_PREFIX}${address}`);
      return setCorsHeaders(NextResponse.json({ results: profile ? [profile] : [] }));
    }

    // Kısmi eşleşme için (opsiyonel/gelişmiş):
    // Upstash Redis'te keys veya scan kullanılabilir:
    const keys = await redis.keys(`${USERNAME_KEY_PREFIX}${normalizedQuery}*`);
    if (keys.length > 0) {
      const addresses = await Promise.all(keys.map(k => redis.get<string>(k)));
      const profiles = await Promise.all(
        addresses
          .filter((addr): addr is string => !!addr)
          .map(addr => redis.get(`${PROFILE_KEY_PREFIX}${addr}`))
      );
      return setCorsHeaders(NextResponse.json({ results: profiles.filter(p => !!p) }));
    }

    return setCorsHeaders(NextResponse.json({ results: [] }));
  } catch (error: any) {
    console.error("[Profile Search API] error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Search failed", detail: error.message }, { status: 500 })
    );
  }
}
