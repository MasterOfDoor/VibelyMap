import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return setCorsHeaders(
      NextResponse.json({ error: "missing_gemini_key" }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { photoUrls, prompt } = body;

    if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
      return setCorsHeaders(
        NextResponse.json({ error: "missing_photo_urls" }, { status: 400 })
      );
    }

    if (!prompt) {
      return setCorsHeaders(
        NextResponse.json({ error: "missing_prompt" }, { status: 400 })
      );
    }

    // Gemini API'ye istek gönder
    const geminiUrl = `https://generativeai.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

    // Fotoğrafları Gemini formatına çevir
    const parts: any[] = [];
    
    // Fotoğraf base64 data'larını ekle
    photoUrls.forEach((base64Data: string) => {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data, // Base64 string (data:image/jpeg;base64, prefix'i olmadan)
        },
      });
    });

    // Prompt'u ekle
    parts.push({
      text: prompt,
    });

    const geminiRequest = {
      contents: [
        {
          parts: parts,
        },
      ],
    };

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiRequest),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("[Gemini API] Error:", error);
      return setCorsHeaders(
        NextResponse.json(
          { error: "gemini_api_failed", detail: error },
          { status: response.status }
        )
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return setCorsHeaders(NextResponse.json({ text }));
  } catch (error: any) {
    console.error("[Gemini Proxy] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}

