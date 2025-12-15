import { NextRequest, NextResponse } from "next/server";

const GPT5_API_KEY = process.env.GPT5_API_KEY || process.env.OPENAI_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// Input validation - daha esnek
function validateAIRequest(body: any, provider: string): { valid: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  if (provider === "openai" || provider === "gpt") {
    // Model kontrolü - opsiyonel, OpenAI varsayılan kullanabilir
    // if (!body.model || typeof body.model !== "string") {
    //   return { valid: false, error: "Model is required" };
    // }
    if (!body.messages || !Array.isArray(body.messages)) {
      return { valid: false, error: "Messages array is required" };
    }
    // Prompt uzunluğu kontrolü (güvenlik için) - 5MB limit (fotoğraflar için)
    const totalLength = JSON.stringify(body).length;
    if (totalLength > 5000000) { // ~5MB limit
      return { valid: false, error: "Request too large" };
    }
  } else if (provider === "gemini") {
    if (!body.contents || !Array.isArray(body.contents)) {
      return { valid: false, error: "Contents array is required" };
    }
    const totalLength = JSON.stringify(body).length;
    if (totalLength > 5000000) { // ~5MB limit
      return { valid: false, error: "Request too large" };
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get("provider") || "openai";

  try {
    // Debug: aktif key/proje bilgisi (prefix ile, tam key yok)
    console.log("AI proxy provider:", provider);
    console.log("OPENAI_API_KEY prefix:", (process.env.OPENAI_API_KEY || process.env.GPT5_API_KEY || "").slice(0, 7));
    console.log("OPENAI_PROJECT:", process.env.OPENAI_PROJECT || "n/a");

    const body = await request.json();
    
    // Input validation - daha detaylı hata mesajları için log
    const validation = validateAIRequest(body, provider);
    if (!validation.valid) {
      console.error("AI validation error:", {
        provider,
        error: validation.error,
        bodyKeys: Object.keys(body || {}),
        hasMessages: !!body?.messages,
        hasContents: !!body?.contents
      });
      return setCorsHeaders(
        NextResponse.json({ 
          error: validation.error,
          details: `Provider: ${provider}, Body keys: ${Object.keys(body || {}).join(", ")}`
        }, { status: 400 })
      );
    }

    if (provider === "openai" || provider === "gpt" || provider === "responses") {
      if (!GPT5_API_KEY) {
        return setCorsHeaders(
          NextResponse.json({ error: "missing_gpt_key" }, { status: 500 })
        );
      }

      // responses endpoint (OpenAI new API)
      const isResponses = provider === "responses";
      const url = isResponses
        ? "https://api.openai.com/v1/responses"
        : "https://api.openai.com/v1/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GPT5_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      // OpenAI hata durumlarını logla
      if (!response.ok) {
        console.error("OpenAI API error:", {
          status: response.status,
          statusText: response.statusText,
          error: data.error || data
        });
      }
      
      return setCorsHeaders(NextResponse.json(data, { status: response.status }));
    } else if (provider === "gemini") {
      if (!GEMINI_API_KEY) {
        return setCorsHeaders(
          NextResponse.json(
            { error: "missing_gemini_key" },
            { status: 500 }
          )
        );
      }

      // Resmi endpoint: v1beta/models/gemini-1.5-flash:generateContent
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      // Gemini hata durumlarını logla
      if (!response.ok) {
        console.error("Gemini API error:", {
          status: response.status,
          statusText: response.statusText,
          error: data.error || data
        });
      }
      
      return setCorsHeaders(NextResponse.json(data, { status: response.status }));
    }

    return setCorsHeaders(
      NextResponse.json({ error: "invalid_provider" }, { status: 400 })
    );
  } catch (error: any) {
    console.error("AI proxy error:", {
      message: error.message,
      stack: error.stack,
      provider
    });
    // Güvenlik: Detaylı hata mesajlarını client'a gönderme
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", message: error.message },
        { status: 502 }
      )
    );
  }
}

