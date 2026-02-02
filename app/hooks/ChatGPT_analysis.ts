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

    let width = image.width;
    let height = image.height;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

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

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });

    const resizedDataUrl = await resizeImage(image, 1024);
    URL.revokeObjectURL(image.src);

    return resizedDataUrl;
  } catch (error: any) {
    log.analysisError("Photo fetch/resize error", {
      action: "photo_fetch_resize_error",
      url: url.substring(0, 50) + "...",
    }, error);
    return null;
  }
}

// Analiz sonuçlarını filtreleme seçeneklerine çevir
function convertAnalysisToTags(result: PhotoAnalysisResult): string[] {
  const tags: string[] = [];

  if (typeof result.mekan_isiklandirma === "number") {
    const isikValue = result.mekan_isiklandirma;
    if (isikValue >= 1 && isikValue <= 5) {
      tags.push(`🤖 Işıklandırma ${isikValue}`);
    }
  }

  if (result.ambiyans?.retro) {
    tags.push("🤖 Retro");
  }
  if (result.ambiyans?.modern) {
    tags.push("🤖 Modern");
  }

  if (typeof result.masada_priz_var_mi === "number") {
    const prizValue = result.masada_priz_var_mi;
    if (prizValue === 1) {
      tags.push("🤖 Priz Az");
    } else if (prizValue === 2) {
      tags.push("🤖 Priz Orta");
    } else if (prizValue === 3) {
      tags.push("🤖 Priz Var");
    } else if (prizValue === 4) {
      tags.push("🤖 Masada priz");
    }
  }

  if (typeof result.koltuk_var_mi === "number") {
    const koltukValue = result.koltuk_var_mi;
    if (koltukValue === 0) {
      tags.push("🤖 Koltuk yok");
    } else if (koltukValue === 1) {
      tags.push("🤖 Koltuk az");
    } else if (koltukValue === 2) {
      tags.push("🤖 Koltuk orta");
    } else if (koltukValue === 3) {
      tags.push("🤖 Koltuk var");
    }
  }

  if (result.sigara_iciliyor) {
    if (result.sigara_alani?.includes("acik")) {
      tags.push("🤖 Sigara icilebilir");
    } else if (result.sigara_alani?.includes("kapali")) {
      tags.push("🤖 Kapali alanda sigara icilebilir");
    }
  }

  if (result.deniz_manzarasi) {
    tags.push("🤖 Deniz goruyor");
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
      log.storage("Tags found in cache", {
        action: "cache_hit",
        placeId,
        tagsCount: data.tags.length,
      });
      return data.tags;
    }
    return null;
  } catch (error: any) {
    if (error?.message?.includes("404") || (error as any)?.status === 404) {
      log.storage("No cached tags found (404 expected)", {
        action: "cache_miss",
        placeId,
      });
      return null;
    }
    log.storageError("Cache check error", {
      action: "cache_check_exception",
      placeId,
    }, error);
    return null;
  }
}

// AI etiketlerini depoya kaydet
async function saveAITags(placeId: string, tags: string[]): Promise<void> {
  try {
    log.storage("Saving tags to cache", {
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
      log.storage("Tags saved to cache successfully", {
        action: "cache_save_success",
        placeId,
        tagsCount: tags.length,
      });
    } else {
      const errorText = await response.text();
      log.storageError("Cache save failed", {
        action: "cache_save_error",
        placeId,
        status: response.status,
        error: errorText,
      });
    }
  } catch (error: any) {
    log.storageError("Cache save exception", {
      action: "cache_save_exception",
      placeId,
    }, error);
  }
}

// Gemini API ile analiz yap (primary veya secondary)
async function analyzeWithGeminiAPI(
  place: Place,
  apiEndpoint: "/api/proxy/gemini" | "/api/proxy/gemini-secondary",
  apiName: "Gemini Primary" | "Gemini Secondary"
): Promise<string[]> {
  log.gemini(`Starting ${apiName} analysis`, {
    action: "gemini_analysis_start",
    placeId: place.id,
    placeName: place.name,
    apiEndpoint,
    model: "gemini-3-flash-preview"
  });

  const photoUrls: string[] = [
    ...(place.photos || []),
    ...(place.photo ? [place.photo] : []),
  ].filter(Boolean).slice(0, 9);

  if (photoUrls.length === 0) {
    log.geminiError(`No photos available for ${apiName} analysis`, {
      action: "gemini_no_photos",
      placeId: place.id,
      placeName: place.name,
    });
    return [];
  }

  console.log(`[${apiName}] Analiz başlatılıyor:`, place.name, "Fotoğraf sayısı:", photoUrls.length);

  const photoDataUrls: string[] = [];
  for (const url of photoUrls) {
    const dataUrl = await fetchPhotoAsDataUrl(url);
    if (dataUrl) {
      const base64Data = dataUrl.split(",")[1];
      if (base64Data) {
        photoDataUrls.push(base64Data);
      }
    }
  }

  if (photoDataUrls.length === 0) {
    log.geminiError(`Failed to load photos for ${apiName}`, {
      action: "gemini_photo_load_failed",
      placeId: place.id,
      placeName: place.name,
    });
    return [];
  }

  const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

  const startTime = Date.now();
  const response = await fetch(apiEndpoint, {
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
    log.geminiError(`${apiName} API request failed`, {
      action: "gemini_api_error",
      placeId: place.id,
      placeName: place.name,
      duration: `${duration}ms`,
      error: error,
    });
    throw new Error(`${apiName} API failed: ${error.error || "Unknown error"}`);
  }

  const duration = Date.now() - startTime;
  const data = await response.json();
  const text = data.text || "";

  if (!text) {
    log.geminiError(`Empty response from ${apiName}`, {
      action: "gemini_empty_response",
      placeId: place.id,
      placeName: place.name,
    });
    throw new Error(`Empty response from ${apiName}`);
  }

  let result: PhotoAnalysisResult;
  try {
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    
    result = JSON.parse(cleanedText);
  } catch (error: any) {
    log.geminiError(`${apiName} JSON parse error`, {
      action: "gemini_json_parse_error",
      placeId: place.id,
      placeName: place.name,
      textLength: text.length,
    }, error);
    throw new Error(`Invalid JSON response from ${apiName}`);
  }

  log.gemini(`${apiName} analysis completed successfully`, {
    action: "gemini_analysis_success",
    placeId: place.id,
    placeName: place.name,
    duration: `${duration}ms`,
    resultKeys: Object.keys(result),
  });

  const tags = convertAnalysisToTags(result);
  
  if (tags.length > 0) {
    await saveAITags(place.id, tags);
  }
  
  return tags;
}

// Primary Gemini API ile analiz (GEMINI_API_KEY)
export async function analyzePlacePhotosWithGeminiPrimary(place: Place): Promise<string[]> {
  return analyzeWithGeminiAPI(place, "/api/proxy/gemini", "Gemini Primary");
}

// Secondary Gemini API ile analiz (SECOND_GEMINI_API)
export async function analyzePlacePhotosWithGeminiSecondary(place: Place): Promise<string[]> {
  return analyzeWithGeminiAPI(place, "/api/proxy/gemini-secondary", "Gemini Secondary");
}

// Tek bir mekan için fotoğraf analizi yap (Primary Gemini, hata durumunda Secondary fallback)
export async function analyzePlacePhotos(place: Place): Promise<string[]> {
  log.analysis("Starting photo analysis", {
    action: "analysis_start",
    placeId: place.id,
    placeName: place.name,
  });
  
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
  
  log.analysis("No cached tags found, proceeding with Gemini analysis", {
    action: "analysis_proceed",
    placeId: place.id,
    placeName: place.name,
  });
  
  try {
    const tags = await analyzePlacePhotosWithGeminiPrimary(place);
    
    log.analysis("Analysis completed successfully with Gemini Primary", {
      action: "analysis_success",
      placeId: place.id,
      placeName: place.name,
      tagsCount: tags.length,
      tags: tags,
    });
    
    return tags;
  } catch (primaryError: any) {
    log.geminiError("Gemini Primary failed, falling back to Gemini Secondary", {
      action: "gemini_primary_fallback",
      placeId: place.id,
      placeName: place.name,
      error: primaryError.message,
    }, primaryError);
    
    try {
      const tags = await analyzePlacePhotosWithGeminiSecondary(place);
      
      log.gemini("Gemini Secondary fallback analysis completed", {
        action: "gemini_secondary_fallback_success",
        placeId: place.id,
        placeName: place.name,
        tagsCount: tags.length,
      });
      
      return tags;
    } catch (secondaryError: any) {
      log.analysisError("Both Gemini APIs failed", {
        action: "all_apis_failed",
        placeId: place.id,
        placeName: place.name,
        primaryError: primaryError.message,
        secondaryError: secondaryError.message,
      }, secondaryError);
      return [];
    }
  }
}

// Toplu cache kontrolü yap
async function getBatchCachedTags(placeIds: string[]): Promise<{ [placeId: string]: string[] }> {
  if (placeIds.length === 0) {
    log.storage("Batch cache check skipped (empty placeIds)", {
      action: "batch_cache_check_skip",
    });
    return {};
  }
  
  try {
    const placeIdsParam = placeIds.join(",");
    log.storage("Initiating batch cache check", {
      action: "batch_cache_check_init",
      placeIdsCount: placeIds.length,
    });
    
    const response = await fetch(`/api/ai-tags/batch?placeIds=${encodeURIComponent(placeIdsParam)}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      log.storageError("Batch cache check HTTP error", {
        action: "batch_cache_check_http_error",
        status: response.status,
        statusText: response.statusText,
        placeIdsCount: placeIds.length,
        errorText: errorText.substring(0, 200),
      });
      return {};
    }
    
    const data = await response.json();
    const cached = data.cached || {};
    const cachedCount = Object.keys(cached).length;
    const uncachedCount = data.uncachedCount || (placeIds.length - cachedCount);
    
    log.storage("Batch cache check successful", {
      action: "batch_cache_check_success",
      total: placeIds.length,
      cachedCount,
      uncachedCount,
      cachedPlaceIds: Object.keys(cached).slice(0, 5),
    });
    
    return cached;
  } catch (error: any) {
    log.storageError("Batch cache check exception (continuing without cache)", {
      action: "batch_cache_check_exception",
      placeIdsCount: placeIds.length,
      errorType: error?.constructor?.name || "Unknown",
    }, error);
    return {};
  }
}

export interface BatchAnalysisResult {
  resultMap: Map<string, string[]>;
  cachedVenues: string[];
  newlyAnalyzedVenues: string[];
  failedVenues: string[];
  stats: {
    total: number;
    cached: number;
    newlyAnalyzed: number;
    failed: number;
  };
}

// Birden fazla mekan için toplu analiz
// İki Gemini API kullanarak: Her API 3'er mekan analiz eder, 1 saniye sonra sonraki 3'lü batch başlar
export async function analyzePlacesPhotos(places: Place[]): Promise<Map<string, string[]>> {
  const resultMap = new Map<string, string[]>();
  const cachedVenues: string[] = [];
  const newlyAnalyzedVenues: string[] = [];
  const failedVenues: string[] = [];

  log.analysis("Starting batch analysis with dual Gemini APIs (gemini-3-flash-preview)", {
    action: "batch_analysis_start",
    placesCount: places.length,
  });

  if (places.length === 0) {
    log.analysis("No places to analyze, returning empty result", {
      action: "batch_analysis_empty",
    });
    return resultMap;
  }

  // 1. Önce toplu cache kontrolü yap
  const uniquePlaces = Array.from(new Map(places.map(p => [p.id, p])).values());
  const placeIds = uniquePlaces.map(p => p.id);
  
  log.analysis("Checking cache for venue IDs", {
    action: "cache_check_start",
    uniquePlaceIdsCount: placeIds.length,
    originalPlacesCount: places.length,
  });

  let cachedTags: { [placeId: string]: string[] } = {};
  try {
    cachedTags = await getBatchCachedTags(placeIds);
  } catch (cacheError: any) {
    log.storageError("Batch cache check failed, proceeding with full analysis", {
      action: "batch_cache_check_failed",
      placeIdsCount: placeIds.length,
    }, cacheError);
    cachedTags = {};
  }
  
  // Cache'den gelen tag'leri resultMap'e ekle
  Object.entries(cachedTags).forEach(([placeId, tags]) => {
    if (tags && Array.isArray(tags) && tags.length > 0) {
      resultMap.set(placeId, tags);
      cachedVenues.push(placeId);
      log.analysis("Using cached tags for place (cache hit)", {
        action: "batch_cache_hit",
        placeId,
        tagsCount: tags.length,
        tags: tags.slice(0, 3),
      });
    }
  });

  // 2. Cache'de olmayan place'leri bul
  const uncachedPlaces = uniquePlaces.filter(place => !cachedTags[place.id] || !cachedTags[place.id]?.length);
  
  log.analysis("Cache check completed - venue categorization", {
    action: "batch_cache_check_complete",
    totalPlaces: places.length,
    uniquePlaces: uniquePlaces.length,
    cachedCount: cachedVenues.length,
    uncachedCount: uncachedPlaces.length,
    cachedVenueIds: cachedVenues.slice(0, 10),
  });

  // 3. Cache'de olmayan place'ler için analiz yap (iki Gemini API arasında paylaştır)
  if (uncachedPlaces.length > 0) {
    // Yarısını Primary Gemini, yarısını Secondary Gemini için ayır
    const half = Math.ceil(uncachedPlaces.length / 2);
    const primaryBatch = uncachedPlaces.slice(0, half);
    const secondaryBatch = uncachedPlaces.slice(half);

    log.analysis("Analysis split between dual Gemini APIs", {
      action: "batch_analysis_split_start",
      primaryCount: primaryBatch.length,
      secondaryCount: secondaryBatch.length,
      model: "gemini-3-flash-preview"
    });

    // Her API için 3 paralel işlem, 1 saniye aralıkla sonraki batch
    const PARALLEL_LIMIT = 3;
    const STAGGER_DELAY_MS = 1000;

    // Staggered batch processing function
    const processWithStaggeredBatches = async (
      places: Place[],
      analyzeFunc: (place: Place) => Promise<string[]>,
      apiName: string
    ) => {
      const batches: Place[][] = [];
      for (let i = 0; i < places.length; i += PARALLEL_LIMIT) {
        batches.push(places.slice(i, i + PARALLEL_LIMIT));
      }

      console.log(`[${apiName}] ${batches.length} batch (her biri ${PARALLEL_LIMIT} mekan), ${STAGGER_DELAY_MS}ms aralıkla başlatılıyor...`);

      // Her batch için promise oluştur
      const batchPromises = batches.map((batch, batchIndex) => {
        return new Promise<void>(async (resolve) => {
          // İlk batch hemen başlar, sonrakiler STAGGER_DELAY_MS * batchIndex kadar bekler
          if (batchIndex > 0) {
            await new Promise(r => setTimeout(r, STAGGER_DELAY_MS * batchIndex));
          }
          
          console.log(`[${apiName}] Batch ${batchIndex + 1}/${batches.length} başlatılıyor (${batch.length} mekan)`);
          
          // Batch içindeki tüm mekanları paralel olarak analiz et
          await Promise.all(batch.map(async (place) => {
            try {
              const tags = await analyzeFunc(place);
              if (tags && tags.length > 0) {
                resultMap.set(place.id, tags);
                newlyAnalyzedVenues.push(place.id);
                log.analysis(`${apiName} analysis completed`, {
                  action: "gemini_analysis_success",
                  placeId: place.id,
                  placeName: place.name,
                  tagsCount: tags.length,
                });
              } else {
                log.analysis(`${apiName} analysis returned empty tags`, {
                  action: "gemini_analysis_empty",
                  placeId: place.id,
                  placeName: place.name,
                });
              }
            } catch (error: any) {
              failedVenues.push(place.id);
              log.analysisError(`${apiName} batch analysis failed for place`, {
                action: "gemini_batch_analysis_failed",
                placeId: place.id,
                placeName: place.name,
              }, error);
            }
          }));
          
          resolve();
        });
      });

      // Tüm batch'lerin tamamlanmasını bekle
      await Promise.all(batchPromises);
    };

    // İki Gemini API'yi eş zamanlı başlat
    console.log(`[Batch Analysis] Dual Gemini APIs (Primary: ${primaryBatch.length}, Secondary: ${secondaryBatch.length}) eş zamanlı başlıyor...`);
    
    const primaryPromise = processWithStaggeredBatches(
      primaryBatch,
      analyzePlacePhotosWithGeminiPrimary,
      "Gemini Primary"
    );

    const secondaryPromise = processWithStaggeredBatches(
      secondaryBatch,
      analyzePlacePhotosWithGeminiSecondary,
      "Gemini Secondary"
    );

    // Her iki API'nin tüm analizlerinin bitmesini bekle
    await Promise.all([primaryPromise, secondaryPromise]);
    
    console.log("[Batch Analysis] Tüm Gemini analizleri tamamlandı.", {
      cached: cachedVenues.length,
      newlyAnalyzed: newlyAnalyzedVenues.length,
      failed: failedVenues.length,
    });
  }

  // Final statistics
  const stats = {
    total: places.length,
    cached: cachedVenues.length,
    newlyAnalyzed: newlyAnalyzedVenues.length,
    failed: failedVenues.length,
  };

  log.analysis("Batch analysis completed with dual Gemini APIs", {
    action: "batch_analysis_complete",
    ...stats,
    cachedVenueIds: cachedVenues.slice(0, 5),
    newlyAnalyzedVenueIds: newlyAnalyzedVenues.slice(0, 5),
    failedVenueIds: failedVenues.length > 0 ? failedVenues : undefined,
  });
  
  if (failedVenues.length > 0) {
    console.warn(`[Batch Analysis] ${failedVenues.length} mekan için analiz başarısız oldu:`, failedVenues);
  }
  
  return resultMap;
}
