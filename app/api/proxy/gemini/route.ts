import { NextRequest, NextResponse } from "next/server";
import { log } from "@/app/utils/logger";

// Next.js API route timeout limitini artır (60 saniye)
// 6 fotoğraf x ~1-2MB = ~6-12MB payload için yeterli süre
export const maxDuration = 60;

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
    log.geminiError("GEMINI_API_KEY environment variable is missing", {
      action: "api_key_check",
    });
    return setCorsHeaders(
      NextResponse.json({ error: "missing_gemini_key", message: "GEMINI_API_KEY environment variable is not set" }, { status: 500 })
    );
  }
  
  log.gemini("API request received", {
    action: "request_received",
    apiKeyLength: GEMINI_API_KEY.length,
  });

  try {
    // Request body size kontrolü
    const contentType = request.headers.get("content-type");
    const contentLength = request.headers.get("content-length");
    let bodySizeMB = 0;
    if (contentLength) {
      bodySizeMB = parseInt(contentLength) / (1024 * 1024);
      log.gemini("Request body size", {
        action: "body_size_check",
        sizeMB: parseFloat(bodySizeMB.toFixed(2)),
      });
      if (bodySizeMB > 10) {
        log.geminiError("Request body size exceeds 10MB limit", {
          action: "body_size_warning",
          sizeMB: parseFloat(bodySizeMB.toFixed(2)),
        });
      }
    }

    const body = await request.json();
    const { photoUrls, prompt } = body;
    
    log.gemini("Request parsed", {
      action: "request_parsed",
      photoCount: photoUrls?.length || 0,
      promptLength: prompt?.length || 0,
      bodySizeMB: parseFloat(bodySizeMB.toFixed(2)),
    });

    if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
      log.geminiError("Missing photo URLs", {
        action: "validation_error",
        photoUrls: photoUrls,
      });
      return setCorsHeaders(
        NextResponse.json({ error: "missing_photo_urls" }, { status: 400 })
      );
    }

    if (!prompt) {
      log.geminiError("Missing prompt", {
        action: "validation_error",
      });
      return setCorsHeaders(
        NextResponse.json({ error: "missing_prompt" }, { status: 400 })
      );
    }

    // Gemini API'ye istek gönder
    // Model: gemini-1.5-flash (daha hızlı ve ucuz) veya gemini-1.5-pro-latest (daha güçlü)
    // v1beta endpoint'i için gemini-1.5-flash kullanıyoruz
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    log.gemini("Preparing API request", {
      action: "prepare_request",
      url: geminiUrl.split("?")[0], // API key'i gizle
      photoCount: photoUrls.length,
    });

    // Fotoğrafları Gemini formatına çevir
    const parts: any[] = [];
    
    // Fotoğraf base64 data'larını ekle (prefix temizleme ile)
    const cleanedPhotoUrls = photoUrls.map((url: string) => cleanBase64Data(url));
    
    cleanedPhotoUrls.forEach((base64Data: string, index: number) => {
      parts.push({
        inlineData: {
          mime_type: "image/jpeg", // mimeType yerine mime_type kullan (Google API dokümantasyonu)
          data: base64Data, // Temizlenmiş base64 string
        },
      });
      log.debug(`Photo ${index + 1} processed`, {
        action: "photo_processed",
        photoIndex: index + 1,
        base64Length: base64Data.length,
      });
    });

    // Prompt'u ekle
    parts.push({
      text: prompt,
    });
    
    log.gemini("Request parts prepared", {
      action: "request_prepared",
      totalParts: parts.length,
      photoParts: cleanedPhotoUrls.length,
      textParts: 1,
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

    log.gemini("Sending request to Gemini API", {
      action: "api_request",
      url: geminiUrl.split("?")[0],
    });

    const startTime = Date.now();
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiRequest),
    });
    const duration = Date.now() - startTime;

    if (!response.ok) {
      // Detaylı hata bilgisi al
      const errorBody = await response.json().catch(async () => {
        // JSON parse edilemezse text olarak oku
        const errorText = await response.text().catch(() => "Unknown error");
        return { error: { message: errorText, raw: errorText } };
      });
      
      // Detaylı hata loglama
      console.error("GOOGLE API DETAYLI HATA:", JSON.stringify(errorBody, null, 2));
      
      log.geminiError("Gemini API request failed", {
        action: "api_error",
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        error: errorBody,
        errorCode: errorBody.error?.code,
        errorMessage: errorBody.error?.message,
        url: geminiUrl.split("?")[0],
      });
      
      // Hata koduna göre özel mesajlar
      let errorMessage = errorBody.error?.message || "Detay alınamadı";
      let errorCode = errorBody.error?.code;
      
      // Yaygın hata kodları için özel mesajlar
      if (response.status === 413) {
        errorMessage = "Payload Too Large - Fotoğraf sayısını azaltın veya çözünürlüğü düşürün";
      } else if (response.status === 400) {
        errorMessage = errorBody.error?.message || "Invalid Argument - Base64 formatını kontrol edin";
      } else if (response.status === 429) {
        errorMessage = "Too Many Requests - İstek hızını azaltın";
      }
      
      return setCorsHeaders(
        NextResponse.json(
          { 
            error: "gemini_api_failed", 
            detail: errorMessage,
            code: errorCode,
            status: response.status,
            fullError: errorBody // Debug için tam hata detayı
          }, 
          { status: response.status }
        )
      );
    }
    
    log.gemini("Gemini API request successful", {
      action: "api_success",
      status: response.status,
      duration: `${duration}ms`,
    });

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    log.gemini("Response received", {
      action: "response_received",
      hasCandidate: !!candidate,
      finishReason: candidate?.finishReason,
    });
    
    // Safety filtre kontrolü
    if (candidate?.finishReason === "SAFETY") {
      log.geminiError("Content blocked by safety filters", {
        action: "safety_filter",
        finishReason: candidate.finishReason,
      });
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
      log.warn("Unexpected finish reason", {
        action: "finish_reason_warning",
        finishReason: candidate.finishReason,
      });
    }

    const text = candidate?.content?.parts?.[0]?.text || "Cevap üretilemedi.";
    
    log.gemini("Response processed successfully", {
      action: "response_processed",
      textLength: text.length,
      hasText: !!text,
    });

    return setCorsHeaders(NextResponse.json({ text }));
  } catch (error: any) {
    log.geminiError("Proxy error", {
      action: "proxy_error",
      errorMessage: error.message,
      errorName: error.name,
    }, error);
    return setCorsHeaders(
      NextResponse.json(
        { error: "proxy_failed", detail: error.message },
        { status: 500 }
      )
    );
  }
}

