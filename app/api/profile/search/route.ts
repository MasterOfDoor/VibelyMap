import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/utils/supabase";

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

    const normalizedQuery = query.toLowerCase().trim();

    // 1. Eğer sorgu bir wallet adresi ise (0x...)
    if (normalizedQuery.match(/^0x[a-fA-F0-9]{40}$/)) {
      const { data, error } = await supabase
        .from("username")
        .select("*")
        .eq("address", normalizedQuery);

      if (error) throw error;
      return setCorsHeaders(NextResponse.json({ results: data || [] }));
    }

    // 2. Kullanıcı adı araması (fuzzy search using ilike)
    const { data, error } = await supabase
      .from("username")
      .select("*")
      .ilike("username", `%${normalizedQuery}%`)
      .limit(10);

    if (error) {
      console.error("[Profile Search API] Supabase error:", error);
      throw error;
    }

    return setCorsHeaders(NextResponse.json({ results: data || [] }));
  } catch (error: any) {
    console.error("[Profile Search API] error:", error);
    return setCorsHeaders(
      NextResponse.json({ error: "Search failed", detail: error.message }, { status: 500 })
    );
  }
}
