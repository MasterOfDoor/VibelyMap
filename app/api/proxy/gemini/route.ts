import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// CORS headers - Next.js aynı domain'de olduğu için aslında gerekli değil
// Ancak güvenlik için sadece kendi domain'imizle sınırlıyoruz
function setCorsHeaders(response: NextResponse) {
  // Production'da kendi domain'inizi buraya ekleyin
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

// Base64 string'den prefix'i temizle (data:image/jpeg;base64, gibi)
function cleanBase64Data(base64String: string): string {
  // Eğer prefix varsa (virgülden sonrasını al), yoksa olduğu gibi bırak
  if (base64String.includes(",")) {
    return base64String.split(",")[1];
  }
  return base64String;
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
    
    // Fotoğraf base64 data'larını ekle (prefix temizleme ile)
    photoUrls.forEach((base64WithPrefix: string) => {
      const base64Data = cleanBase64Data(base64WithPrefix);
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data, // Temizlenmiş base64 string
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
      generationConfig: {
        response_mime_type: "application/json",
      },
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
    const candidate = data.candidates?.[0];
    
    // Safety filtre kontrolü
    if (candidate?.finishReason === "SAFETY") {
      console.warn("[Gemini API] Content blocked by safety filters");
      return setCorsHeaders(
        NextResponse.json(
          { 
            error: "safety_filter_blocked",
            text: "İçerik güvenlik filtresine takıldı." 
          },
          { status: 200 }
        )
      );
    }

    // Finish reason kontrolü
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      console.warn(`[Gemini API] Unexpected finish reason: ${candidate.finishReason}`);
    }

    const text = candidate?.content?.parts?.[0]?.text || "Cevap üretilemedi.";

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

