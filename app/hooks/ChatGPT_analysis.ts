"use client";

import { Place } from "../components/DetailPanel";
import { log } from "@/app/utils/logger";

const SYSTEM_PROMPT = `Sen bir kafe/mekan fotoğraf analiz asistanısın. Görevin, verilen FOTOĞRAFLARDA sadece kesin olarak gördüğün bilgileri çıkarmaktır. EMİN OLMADIĞIN HİÇBİR BİLGİ İÇİN ALAN OLUŞTURMA, TAHMİN YAPMA.

ÇIKTI ALANLARI (sadece gördüğün net kanıta göre doldur):
- mekan_isiklandirma: 1 | 2 | 3 | 4 | 5
- ambiyans: { "retro": true/false, "modern": true/false }
- masada_priz_var_mi: 1 | 2 | 3 | 4
- koltuk_var_mi: 0 | 1 | 2 | 3
- sigara_iciliyor: true
- sigara_alani: ["acik", "kapali"]
- deniz_manzarasi: true

KURALLAR:
- Emin değilsen ilgili alanı HİÇ yazma.
- Sigara: sadece kanıt varsa yaz; açık/kapalı alan ayrımını sigara_alani listesinde belirt.
- Mekan ışıklandırması için 1 canlı, 3 doğal, 5 loş olacak biçimde ara değer olursa ara değer verebilir.
- Koltuk için 0 yok, 1 az, 2 orta, 3 mekan genelinde koltuk var.
- Priz için 1 az (birkaç priz var), 2 orta (orta düzeyde priz var), 3 var (yeterli priz var), 4 masada priz (masalarda priz var).
- Ambiyans retro/modern boolean; ikisi de yoksa ambiyans alanını yazma.
- Deniz varlığı için kesin kanıt ara ışık yansıması yetersiz.
- Fotoğrafın sabah olması Canlı veya doğal olduğu anlamına gelmez daha iyi analiz için diğer fotoğraflarıda incele.

ÇIKTI: Her zaman tek bir JSON nesnesi döndür, JSON dışında hiçbir şey yazma.`;

interface PhotoAnalysisResult {
  mekan_isiklandirma?: 1 | 2 | 3 | 4 | 5;
  ambiyans?: {
    retro?: boolean;
    modern?: boolean;
  };
  masada_priz_var_mi?: 1 | 2 | 3 | 4;
  koltuk_var_mi?: 0 | 1 | 2 | 3;
  sigara_iciliyor?: boolean;
  sigara_alani?: ("acik" | "kapali")[];
  deniz_manzarasi?: boolean;
}

// Fotoğrafı resize et (maksimum 1024px genişlik)
function resizeImage(
  image: HTMLImageElement,
  maxWidth: number = 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    // Orijinal boyutları al
    let width = image.width;
    let height = image.height;

    // Eğer genişlik maksimumdan büyükse, orantılı olarak küçült
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    // Canvas boyutlarını ayarla
    canvas.width = width;
    canvas.height = height;

    // Fotoğrafı canvas'a çiz (yüksek kalite ile)
    ctx.drawImage(image, 0, 0, width, height);

    // JPEG formatında base64'e çevir (kalite: 0.85 - iyi kalite/düşük boyut dengesi)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    resolve(dataUrl);
  });
}

// Fotoğraf URL'ini yükle, resize et ve base64 data URL'e çevir
async function fetchPhotoAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Photo fetch failed");
    const blob = await response.blob();

    // Blob'u Image objesine çevir
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // CORS için
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });

    // Resize et ve base64'e çevir
    const resizedDataUrl = await resizeImage(image, 1024);

    // Object URL'i temizle
    URL.revokeObjectURL(image.src);

    return resizedDataUrl;
  } catch (error: any) {
    log.analysisError("Photo fetch/resize error (ChatGPT)", {
      action: "photo_fetch_resize_error",
      url: url.substring(0, 50) + "...",
    }, error);
    return null;
  }
}

// Analiz sonuçlarını filtreleme seçeneklerine çevir
function convertAnalysisToTags(result: PhotoAnalysisResult): string[] {
  const tags: string[] = [];

  // Işıklandırma (1-5 arası değer)
  if (typeof result.mekan_isiklandirma === "number") {
    const isikValue = result.mekan_isiklandirma;
    if (isikValue >= 1 && isikValue <= 5) {
      tags.push(`Işıklandırma ${isikValue}`);
    }
  }

  // Ambiyans
  if (result.ambiyans?.retro) {
    tags.push("Retro");
  }
  if (result.ambiyans?.modern) {
    tags.push("Modern");
  }

  // Priz (1-4 arası değer)
  if (typeof result.masada_priz_var_mi === "number") {
    const prizValue = result.masada_priz_var_mi;
    if (prizValue === 1) {
      tags.push("Priz Az");
    } else if (prizValue === 2) {
      tags.push("Priz Orta");
    } else if (prizValue === 3) {
      tags.push("Priz Var");
    } else if (prizValue === 4) {
      tags.push("Masada priz");
    }
  }

  // Koltuk (0-3 arası değer)
  if (typeof result.koltuk_var_mi === "number") {
    const koltukValue = result.koltuk_var_mi;
    if (koltukValue === 0) {
      tags.push("Koltuk yok");
    } else if (koltukValue === 1) {
      tags.push("Koltuk az");
    } else if (koltukValue === 2) {
      tags.push("Koltuk orta");
    } else if (koltukValue === 3) {
      tags.push("Koltuk var");
    }
  }

  // Sigara
  if (result.sigara_iciliyor) {
    if (result.sigara_alani?.includes("acik")) {
      tags.push("Sigara icilebilir");
    } else if (result.sigara_alani?.includes("kapali")) {
      tags.push("Kapali alanda sigara icilebilir");
    }
  }

  // Deniz
  if (result.deniz_manzarasi) {
    tags.push("Deniz goruyor");
  }

  return tags;
}

// Depodan AI etiketlerini oku
async function getCachedAITags(placeId: string): Promise<string[] | null> {
  try {
    const response = await fetch(`/api/ai-tags/${encodeURIComponent(placeId)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      log.storage("Tags found in cache (ChatGPT)", {
        action: "cache_hit",
        placeId,
        tagsCount: data.tags.length,
      });
      return data.tags;
    }
    return null;
  } catch (error: any) {
    // 404 is expected if tags don't exist yet - not an error
    if (error?.message?.includes("404") || (error as any)?.status === 404) {
      log.storage("No cached tags found (404 expected)", {
        action: "cache_miss",
        placeId,
      });
      return null;
    }
    log.storageError("Cache check error (ChatGPT)", {
      action: "cache_check_exception",
      placeId,
    }, error);
    return null;
  }
}

// AI etiketlerini depoya kaydet
async function saveAITags(placeId: string, tags: string[]): Promise<void> {
  try {
    log.storage("Saving tags to cache (ChatGPT)", {
      action: "cache_save",
      placeId,
      tagsCount: tags.length,
    });
    
    const response = await fetch(`/api/ai-tags/${encodeURIComponent(placeId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
    });
    if (response.ok) {
      log.storage("Tags saved to cache successfully (ChatGPT)", {
        action: "cache_save_success",
        placeId,
        tagsCount: tags.length,
      });
    } else {
      const errorText = await response.text();
      log.storageError("Cache save failed (ChatGPT)", {
        action: "cache_save_error",
        placeId,
        status: response.status,
        error: errorText,
      });
    }
  } catch (error: any) {
    log.storageError("Cache save exception (ChatGPT)", {
      action: "cache_save_exception",
      placeId,
    }, error);
  }
}

// Tek bir mekan için fotoğraf analizi yap (ChatGPT ile, hata durumunda Gemini fallback)
export async function analyzePlacePhotos(place: Place): Promise<string[]> {
  log.analysis("Starting photo analysis", {
    action: "analysis_start",
    placeId: place.id,
    placeName: place.name,
  });
  
  // Önce depodan kontrol et
  const cachedTags = await getCachedAITags(place.id);
  if (cachedTags) {
    log.analysis("Using cached tags, skipping analysis", {
      action: "analysis_skipped",
      placeId: place.id,
      placeName: place.name,
      tagsCount: cachedTags.length,
    });
    return cachedTags;
  }
  
  log.analysis("No cached tags found, proceeding with analysis", {
    action: "analysis_proceed",
    placeId: place.id,
    placeName: place.name,
  });
  
  try {
    // ChatGPT analiz fonksiyonunu çağır
    const tags = await analyzePlacePhotosWithChatGPT(place);
    
    log.analysis("Analysis completed successfully", {
      action: "analysis_success",
      placeId: place.id,
      placeName: place.name,
      tagsCount: tags.length,
      tags: tags,
    });
    
    // Etiketleri depoya kaydet
    if (tags.length > 0) {
      await saveAITags(place.id, tags);
    }
    
    return tags;
  } catch (chatgptError: any) {
    // ChatGPT başarısız oldu, Gemini fallback'e geç
    log.chatgptError("ChatGPT analysis failed, falling back to Gemini", {
      action: "chatgpt_fallback",
      placeId: place.id,
      placeName: place.name,
      error: chatgptError.message,
    }, chatgptError);
    
    try {
      // Gemini analiz fonksiyonunu import et ve kullan
      const { analyzePlacePhotosWithGemini } = await import("./Gemini_analysis");
      
      log.gemini("Starting Gemini fallback analysis", {
        action: "gemini_fallback_start",
        placeId: place.id,
        placeName: place.name,
      });
      
      const tags = await analyzePlacePhotosWithGemini(place);
      
      log.gemini("Gemini fallback analysis completed", {
        action: "gemini_fallback_success",
        placeId: place.id,
        placeName: place.name,
        tagsCount: tags.length,
      });
      
      // Etiketleri depoya kaydet
      if (tags.length > 0) {
        await saveAITags(place.id, tags);
      }
      
      return tags;
    } catch (geminiError: any) {
      // Her iki API de başarısız oldu
      log.analysisError("Both ChatGPT and Gemini failed", {
        action: "all_apis_failed",
        placeId: place.id,
        placeName: place.name,
        chatgptError: chatgptError.message,
        geminiError: geminiError.message,
      }, geminiError);
      return [];
    }
  }
}

// Tek bir mekan için fotoğraf analizi yap (sadece ChatGPT ile, fallback yok)
// NOT: Cache kontrolü analyzePlacePhotos() fonksiyonunda yapılıyor, burada yapılmıyor
export async function analyzePlacePhotosWithChatGPT(place: Place): Promise<string[]> {
  log.chatgpt("Starting ChatGPT analysis", {
    action: "chatgpt_analysis_start",
    placeId: place.id,
    placeName: place.name,
  });
  
  try {
    // Fotoğraf URL'lerini topla
    const photoUrls: string[] = [
      ...(place.photos || []),
      ...(place.photo ? [place.photo] : []),
    ].filter(Boolean).slice(0, 6); // Maksimum 6 fotoğraf

    if (photoUrls.length === 0) {
      log.chatgptError("No photos available for analysis", {
        action: "chatgpt_no_photos",
        placeId: place.id,
        placeName: place.name,
      });
      return [];
    }

    console.log("[ChatGPT Analysis] Analiz başlatılıyor:", place.name, "Fotoğraf sayısı:", photoUrls.length);

    // Fotoğrafları base64 data URL'e çevir
    const photoDataUrls: string[] = [];
    for (const url of photoUrls) {
      const dataUrl = await fetchPhotoAsDataUrl(url);
      if (dataUrl) {
        // Base64 kısmını al (data:image/jpeg;base64, kısmını çıkar)
        const base64Data = dataUrl.split(",")[1];
        if (base64Data) {
          photoDataUrls.push(base64Data);
        }
      }
    }

    if (photoDataUrls.length === 0) {
      log.chatgptError("Failed to load photos", {
        action: "chatgpt_photo_load_failed",
        placeId: place.id,
        placeName: place.name,
      });
      return [];
    }

    // Prompt oluştur
    const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

    log.chatgpt("Sending request to ChatGPT API", {
      action: "chatgpt_api_request",
      placeId: place.id,
      placeName: place.name,
      photoCount: photoDataUrls.length,
    });

    // ChatGPT API'ye istek gönder
    const startTime = Date.now();
    const response = await fetch("/api/proxy/chatgpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photoUrls: photoDataUrls,
        prompt,
      }),
    });

    if (!response.ok) {
      const duration = Date.now() - startTime;
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      log.chatgptError("ChatGPT API request failed", {
        action: "chatgpt_api_error",
        placeId: place.id,
        placeName: place.name,
        duration: `${duration}ms`,
        error: error,
      });
      throw new Error(`ChatGPT API failed: ${error.error || "Unknown error"}`);
    }

    const duration = Date.now() - startTime;
    const data = await response.json();
    const text = data.output_text || data.text || "";

    if (!text) {
      log.chatgptError("Empty response from ChatGPT", {
        action: "chatgpt_empty_response",
        placeId: place.id,
        placeName: place.name,
      });
      throw new Error("Empty response from ChatGPT");
    }

    // JSON'u parse et
    let result: PhotoAnalysisResult;
    try {
      // JSON'u temizle (eğer markdown code block içindeyse)
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      result = JSON.parse(cleanedText);
    } catch (error: any) {
      log.chatgptError("JSON parse error", {
        action: "chatgpt_json_parse_error",
        placeId: place.id,
        placeName: place.name,
        textLength: text.length,
      }, error);
      throw new Error("Invalid JSON response from ChatGPT");
    }

    log.chatgpt("ChatGPT analysis completed successfully", {
      action: "chatgpt_analysis_success",
      placeId: place.id,
      placeName: place.name,
      duration: `${duration}ms`,
      resultKeys: Object.keys(result),
    });

    // Sonuçları etiketlere çevir
    const tags = convertAnalysisToTags(result);
    
    log.analysis("Tags converted from ChatGPT result", {
      action: "tags_converted",
      placeId: place.id,
      placeName: place.name,
      tagsCount: tags.length,
      tags: tags,
    });
    
    // Etiketleri depoya kaydet
    if (tags.length > 0) {
      await saveAITags(place.id, tags);
    }
    
    return tags;
  } catch (error: any) {
    log.chatgptError("ChatGPT analysis error", {
      action: "chatgpt_analysis_error",
      placeId: place.id,
      placeName: place.name,
    }, error);
    throw error; // Hata durumunda throw et ki fallback çalışmasın
  }
}

// Toplu cache kontrolü yap
async function getBatchCachedTags(placeIds: string[]): Promise<{ [placeId: string]: string[] }> {
  if (placeIds.length === 0) return {};
  
  try {
    const placeIdsParam = placeIds.join(",");
    const response = await fetch(`/api/ai-tags/batch?placeIds=${encodeURIComponent(placeIdsParam)}`);
    
    if (!response.ok) {
      log.storageError("Batch cache check failed", {
        action: "batch_cache_check_failed",
        status: response.status,
        placeIdsCount: placeIds.length,
      });
      return {};
    }
    
    const data = await response.json();
    return data.cached || {};
  } catch (error: any) {
    log.storageError("Batch cache check exception", {
      action: "batch_cache_check_exception",
      placeIdsCount: placeIds.length,
    }, error);
    return {};
  }
}

// Birden fazla mekan için toplu analiz (optimize edilmiş: önce cache kontrolü, sonra sadece gerekli olanlar için analiz)
export async function analyzePlacesPhotos(places: Place[]): Promise<Map<string, string[]>> {
  const resultMap = new Map<string, string[]>();

  log.analysis("Starting batch analysis", {
    action: "batch_analysis_start",
    placesCount: places.length,
  });

  if (places.length === 0) {
    return resultMap;
  }

  // 1. Önce toplu cache kontrolü yap
  const placeIds = places.map(p => p.id);
  const cachedTags = await getBatchCachedTags(placeIds);
  
  // Cache'den gelen tag'leri resultMap'e ekle
  Object.entries(cachedTags).forEach(([placeId, tags]) => {
    if (tags && tags.length > 0) {
      resultMap.set(placeId, tags);
      log.analysis("Using cached tags for place", {
        action: "batch_cache_hit",
        placeId,
        tagsCount: tags.length,
      });
    }
  });

  // 2. Cache'de olmayan place'leri bul
  const uncachedPlaces = places.filter(place => !cachedTags[place.id]);
  
  log.analysis("Cache check completed", {
    action: "batch_cache_check_complete",
    totalPlaces: places.length,
    cachedCount: Object.keys(cachedTags).length,
    uncachedCount: uncachedPlaces.length,
  });

  // 3. Sadece cache'de olmayan place'ler için analiz yap
  if (uncachedPlaces.length > 0) {
    log.analysis("Starting analysis for uncached places", {
      action: "batch_analysis_uncached_start",
      uncachedCount: uncachedPlaces.length,
    });

    // Paralel analiz (rate limiting için batch'ler halinde)
    const batchSize = 3; // Aynı anda maksimum 3 analiz
    for (let i = 0; i < uncachedPlaces.length; i += batchSize) {
      const batch = uncachedPlaces.slice(i, i + batchSize);
      
      // Batch içindeki place'ler için paralel analiz
      const batchPromises = batch.map(async (place) => {
        try {
          const tags = await analyzePlacePhotos(place);
          if (tags.length > 0) {
            resultMap.set(place.id, tags);
          }
        } catch (error: any) {
          log.analysisError("Place analysis error in batch", {
            action: "batch_analysis_error",
            placeId: place.id,
            placeName: place.name,
          }, error);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Rate limiting için batch'ler arası bekleme
      if (i + batchSize < uncachedPlaces.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  log.analysis("Batch analysis completed", {
    action: "batch_analysis_complete",
    placesCount: places.length,
    resultsCount: resultMap.size,
    cachedCount: Object.keys(cachedTags).length,
    analyzedCount: uncachedPlaces.length,
  });
  
  return resultMap;
}

