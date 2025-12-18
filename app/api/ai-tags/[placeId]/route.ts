import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { log } from "@/app/utils/logger";

// Upstash Redis client - conditional initialization
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  try {
    if (redis) return redis;
    
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      console.warn("[Redis] Credentials missing in environment variables");
      return null;
    }
    
    redis = new Redis({
      url: url,
      token: token,
    });
    return redis;
  } catch (error) {
    console.error("[Redis Init Error]", error);
    return null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// DELETE: Belirli bir mekanın AI etiketlerini sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;

  if (!placeId) {
    return new NextResponse(JSON.stringify({ error: "Place ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return new NextResponse(JSON.stringify({ error: "Redis not available" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    await redisClient.del(`ai-tags:${placeId}`);

    return new NextResponse(JSON.stringify({ success: true, message: `Tags for ${placeId} deleted` }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error(`[AI-TAGS DELETE ERROR] placeId: ${placeId}`, error);
    return new NextResponse(JSON.stringify({ error: "Failed to delete tags", detail: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

// GET: AI etiketlerini oku
export async function GET(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;
  
  if (!placeId) {
    return new NextResponse(JSON.stringify({ error: "Place ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return new NextResponse(JSON.stringify({ tags: null, cached: false, warning: "Redis not available" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    const tags = await redisClient.get<string[]>(`ai-tags:${placeId}`);
    
    return new NextResponse(JSON.stringify({ tags: tags || null, cached: !!tags }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error(`[AI-TAGS GET ERROR] placeId: ${placeId}`, error);
    return new NextResponse(JSON.stringify({ error: "Failed to fetch tags", detail: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

// POST: AI etiketlerini kaydet
export async function POST(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const { placeId } = params;
  
  if (!placeId) {
    return new NextResponse(JSON.stringify({ error: "Place ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const body = await request.json();
    const tags = body.tags;

    if (!Array.isArray(tags)) {
      return new NextResponse(JSON.stringify({ error: "Tags must be an array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const redisClient = getRedisClient();
    if (!redisClient) {
      return new NextResponse(JSON.stringify({ success: true, warning: "Redis not available", cached: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    await redisClient.set(`ai-tags:${placeId}`, tags, { ex: 86400 * 30 });
    
    return new NextResponse(JSON.stringify({ success: true, placeId, tags }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error(`[AI-TAGS POST ERROR] placeId: ${placeId}`, error);
    return new NextResponse(JSON.stringify({ error: "Failed to save tags", detail: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

