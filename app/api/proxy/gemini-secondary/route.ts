import { NextRequest, NextResponse } from "next/server";

const SECOND_GEMINI_API = process.env.SECOND_GEMINI_API || "";

function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function cleanBase64Data(base64String: string): string {
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
  if (!SECOND_GEMINI_API) {
    return setCorsHeaders(
      NextResponse.json({ error: "missing_second_gemini_key" }, { status: 500 })
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

    // Gemini 3 Flash Preview API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${SECOND_GEMINI_API}`;

    const parts: any[] = [];
    
    photoUrls.forEach((base64WithPrefix: string) => {
      const base64Data = cleanBase64Data(base64WithPrefix);
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      });
    });

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
      console.error("[Gemini Secondary API] Error:", error);
      return setCorsHeaders(
        NextResponse.json(
          { error: "gemini_secondary_api_failed", detail: error },
          { status: response.status }
        )
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    if (candidate?.finishReason === "SAFETY") {
      console.warn("[Gemini Secondary API] Content blocked by safety filters");
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

    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      console.warn(`[Gemini Secondary API] Unexpected finish reason: ${candidate.finishReason}`);
    }

    const text = candidate?.content?.parts?.[0]?.text || "Cevap üretilemedi.";

    return setCorsHeaders(NextResponse.json({ text }));
  } catch (error: any) {
    console.error("[Gemini Secondary Proxy] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}
