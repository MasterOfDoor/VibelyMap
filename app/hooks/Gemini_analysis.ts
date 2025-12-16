"use client";

import { useCallback } from "react";
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

// Fotoğraf URL'ini base64 data URL'e çevir
async function fetchPhotoAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Photo fetch failed");
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Photo fetch error:", error);
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

// Tek bir mekan için fotoğraf analizi yap
export async function analyzePlacePhotos(place: Place): Promise<string[]> {
  try {
    // Fotoğraf URL'lerini topla
    const photoUrls: string[] = [
      ...(place.photos || []),
      ...(place.photo ? [place.photo] : []),
    ].filter(Boolean).slice(0, 6); // Maksimum 6 fotoğraf

    if (photoUrls.length === 0) {
      console.log("[Gemini Analysis] Fotoğraf yok, analiz yapılamıyor:", place.name);
      return [];
    }

    console.log("[Gemini Analysis] Analiz başlatılıyor:", place.name, "Fotoğraf sayısı:", photoUrls.length);

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
      console.warn("[Gemini Analysis] Fotoğraf yüklenemedi:", place.name);
      return [];
    }

    // Prompt oluştur
    const prompt = `${SYSTEM_PROMPT}\n\nŞimdi bu fotoğrafları analiz et:`;

    // Gemini API'ye istek gönder
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
      return [];
    }

    const data = await response.json();
    const text = data.text || "";

    // JSON'u parse et
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Gemini Analysis] JSON bulunamadı:", text);
      return [];
    }

    const result: PhotoAnalysisResult = JSON.parse(jsonMatch[0]);
    console.log("[Gemini Analysis] Analiz tamamlandı:", place.name, result);

    // Sonuçları etiketlere çevir
    const tags = convertAnalysisToTags(result);
    return tags;
  } catch (error: any) {
    console.error("[Gemini Analysis] Hata:", error);
    return [];
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

