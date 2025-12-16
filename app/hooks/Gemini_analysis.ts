"use client";

import { Place } from "../components/DetailPanel";

const SYSTEM_PROMPT = `Sen bir kafe/mekan fotoğraf analiz asistanısın. Görevin, verilen FOTOĞRAFLARDA sadece kesin olarak gördüğün bilgileri çıkarmaktır. EMİN OLMADIĞIN HİÇBİR BİLGİ İÇİN ALAN OLUŞTURMA, TAHMİN YAPMA.

ÇIKTI ALANLARI (sadece gördüğün net kanıta göre doldur):
- mekan_isiklandirma: "los" | "canli" | "dogal"
- ambiyans: { "retro": true/false, "modern": true/false }
- masada_priz_var_mi: true
- koltuk_var_mi: true
- sigara_iciliyor: true
- sigara_alani: ["acik", "kapali"]
- deniz_manzarasi: true

KURALLAR:
- Emin değilsen ilgili alanı HİÇ yazma.
- Sigara: sadece kanıt varsa yaz; açık/kapalı alan ayrımını sigara_alani listesinde belirt.
- Loş = düşük ışık; Canlı = parlak/yapay; Doğal = belirgin gün ışığı.
- Ambiyans retro/modern boolean; ikisi de yoksa ambiyans alanını yazma.

ÇIKTI: Her zaman tek bir JSON nesnesi döndür, JSON dışında hiçbir şey yazma.`;

interface PhotoAnalysisResult {
  mekan_isiklandirma?: "los" | "canli" | "dogal";
  ambiyans?: {
    retro?: boolean;
    modern?: boolean;
  };
  masada_priz_var_mi?: boolean;
  koltuk_var_mi?: boolean;
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
  } catch (error) {
    console.error("Photo fetch/resize error:", error);
    return null;
  }
}

// Analiz sonuçlarını filtreleme seçeneklerine çevir
function convertAnalysisToTags(result: PhotoAnalysisResult): string[] {
  const tags: string[] = [];

  // Işıklandırma
  if (result.mekan_isiklandirma === "los") {
    tags.push("Los");
  } else if (result.mekan_isiklandirma === "canli") {
    tags.push("Canli");
  } else if (result.mekan_isiklandirma === "dogal") {
    tags.push("Dogal");
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

  // Koltuk
  if (result.koltuk_var_mi) {
    tags.push("Koltuk var");
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

// Tek bir mekan için fotoğraf analizi yap (Gemini ile, hata durumunda ChatGPT fallback)
export async function analyzePlacePhotos(place: Place): Promise<string[]> {
  // Fotoğraf URL'lerini topla
  const allPhotoUrls = [
    ...(place.photos || []),
    ...(place.photo ? [place.photo] : []),
  ].filter(Boolean);
  
  console.log("[Photo Analysis] Place fotoğraf bilgileri:", {
    placeName: place.name,
    placeId: place.id,
    photosArrayLength: place.photos?.length || 0,
    photoString: place.photo ? "var" : "yok",
    totalPhotoUrls: allPhotoUrls.length,
    photoUrls: allPhotoUrls,
  });
  
  const photoUrls = allPhotoUrls.slice(0, 6); // Maksimum 6 fotoğraf

  if (photoUrls.length === 0) {
    console.log("[Photo Analysis] Fotoğraf yok, analiz yapılamıyor:", place.name);
    return [];
  }

  console.log("[Photo Analysis] Analiz başlatılıyor:", {
    placeName: place.name,
    totalPhotos: allPhotoUrls.length,
    photosToAnalyze: photoUrls.length,
    photoUrls: photoUrls,
  });

  // Fotoğrafları base64 data URL'e çevir (bir kez yap, her iki API için kullan)
  const photoDataUrls: string[] = [];
  console.log("[Photo Analysis] Fotoğrafları base64'e çeviriliyor:", {
    placeName: place.name,
    photoUrlsCount: photoUrls.length,
  });
  
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i];
    console.log(`[Photo Analysis] Fotoğraf ${i + 1}/${photoUrls.length} yükleniyor:`, url);
    const dataUrl = await fetchPhotoAsDataUrl(url);
    if (dataUrl) {
      // Base64 kısmını al (data:image/jpeg;base64, kısmını çıkar)
      const base64Data = dataUrl.split(",")[1];
      if (base64Data) {
        photoDataUrls.push(base64Data);
        console.log(`[Photo Analysis] Fotoğraf ${i + 1} başarıyla yüklendi, base64 uzunluğu:`, base64Data.length);
      } else {
        console.warn(`[Photo Analysis] Fotoğraf ${i + 1} base64 parse edilemedi`);
      }
    } else {
      console.warn(`[Photo Analysis] Fotoğraf ${i + 1} yüklenemedi:`, url);
    }
  }

  console.log("[Photo Analysis] Base64 dönüşümü tamamlandı:", {
    placeName: place.name,
    requestedPhotos: photoUrls.length,
    loadedPhotos: photoDataUrls.length,
  });

  if (photoDataUrls.length === 0) {
    console.warn("[Photo Analysis] Hiç fotoğraf yüklenemedi:", place.name);
    return [];
  }

  // Prompt oluştur
  const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

  // Önce Gemini'yi dene
  try {
    console.log("[Gemini Analysis] Gemini ile analiz deneniyor:", place.name);
    
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
      console.error("[Gemini Analysis] API hatası:", error);
      throw new Error(`Gemini API failed: ${error.error || "Unknown error"}`);
    }

    const data = await response.json();
    const text = data.text || "";

    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    // Gemini response_mime_type: "application/json" kullandığı için
    // direkt JSON parse edebiliriz
    let result: PhotoAnalysisResult;
    try {
      result = JSON.parse(text);
    } catch (error) {
      console.warn("[Gemini Analysis] JSON parse hatası:", text, error);
      throw new Error("Invalid JSON response from Gemini");
    }

    console.log("[Gemini Analysis] Analiz başarıyla tamamlandı:", place.name, result);

    // Sonuçları etiketlere çevir
    const tags = convertAnalysisToTags(result);
    return tags;
  } catch (geminiError: any) {
    // Gemini başarısız oldu, ChatGPT fallback'e geç
    console.warn("[Gemini Analysis] Gemini başarısız, ChatGPT fallback'e geçiliyor:", geminiError.message);
    
    try {
      // ChatGPT analiz fonksiyonunu import et ve kullan
      const { analyzePlacePhotosWithChatGPT } = await import("./ChatGPT_analysis");
      
      console.log("[ChatGPT Analysis] ChatGPT ile analiz deneniyor:", place.name);
      const tags = await analyzePlacePhotosWithChatGPT(place);
      
      console.log("[ChatGPT Analysis] Analiz başarıyla tamamlandı:", place.name);
      return tags;
    } catch (chatgptError: any) {
      // Her iki API de başarısız oldu
      console.error("[Photo Analysis] Hem Gemini hem ChatGPT başarısız:", {
        gemini: geminiError.message,
        chatgpt: chatgptError.message,
      });
      return [];
    }
  }
}

// Birden fazla mekan için toplu analiz (her mekan için ayrı API çağrısı)
export async function analyzePlacesPhotos(places: Place[]): Promise<Map<string, string[]>> {
  const resultMap = new Map<string, string[]>();

  console.log("[Gemini Analysis] Toplu analiz başlatılıyor:", places.length, "mekan");

  // Her mekan için sırayla analiz yap
  for (const place of places) {
    try {
      const tags = await analyzePlacePhotos(place);
      if (tags.length > 0) {
        resultMap.set(place.id, tags);
      }
      // Rate limiting için kısa bir bekleme
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error("[Gemini Analysis] Mekan analiz hatası:", place.name, error);
    }
  }

  console.log("[Gemini Analysis] Toplu analiz tamamlandı:", resultMap.size, "sonuç");
  return resultMap;
}

