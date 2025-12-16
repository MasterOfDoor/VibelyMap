import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { log } from "@/app/utils/logger";

// Upstash Redis client - conditional initialization
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    log.storage("Upstash Redis credentials not found, batch caching disabled", {
      action: "redis_init_skip",
      hasUrl: !!url,
      hasToken: !!token,
    });
    return null;
  }
  
  try {
    redis = new Redis({
      url: url,
      token: token,
    });
    log.storage("Upstash Redis client initialized for batch operations", {
      action: "redis_init_success",
    });
    return redis;
  } catch (error: any) {
    log.storageError("Failed to initialize Redis client for batch", {
      action: "redis_init_error",
    }, error);
    return null;
  }
}

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

// GET: Birden fazla place ID için cache kontrolü yap
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeIdsParam = searchParams.get("placeIds");
    
    if (!placeIdsParam) {
      return setCorsHeaders(
        NextResponse.json({ error: "placeIds parameter is required" }, { status: 400 })
      );
    }

    const placeIds = placeIdsParam.split(",").filter(Boolean);
    
    if (placeIds.length === 0) {
      return setCorsHeaders(
        NextResponse.json({ error: "At least one place ID is required" }, { status: 400 })
      );
    }

    // Upstash Redis'ten toplu cache kontrolü
    const redisClient = getRedisClient();
    if (!redisClient) {
      log.storage("Redis not available, returning empty cache results", {
        action: "batch_cache_read_skip",
        placeIdsCount: placeIds.length,
      });
      return setCorsHeaders(
        NextResponse.json({ 
          cached: {},
          uncached: placeIds,
          total: placeIds.length,
          cachedCount: 0,
          uncachedCount: placeIds.length,
        })
      );
    }
    
    log.storage("Reading tags from cache (batch)", {
      action: "batch_cache_read",
      placeIdsCount: placeIds.length,
    });
    
    const startTime = Date.now();
    
    // Her place ID için cache kontrolü yap (paralel)
    const cachePromises = placeIds.map(async (placeId) => {
      try {
        const tags = await redisClient.get<string[]>(`ai-tags:${placeId}`);
        return { placeId, tags };
      } catch (error: any) {
        log.storageError("Cache read error for place", {
          action: "batch_cache_read_error",
          placeId,
        }, error);
        return { placeId, tags: null };
      }
    });
    
    const cacheResults = await Promise.all(cachePromises);
    const duration = Date.now() - startTime;
    
    // Sonuçları ayır: cached ve uncached
    const cached: { [placeId: string]: string[] } = {};
    const uncached: string[] = [];
    
    cacheResults.forEach(({ placeId, tags }) => {
      if (tags && Array.isArray(tags) && tags.length > 0) {
        cached[placeId] = tags;
      } else {
        uncached.push(placeId);
      }
    });
    
    log.storage("Batch cache check completed", {
      action: "batch_cache_read_complete",
      total: placeIds.length,
      cachedCount: Object.keys(cached).length,
      uncachedCount: uncached.length,
      duration: `${duration}ms`,
    });
    
    return setCorsHeaders(
      NextResponse.json({
        cached,
        uncached,
        total: placeIds.length,
        cachedCount: Object.keys(cached).length,
        uncachedCount: uncached.length,
      })
    );
  } catch (error: any) {
    log.storageError("Failed to perform batch cache check", {
      action: "batch_cache_read_exception",
    }, error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to check cache", detail: error.message },
        { status: 500 }
      )
    );
  }
}
