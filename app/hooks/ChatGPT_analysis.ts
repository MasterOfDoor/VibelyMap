"use client";

import { Place } from "../components/DetailPanel";

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
- Deniz varlığı için kesin kanıt ara ışık yansıması yetersiz.
- Fotoğrafın sabah olması Canlı veya doğal olduğu anlamına gelmez daha iyi analiz için diğer fotoğraflarıda incele.

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
  } catch (error) {
    console.error("Photo fetch/resize error:", error);
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

// Tek bir mekan için fotoğraf analizi yap (ChatGPT ile)
export async function analyzePlacePhotosWithChatGPT(place: Place): Promise<string[]> {
  try {
    // Fotoğraf URL'lerini topla
    const photoUrls: string[] = [
      ...(place.photos || []),
      ...(place.photo ? [place.photo] : []),
    ].filter(Boolean).slice(0, 6); // Maksimum 6 fotoğraf

    if (photoUrls.length === 0) {
      console.log("[ChatGPT Analysis] Fotoğraf yok, analiz yapılamıyor:", place.name);
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
      console.warn("[ChatGPT Analysis] Fotoğraf yüklenemedi:", place.name);
      return [];
    }

    // Prompt oluştur
    const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

    // ChatGPT API'ye istek gönder
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
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("[ChatGPT Analysis] API hatası:", error);
      throw new Error(`ChatGPT API failed: ${error.error || "Unknown error"}`);
    }

    const data = await response.json();
    const text = data.output_text || data.text || "";

    if (!text) {
      console.warn("[ChatGPT Analysis] Boş cevap alındı");
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
    } catch (error) {
      console.warn("[ChatGPT Analysis] JSON parse hatası:", text, error);
      throw new Error("Invalid JSON response from ChatGPT");
    }

    console.log("[ChatGPT Analysis] Analiz tamamlandı:", place.name, result);

    // Sonuçları etiketlere çevir
    const tags = convertAnalysisToTags(result);
    return tags;
  } catch (error: any) {
    console.error("[ChatGPT Analysis] Hata:", error);
    throw error; // Hata durumunda throw et ki fallback çalışmasın
  }
}

