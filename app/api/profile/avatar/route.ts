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

// GET: Avatar URL'ini Supabase'den oku
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
      .select("avatar_url")
      .eq("address", normalizedAddress)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[Avatar API] Supabase error:", error);
      throw error;
    }

    return setCorsHeaders(
      NextResponse.json({ url: data?.avatar_url || null })
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

// POST: Avatar URL'ini Supabase'e kaydet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, url } = body;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
      );
    }

    if (!url || typeof url !== "string") {
      return setCorsHeaders(
        NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      );
    }

    const normalizedAddress = address.toLowerCase();

    // avatar_url'i güncelle (eğer profil yoksa önce oluşturulması gerekir ama genelde username modal'dan sonra gelir)
    // Upsert kullanarak eğer kayıt yoksa da oluşturabiliriz (ama username zorunlu olduğu için username kolonu hata verebilir)
    // Bu yüzden update deniyoruz, eğer yoksa opsiyonel olarak insert edebiliriz.
    
    const { error: updateError } = await supabase
      .from("username")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("address", normalizedAddress);

    if (updateError) {
      console.error("[Avatar API] Supabase update error:", updateError);
      throw updateError;
    }

    return setCorsHeaders(
      NextResponse.json({ success: true, updated: true })
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
