"use client";

import { Place } from "../components/DetailPanel";
import { log } from "../utils/logger";

const SYSTEM_PROMPT = `Sen bir kafe/mekan fotoğraf analiz asistanısın. Görevin, verilen FOTOĞRAFLARDA sadece kesin olarak gördüğün bilgileri çıkarmaktır. EMİN OLMADIĞIN HİÇBİR BİLGİ İÇİN ALAN OLUŞTURMA, TAHMİN YAPMA.

ÇIKTI ALANLARI (sadece gördüğün net kanıta göre doldur):
- mekan_isiklandirma: 1 | 2 | 3 | 4 | 5
- ambiyans: { "retro": true/false, "modern": true/false }
- masada_priz_var_mi: true
- koltuk_var_mi: 0 | 1 | 2 | 3
- sigara_iciliyor: true
- sigara_alani: ["acik", "kapali"]
- deniz_manzarasi: true

KURALLAR:
- Emin değilsen ilgili alanı HİÇ yazma.
- Sigara: sadece kanıt varsa yaz; açık/kapalı alan ayrımını sigara_alani listesinde belirt.
- Mekan ışıklandırması için 1 canlı, 3 doğal, 5 loş olacak biçimde ara değer olursa ara değer verebilir.
- Koltuk için 0 yok, 1 az, 2 orta, 3 mekan genelinde koltuk var.
- Ambiyans retro/modern boolean; ikisi de yoksa ambiyans alanını yazma.
-Deniz varlığı için kesin kanıt ara ışık yansıması yetersiz.
-Fotoğrafın sabah olması Canlı veya doğal olduğu anlamına gelmez daha iyi analiz için diğer fotoğraflarıda incele.
ÇIKTI: Her zaman tek bir JSON nesnesi döndür, JSON dışında hiçbir şey yazma.`;

interface PhotoAnalysisResult {
  mekan_isiklandirma?: 1 | 2 | 3 | 4 | 5;
  ambiyans?: {
    retro?: boolean;
    modern?: boolean;
  };
  masada_priz_var_mi?: boolean;
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

  // Priz
  if (result.masada_priz_var_mi) {
    tags.push("Masada priz");
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
    log.storage("Checking cache for tags", {
      action: "cache_check",
      placeId,
    });
    
    const response = await fetch(`/api/ai-tags/${encodeURIComponent(placeId)}`);
    if (!response.ok) {
      log.storageError("Cache check failed", {
        action: "cache_check_error",
        placeId,
        status: response.status,
      });
      return null;
    }
    const data = await response.json();
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      log.storage("Tags found in cache", {
        action: "cache_hit",
        placeId,
        tagsCount: data.tags.length,
        cached: data.cached,
      });
      return data.tags;
    }
    log.storage("No tags found in cache", {
      action: "cache_miss",
      placeId,
    });
    return null;
  } catch (error: any) {
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

// Tek bir mekan için fotoğraf analizi yap (sadece Gemini ile, fallback yok)
export async function analyzePlacePhotosWithGemini(place: Place): Promise<string[]> {
  log.gemini("Starting Gemini analysis", {
    action: "gemini_analysis_start",
    placeId: place.id,
    placeName: place.name,
  });
  
  // Fotoğraf URL'lerini topla
  const allPhotoUrls = [
    ...(place.photos || []),
    ...(place.photo ? [place.photo] : []),
  ].filter(Boolean);
  
  log.gemini("Place photo information collected", {
    action: "gemini_photos_info",
    placeId: place.id,
    placeName: place.name,
    photosArrayLength: place.photos?.length || 0,
    photoString: place.photo ? "var" : "yok",
    totalPhotoUrls: allPhotoUrls.length,
  });
  
  const photoUrls = allPhotoUrls.slice(0, 6); // Maksimum 6 fotoğraf

  if (photoUrls.length === 0) {
    log.geminiError("No photos available for analysis", {
      action: "gemini_no_photos",
      placeId: place.id,
      placeName: place.name,
    });
    return [];
  }

  console.log("[Gemini Analysis] Analiz başlatılıyor:", {
    placeName: place.name,
    totalPhotos: allPhotoUrls.length,
    photosToAnalyze: photoUrls.length,
    photoUrls: photoUrls,
  });

  // Fotoğrafları base64 data URL'e çevir (bir kez yap, her iki API için kullan)
  const photoDataUrls: string[] = [];
  log.analysis("Converting photos to base64", {
    action: "photos_to_base64",
    placeId: place.id,
    placeName: place.name,
    photoUrlsCount: photoUrls.length,
  });
  
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i];
    log.debug(`Loading photo ${i + 1}/${photoUrls.length}`, {
      action: "photo_load",
      placeId: place.id,
      photoIndex: i + 1,
      totalPhotos: photoUrls.length,
    });
    
    const dataUrl = await fetchPhotoAsDataUrl(url);
    if (dataUrl) {
      // Base64 kısmını al (data:image/jpeg;base64, kısmını çıkar)
      const base64Data = dataUrl.split(",")[1];
      if (base64Data) {
        photoDataUrls.push(base64Data);
        log.debug(`Photo ${i + 1} loaded successfully`, {
          action: "photo_load_success",
          placeId: place.id,
          photoIndex: i + 1,
          base64Length: base64Data.length,
        });
      } else {
        log.warn(`Photo ${i + 1} base64 parse failed`, {
          action: "photo_base64_parse_failed",
          placeId: place.id,
          photoIndex: i + 1,
        });
      }
    } else {
      log.warn(`Photo ${i + 1} load failed`, {
        action: "photo_load_failed",
        placeId: place.id,
        photoIndex: i + 1,
        url: url.substring(0, 50) + "...", // URL'i kısalt
      });
    }
  }

  log.analysis("Base64 conversion completed", {
    action: "base64_conversion_complete",
    placeId: place.id,
    placeName: place.name,
    requestedPhotos: photoUrls.length,
    loadedPhotos: photoDataUrls.length,
  });

  if (photoDataUrls.length === 0) {
    log.analysisError("No photos loaded", {
      action: "no_photos_loaded",
      placeId: place.id,
      placeName: place.name,
    });
    return [];
  }

  // Prompt oluştur
  const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

  // Önce Gemini'yi dene
  try {
    log.gemini("Starting Gemini analysis", {
      action: "gemini_analysis_start",
      placeId: place.id,
      placeName: place.name,
      photoCount: photoDataUrls.length,
    });
    
    const startTime = Date.now();
    const response = await fetch("/api/proxy/gemini", {
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
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      log.geminiError("Gemini API request failed", {
        action: "gemini_api_error",
        placeId: place.id,
        placeName: place.name,
        error: error,
      });
      throw new Error(`Gemini API failed: ${error.error || "Unknown error"}`);
    }

    const duration = Date.now() - startTime;
    const data = await response.json();
    const text = data.text || "";

    if (!text) {
      log.geminiError("Empty response from Gemini", {
        action: "gemini_empty_response",
        placeId: place.id,
        placeName: place.name,
      });
      throw new Error("Empty response from Gemini");
    }

    // Gemini response_mime_type: "application/json" kullandığı için
    // direkt JSON parse edebiliriz
    let result: PhotoAnalysisResult;
    try {
      result = JSON.parse(text);
    } catch (error: any) {
      log.geminiError("JSON parse error", {
        action: "gemini_json_parse_error",
        placeId: place.id,
        placeName: place.name,
        textLength: text.length,
      }, error);
      throw new Error("Invalid JSON response from Gemini");
    }

    log.gemini("Gemini analysis completed successfully", {
      action: "gemini_analysis_success",
      placeId: place.id,
      placeName: place.name,
      duration: `${duration}ms`,
      resultKeys: Object.keys(result),
    });

    // Sonuçları etiketlere çevir
    const tags = convertAnalysisToTags(result);
    log.analysis("Tags converted from analysis result", {
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
  } catch (geminiError: any) {
    // Gemini başarısız oldu, hatayı throw et ki fallback çalışsın
    log.geminiError("Gemini analysis failed", {
      action: "gemini_analysis_error",
      placeId: place.id,
      placeName: place.name,
      error: geminiError.message,
    }, geminiError);
    throw geminiError; // Hata durumunda throw et ki fallback çalışsın
  }
}

// Birden fazla mekan için toplu analiz (her mekan için ayrı API çağrısı)

