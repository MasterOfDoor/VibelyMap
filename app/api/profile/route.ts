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
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// GET: Profile bilgilerini getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
      );
    }

    if (!redis) {
      return setCorsHeaders(NextResponse.json({ error: "Database not configured" }, { status: 500 }));
    }

    const normalizedAddress = address.toLowerCase();
    const profile = await redis.get(`${PROFILE_KEY_PREFIX}${normalizedAddress}`);

    return setCorsHeaders(NextResponse.json({ profile: profile || null }));
  } catch (error: any) {
    console.error("[Profile API] GET error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Failed to fetch profile", detail: error.message }, { status: 500 })
    );
  }
}

// POST: Profil oluştur veya güncelle (Kullanıcı adı ayarla)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, username } = body;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
      );
    }

    // Kullanıcı adı validasyonu
    if (!username || typeof username !== "string" || username.length < 3 || username.length > 20) {
      return setCorsHeaders(
        NextResponse.json({ error: "Username must be between 3 and 20 characters" }, { status: 400 })
      );
    }

    const normalizedUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Username can only contain letters, numbers and underscores" }, { status: 400 })
      );
    }

    if (!redis) {
      return setCorsHeaders(NextResponse.json({ error: "Database not configured" }, { status: 500 }));
    }

    const normalizedAddress = address.toLowerCase();

    // 1. Kullanıcı adının başkası tarafından alınıp alınmadığını kontrol et
    const existingAddress = await redis.get<string>(`${USERNAME_KEY_PREFIX}${normalizedUsername}`);
    
    if (existingAddress && existingAddress !== normalizedAddress) {
      return setCorsHeaders(
        NextResponse.json({ error: "Username is already taken" }, { status: 409 })
      );
    }

    // 2. Mevcut profili al (avatarUrl vb. kaybolmasın diye)
    const existingProfile = await redis.get<any>(`${PROFILE_KEY_PREFIX}${normalizedAddress}`) || {};
    
    // 3. Eğer kullanıcı adı değişiyorsa eski kullanıcı adı kaydını sil
    if (existingProfile.username && existingProfile.username.toLowerCase() !== normalizedUsername) {
      await redis.del(`${USERNAME_KEY_PREFIX}${existingProfile.username.toLowerCase()}`);
    }

    // 4. Yeni profili oluştur/güncelle
    const newProfile = {
      ...existingProfile,
      address: normalizedAddress,
      username: normalizedUsername, // Display version or just normalized
      updatedAt: new Date().toISOString(),
      createdAt: existingProfile.createdAt || new Date().toISOString(),
    };

    // 5. İşlemleri Redis'te atomik olarak yapmaya çalış (transaction olmasa da sırayla güvenli)
    await redis.set(`${PROFILE_KEY_PREFIX}${normalizedAddress}`, newProfile);
    await redis.set(`${USERNAME_KEY_PREFIX}${normalizedUsername}`, normalizedAddress);

    return setCorsHeaders(NextResponse.json({ success: true, profile: newProfile }));
  } catch (error: any) {
    console.error("[Profile API] POST error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Failed to save profile", detail: error.message }, { status: 500 })
    );
  }
}
