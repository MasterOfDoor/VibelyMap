import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/utils/supabase";

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

// GET: Profile bilgilerini Supabase'den getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
      );
    }

    const normalizedAddress = address.toLowerCase();
    
    const { data, error } = await supabase
      .from("username")
      .select("*")
      .eq("address", normalizedAddress)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 is "no rows found"
      console.error("[Profile API] Supabase error:", error);
      throw error;
    }

    return setCorsHeaders(NextResponse.json({ profile: data || null }));
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

    const normalizedAddress = address.toLowerCase();

    // 1. Kullanıcı adının başkası tarafından alınıp alınmadığını kontrol et
    const { data: existingUser, error: checkError } = await supabase
      .from("username")
      .select("address")
      .eq("username", normalizedUsername)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existingUser && existingUser.address !== normalizedAddress) {
      return setCorsHeaders(
        NextResponse.json({ error: "Username is already taken" }, { status: 409 })
      );
    }

    // 2. Upsert (Oluştur veya Güncelle)
    const { data: profile, error: upsertError } = await supabase
      .from("username")
      .upsert({
        address: normalizedAddress,
        username: normalizedUsername,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (upsertError) {
      console.error("[Profile API] Upsert error:", upsertError);
      throw upsertError;
    }

    return setCorsHeaders(NextResponse.json({ success: true, profile }));
  } catch (error: any) {
    console.error("[Profile API] POST error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Failed to save profile", detail: error.message }, { status: 500 })
    );
  }
}
