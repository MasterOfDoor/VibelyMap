import { NextRequest, NextResponse } from "next/server";

const GPT5_API_KEY = process.env.GPT5_API_KEY || process.env.OPENAI_API_KEY || "";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

// Base64 string'den prefix'i temizle (data:image/jpeg;base64, gibi)
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
  if (!GPT5_API_KEY) {
    return setCorsHeaders(
      NextResponse.json({ error: "missing_openai_key" }, { status: 500 })
    );
  }

  try {
    // Request body size kontrolü
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      console.log("[ChatGPT Proxy] Request body size:", sizeInMB.toFixed(2), "MB");
      if (sizeInMB > 10) {
        console.warn("[ChatGPT Proxy] Request body size exceeds 10MB limit");
      }
    }

    const body = await request.json();
    const { photoUrls, prompt } = body;
    
    console.log("[ChatGPT Proxy] Received request:", {
      photoCount: photoUrls?.length || 0,
      promptLength: prompt?.length || 0,
    });

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

    // Base64 verilerini temizle
    const cleanedPhotoUrls = photoUrls.map((url: string) => cleanBase64Data(url));

    // OpenAI Chat Completions API formatına çevir (gpt-4o-2024-05-13 vision modeli için)
    // Fotoğrafları base64 data URL formatında hazırla
    const imageContents = cleanedPhotoUrls.map((base64Data: string) => ({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Data}`,
      },
    }));

    // OpenAI Chat Completions API request formatı
    const openaiRequest = {
      model: "gpt-4o-2024-05-13",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            ...imageContents,
          ],
        },
      ],
      response_format: { type: "json_object" }, // JSON formatında cevap iste
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT5_API_KEY}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      // Önce text olarak oku, sonra JSON parse et
      const errorText = await response.text().catch(() => "Unknown error");
      let errorDetail: any;
      try {
        errorDetail = JSON.parse(errorText);
      } catch {
        errorDetail = { error: errorText || "Unknown error", raw: errorText };
      }
      console.error("[ChatGPT API] Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorDetail,
      });
      return setCorsHeaders(
        NextResponse.json(
          { error: "chatgpt_api_failed", detail: errorDetail },
          { status: response.status }
        )
      );
    }

    const data = await response.json();
    
    // OpenAI Chat Completions API'den gelen format: { choices: [{ message: { content: "..." } }] }
    const outputText = data.choices?.[0]?.message?.content || data.output_text || data.text || "";

    if (!outputText) {
      console.warn("[ChatGPT API] Boş cevap alındı");
      return setCorsHeaders(
        NextResponse.json(
          { error: "empty_response", text: "" },
          { status: 200 }
        )
      );
    }

    return setCorsHeaders(NextResponse.json({ output_text: outputText, text: outputText }));
  } catch (error: any) {
    console.error("[ChatGPT Proxy] Error:", error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}

