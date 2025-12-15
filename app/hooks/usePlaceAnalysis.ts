"use client";

import { useCallback, useRef } from "react";
import { useProxy } from "./useProxy";
import { Place } from "../components/DetailPanel";

interface AnalysisResult {
  placeId: string;
  labels: string[];
  features: string[];
  tags: string[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("photo fetch failed");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function usePlaceAnalysis() {
  const { aiChat, fetchContent } = useProxy();
  const systemPromptCache = useRef<string | null>(null);
  const systemPromptPromise = useRef<Promise<string> | null>(null);

  const loadSystemPrompt = useCallback(async () => {
    if (systemPromptCache.current) return systemPromptCache.current;
    if (systemPromptPromise.current) return systemPromptPromise.current;
    systemPromptPromise.current = fetch("/system%20prompt.txt")
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => (text || "").trim())
      .catch(() => "")
      .finally(() => {
        systemPromptPromise.current = null;
      }) as Promise<string>;
    systemPromptCache.current = await systemPromptPromise.current;
    return systemPromptCache.current;
  }, []);

  const analyzePlaces = useCallback(
    async (places: Place[]): Promise<Map<string, AnalysisResult>> => {
      console.log("[analyzePlaces] Başlatılıyor, mekan sayısı:", places.length);
      if (places.length === 0) return new Map();

      const resultMap = new Map<string, AnalysisResult>();
      const systemPrompt = await loadSystemPrompt();
      console.log("[analyzePlaces] System prompt yüklendi, uzunluk:", systemPrompt.length);

      // Chunk to avoid token issues
      const batches = chunkArray(places, 5);

      for (const batch of batches) {
        // Prepare payload for this batch
        const batchPayload = await Promise.all(
          batch.map(async (place) => {
            // Website content (limited)
            let websiteContent = "";
            if (place.website) {
              try {
                const content = await fetchContent(place.website);
                websiteContent = (content || "").slice(0, 4000);
              } catch (err) {
                console.warn("Website fetch failed", place.website, err);
              }
            }

            // Photos (convert first 3 to data URLs)
            const photoCandidates = [
              ...(place.photos || []),
              ...(place.photo ? [place.photo] : []),
            ]
              .filter(Boolean)
              .slice(0, 3);

            const photoDataUrls: string[] = [];
            for (const photoUrl of photoCandidates) {
              const dataUrl = await fetchDataUrl(photoUrl);
              if (dataUrl) {
                photoDataUrls.push(dataUrl);
              }
            }

            return {
              id: place.id,
              name: place.name,
              address: place.address || "",
              website: place.website || "",
              websiteContent,
              tags: place.tags || [],
              features: place.features || [],
              photos: photoDataUrls,
            };
          })
        );

        const userContent = batchPayload.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          website: p.website,
          websiteContent: p.websiteContent,
          tags: p.tags,
          features: p.features,
        }));

        // OpenAI responses API - text input + foto URL listesi
        const photoUrls = batchPayload
          .flatMap((p) => p.photos)
          .slice(0, 6);

        const textInstruction = `
${systemPrompt || "Sen bir mekan analiz uzmanısın. Sadece geçerli JSON array döndür."}

Format (JSON array):
[
  {
    "placeId": "id",
    "labels": ["etiket1", "etiket2"],
    "features": ["özellik1", "özellik2"],
    "tags": ["etiket1", "etiket2"]
  }
]

Mekanlar: ${JSON.stringify(userContent, null, 2)}

Analizleyeceğin fotoğraf URL'leri: ${photoUrls.join(", ")}
`;

        const body = {
          model: "gpt-5-mini",
          input: textInstruction,
          // temperature parametresi responses API'de desteklenmiyor, kaldırıldı
          max_output_tokens: 500,
        };

        const requestSize = JSON.stringify(body).length;
        console.log("[analyzePlaces] AI isteği gönderiliyor (openai responses), boyut:", Math.round(requestSize / 1024), "KB, foto:", photoUrls.length);

        try {
          const startTime = Date.now();
          const response = await aiChat(body, "responses");
          const duration = Date.now() - startTime;
          console.log("[analyzePlaces] AI yanıt alındı, süre:", duration, "ms");

          const content = response.output_text || response.choices?.[0]?.message?.content || "";

          console.log("[analyzePlaces] AI yanıt içeriği:", content.substring(0, 500));

          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.warn("[analyzePlaces] AI yanıtında JSON array bulunamadı!");
            console.warn("[analyzePlaces] Tam yanıt:", content);
            continue;
          }

          const results: AnalysisResult[] = JSON.parse(jsonMatch[0]);
          console.log("[analyzePlaces] Parse edilen sonuç sayısı:", results.length);
          
          results.forEach((res) => {
            console.log("[analyzePlaces] Mekan:", res.placeId, "Labels:", res.labels);
            resultMap.set(res.placeId, {
              placeId: res.placeId,
              labels: res.labels || [],
              features: res.features || [],
              tags: res.tags || [],
            });
          });
        } catch (error: any) {
          console.error("[analyzePlaces] ❌ AI hatası:", error.message || error);
          // Continue with next batch
        }
      }

      return resultMap;
    },
    [aiChat, fetchContent, loadSystemPrompt]
  );

  return { analyzePlaces };
}
