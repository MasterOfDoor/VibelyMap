import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { log } from "@/app/utils/logger";

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  // New Upstash KV environment variables
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (error) {
    return null;
  }
}

function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return setCorsHeaders(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return setCorsHeaders(NextResponse.json({ error: "Redis not available" }, { status: 503 }));
    }

    log.storage("Clearing all AI tags from cache", { action: "cache_clear_all" });

    // "ai-tags:*" pattern'ine sahip tüm key'leri bul
    const keys = await redisClient.keys("ai-tags:*");
    
    if (keys.length > 0) {
      // Key'leri sil
      await redisClient.del(...keys);
      log.storage("AI tags cleared successfully", { action: "cache_clear_all_success", count: keys.length });
      return setCorsHeaders(NextResponse.json({ success: true, count: keys.length }));
    }

    return setCorsHeaders(NextResponse.json({ success: true, count: 0, message: "No tags found to clear" }));
  } catch (error: any) {
    log.storageError("Failed to clear AI tags", { action: "cache_clear_all_error" }, error);
    return setCorsHeaders(NextResponse.json({ error: "Failed to clear AI tags", detail: error.message }, { status: 500 }));
  }
}
