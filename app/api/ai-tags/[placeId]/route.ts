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
    log.storage("Upstash Redis credentials not found, caching disabled", {
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
    log.storage("Upstash Redis client initialized", {
      action: "redis_init_success",
    });
    return redis;
  } catch (error: any) {
    log.storageError("Failed to initialize Redis client", {
      action: "redis_init_error",
    }, error);
    return null;
  }
}

// CORS headers
function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// DELETE: Belirli bir mekanın AI etiketlerini sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;

  try {
    if (!placeId) {
      return setCorsHeaders(
        NextResponse.json({ error: "Place ID is required" }, { status: 400 })
      );
    }

    const redisClient = getRedisClient();
    if (!redisClient) {
      return setCorsHeaders(
        NextResponse.json({ error: "Redis not available" }, { status: 503 })
      );
    }

    log.storage("Deleting tags from cache", {
      action: "cache_delete",
      placeId,
    });

    await redisClient.del(`ai-tags:${placeId}`);

    return setCorsHeaders(
      NextResponse.json({ success: true, message: `Tags for ${placeId} deleted` })
    );
  } catch (error: any) {
    log.storageError("Failed to delete tags", {
      action: "cache_delete_error",
      placeId,
    }, error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to delete tags", detail: error.message },
        { status: 500 }
      )
    );
  }
}

// GET: AI etiketlerini oku
export async function GET(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;
  
  try {
    if (!placeId) {
      return setCorsHeaders(
        NextResponse.json({ error: "Place ID is required" }, { status: 400 })
      );
    }

    // Upstash Redis'ten etiketleri oku
    const redisClient = getRedisClient();
    if (!redisClient) {
      log.storage("Redis not available, returning null", {
        action: "cache_read_skip",
        placeId,
      });
      return setCorsHeaders(
        NextResponse.json({ tags: null, cached: false })
      );
    }
    
    log.storage("Reading tags from cache", {
      action: "cache_read",
      placeId,
    });
    
    const startTime = Date.now();
    const tags = await redisClient.get<string[]>(`ai-tags:${placeId}`);
    const duration = Date.now() - startTime;
    
    if (tags && Array.isArray(tags) && tags.length > 0) {
      log.storage("Tags found in cache", {
        action: "cache_hit",
        placeId,
        tagsCount: tags.length,
        duration: `${duration}ms`,
      });
      return setCorsHeaders(
        NextResponse.json({ tags, cached: true })
      );
    }

    log.storage("Tags not found in cache", {
      action: "cache_miss",
      placeId,
      duration: `${duration}ms`,
    });

    // Etiket bulunamadı
    return setCorsHeaders(
      NextResponse.json({ tags: null, cached: false })
    );
  } catch (error: any) {
    log.storageError("Failed to fetch tags", {
      action: "cache_read_error",
      placeId,
    }, error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to fetch tags", detail: error.message },
        { status: 500 }
      )
    );
  }
}

// POST: AI etiketlerini kaydet
export async function POST(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;
  let tags: string[] | undefined;
  
  try {
    const body = await request.json();
    tags = body.tags;

    if (!placeId) {
      return setCorsHeaders(
        NextResponse.json({ error: "Place ID is required" }, { status: 400 })
      );
    }

    if (!Array.isArray(tags)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Tags must be an array" }, { status: 400 })
      );
    }

    // Upstash Redis'e etiketleri kaydet (30 gün TTL)
    const redisClient = getRedisClient();
    if (!redisClient) {
      log.storage("Redis not available, skipping cache write", {
        action: "cache_write_skip",
        placeId,
        tagsCount: tags.length,
      });
      // Redis yoksa bile başarılı dön (fallback)
      return setCorsHeaders(
        NextResponse.json({ success: true, placeId, tags, cached: false })
      );
    }
    
    log.storage("Saving tags to cache", {
      action: "cache_write",
      placeId,
      tagsCount: tags.length,
      ttl: "30 days",
    });
    
    const startTime = Date.now();
    await redisClient.set(`ai-tags:${placeId}`, tags, { ex: 86400 * 30 });
    const duration = Date.now() - startTime;
    
    log.storage("Tags saved to cache successfully", {
      action: "cache_write_success",
      placeId,
      tagsCount: tags.length,
      duration: `${duration}ms`,
    });
    
    return setCorsHeaders(
      NextResponse.json({ success: true, placeId, tags })
    );
  } catch (error: any) {
    log.storageError("Failed to save tags", {
      action: "cache_write_error",
      placeId,
      tagsCount: tags?.length || 0,
    }, error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "Failed to save tags", detail: error.message },
        { status: 500 }
      )
    );
  }
}

