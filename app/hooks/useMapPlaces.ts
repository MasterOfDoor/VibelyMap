"use client";

import { useState, useCallback } from "react";
import { Place } from "../components/DetailPanel";
import { useProxy } from "./useProxy";

const ISTANBUL_CENTER = { lat: 41.015137, lng: 28.97953 };
const ISTANBUL_RADIUS = 30000; // 30 km

export function useMapPlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { googleTextSearch, googlePlaceDetails } = useProxy();

  const normalizePlace = useCallback((item: any): Place | null => {
    if (!item) return null;
    const pos = item.geometry?.location;
    if (!pos?.lat || !pos?.lng) return null;

    const googleTypes = (item.types || []).map((t: string) =>
      t.replace(/_/g, " ")
    );
    const primaryType = googleTypes[0] || "Mekan";
    const tagSet = new Set<string>(googleTypes);

    // Tüm fotoğrafları al (sadece ilk fotoğraf değil)
    const photos: string[] = [];
    if (Array.isArray(item.photos) && item.photos.length > 0) {
      item.photos.forEach((photoItem: any) => {
        const ref = photoItem?.photo_reference || photoItem?.name;
        if (ref) {
          photos.push(
            `/api/proxy/google?endpoint=photo&ref=${encodeURIComponent(
              ref
            )}&maxwidth=800`
          );
        }
      });
    }
    
    // İlk fotoğrafı photo olarak da ekle (backward compatibility)
    const photo = photos[0] || "";
    
    console.log("[useMapPlaces] normalizePlace - Fotoğraflar:", {
      placeName: item.name || "Unknown",
      placeId: item.place_id || item.id,
      rawPhotosCount: item.photos?.length || 0,
      processedPhotosCount: photos.length,
      photos: photos,
    });

    // mapCategoryToOptions benzeri mantık (eski script.js'den)
    const CATEGORY_KEYWORDS: { [key: string]: string[] } = {
      Kafe: ["cafe", "coffee", "kahve", "espresso", "coffeeshop", "coffee shop"],
      Restoran: ["restaurant", "restoran", "diner", "bistro", "lokanta", "kebap", "kebab", "ocakbasi", "canteen"],
      Bar: ["bar", "pub", "bistro bar", "cocktail", "wine"],
    };

    const mappedCategories: string[] = [];
    const categoryLower = primaryType.toLowerCase();
    Object.entries(CATEGORY_KEYWORDS).forEach(([label, keywords]) => {
      if (keywords.some((k) => categoryLower.includes(k))) {
        mappedCategories.push(label);
      }
    });
    if (mappedCategories.length === 0) {
      mappedCategories.push(primaryType);
    }

    // Fiyat seviyesini güvenli hesapla (negatif veya NaN durumuna karşı)
    const priceLevel =
      typeof item.price_level === "number" && item.price_level > 0
        ? Math.floor(item.price_level)
        : 0;
    const priceLabel = priceLevel > 0 ? "$".repeat(priceLevel) : "";

    return {
      id: item.place_id || item.id,
      name: item.name || "Mekan",
      type: primaryType,
      coords: [pos.lat, pos.lng],
      address: item.formatted_address || "",
      website: "",
      hours: "",
      rating: typeof item.rating === "number" ? item.rating : null,
      priceLabel,
      tel: "",
      photo,
      photos: photos.length > 0 ? photos : undefined, // Tüm fotoğrafları ekle
      tags: Array.from(tagSet).slice(0, 5),
      features: [],
      subOptions: { Kategori: mappedCategories },
    };
  }, []);

  const enrichPlace = useCallback((place: Place): Place => {
    // Add random features if needed (from old script.js logic)
    return {
      ...place,
      tags: place.tags || [],
      features: place.features || [],
    };
  }, []);

  const loadPlaces = useCallback(
    async (
      query: string,
      options: {
        lat?: number;
        lng?: number;
        radius?: number;
        limit?: number;
        type?: string;
      } = {}
    ) => {
      // Query boşsa ama type varsa nearby search kullanılacak, hata döndürme
      if (!query.trim() && !options.type) {
        setError("Sorgu veya type belirtilmelidir");
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        const searchCenter = options.lat && options.lng
          ? { lat: options.lat, lng: options.lng }
          : ISTANBUL_CENTER;

        const searchRadius = options.radius || 500; // 500m yarıçap varsayılan
        const limit = options.limit || 1000; // Yüksek limit, sayfalama ile tüm sonuçları alacağız

        // Google Maps benzeri progressive loading: İlk 20 sonuç hemen göster, ikinci 20 arka planda yükle
        console.log(`[Google Maps Style] Starting search for: "${query}", center: ${searchCenter.lat},${searchCenter.lng}, radius: ${searchRadius}`);
        
        // İLK SAYFA: İlk 20 sonuç (hemen gösterilecek)
        const firstPageResponse = await googleTextSearch({
          q: query,
          lat: searchCenter.lat.toString(),
          lng: searchCenter.lng.toString(),
          radius: searchRadius.toString(),
          type: options.type,
        });

        console.log("[Google Maps Style] First page response status:", firstPageResponse.status);
        console.log("[Google Maps Style] First page results count:", Array.isArray(firstPageResponse.results) ? firstPageResponse.results.length : 0);

        if (firstPageResponse.status !== "OK" && firstPageResponse.status !== "ZERO_RESULTS") {
          // Hata durumu - retry logic
          if (firstPageResponse.status === "INVALID_REQUEST") {
            console.warn("INVALID_REQUEST - Retrying...");
            if (options.type) {
              const retryResponse = await googleTextSearch({
                q: options.type,
                lat: searchCenter.lat.toString(),
                lng: searchCenter.lng.toString(),
                radius: searchRadius.toString(),
              });
              if (retryResponse.status === "OK") {
                const firstPageItems = Array.isArray(retryResponse.results) ? retryResponse.results : [];
                const rawPlaces = firstPageItems.map(normalizePlace).filter(Boolean) as Place[];
                const enrichedPlaces = rawPlaces.map(enrichPlace);
                setPlaces(enrichedPlaces);
                return enrichedPlaces;
              }
            }
            throw new Error("Geçersiz arama sorgusu");
          }
          throw new Error("Arama başarısız: " + firstPageResponse.status);
        }

        const firstPageItems = Array.isArray(firstPageResponse.results) ? firstPageResponse.results : [];
        const nextPageToken = firstPageResponse.next_page_token;

        // Debug: nextPageToken kontrolü
        console.log("[Google Maps Style] nextPageToken check:", {
          hasToken: !!nextPageToken,
          token: nextPageToken,
          responseKeys: Object.keys(firstPageResponse),
        });

        // İlk 20 sonucu hemen normalize et ve göster (No-Lag UX)
        const firstPageRawPlaces = firstPageItems.map(normalizePlace).filter(Boolean) as Place[];
        const firstPageEnrichedPlaces = firstPageRawPlaces.map(enrichPlace);
        
        // İlk 20 sonucu hemen ekrana bas (progressive loading)
        console.log("[Google Maps Style] Displaying first 20 results immediately (progressive loading)");
        setPlaces(firstPageEnrichedPlaces);

        // İKİNCİ SAYFA: Arka planda yükle (nextPageToken varsa)
        if (nextPageToken) {
          console.log("[Google Maps Style] Loading second page in background...");
          
          // Google'ın önerdiği bekleme süresi: 1-2 saniye
          const waitTime = 1500; // 1.5 saniye
          console.log(`[Google Maps Style] Waiting ${waitTime}ms for nextPageToken to be ready...`);
          
          // Arka planda ikinci sayfayı yükle (await etmeden başlat)
          (async () => {
            try {
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              
              const secondPageResponse = await googleTextSearch({
                q: query,
                lat: searchCenter.lat.toString(),
                lng: searchCenter.lng.toString(),
                radius: searchRadius.toString(),
                type: options.type,
                pagetoken: nextPageToken,
              });

              if (secondPageResponse.status === "OK") {
                const secondPageItems = Array.isArray(secondPageResponse.results) ? secondPageResponse.results : [];
                console.log("[Google Maps Style] Second page loaded:", secondPageItems.length, "results");
                
                // İkinci sayfa sonuçlarını normalize et
                const secondPageRawPlaces = secondPageItems.map(normalizePlace).filter(Boolean) as Place[];
                const secondPageEnrichedPlaces = secondPageRawPlaces.map(enrichPlace);
                
                // İlk ve ikinci sayfa sonuçlarını birleştir (duplicate kontrolü ile)
                const allPlacesMap = new Map<string, Place>();
                firstPageEnrichedPlaces.forEach(place => allPlacesMap.set(place.id, place));
                secondPageEnrichedPlaces.forEach(place => {
                  if (!allPlacesMap.has(place.id)) {
                    allPlacesMap.set(place.id, place);
                  }
                });
                
                const allPlaces = Array.from(allPlacesMap.values());
                console.log("[Google Maps Style] Total results after second page:", allPlaces.length);
                
                // Tüm sonuçları güncelle (40 sonuç)
                setPlaces(allPlaces);
              } else {
                console.warn("[Google Maps Style] Second page failed:", secondPageResponse.status);
              }
            } catch (err) {
              console.error("[Google Maps Style] Second page loading error:", err);
              // Hata durumunda ilk 20 sonuç zaten gösterilmiş, devam et
            }
          })();
        }

        // İlk 20 sonuç için detaylı bilgi yükle (arka planda, performans için sadece ilk 10'a)
        // Detaylı bilgi yükleme arka planda yapılabilir ama şimdilik hızlı gösterim için atlanıyor
        // İlk 20 sonucu hemen döndür (ikinci sayfa arka planda yükleniyor)
        return firstPageEnrichedPlaces;
      } catch (err: any) {
        const errorMessage = err.message || "Arama başarısız";
        setError(errorMessage);
        console.error("loadPlaces error:", err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [googleTextSearch, googlePlaceDetails, normalizePlace, enrichPlace]
  );

  const clearPlaces = useCallback(() => {
    setPlaces([]);
    setError(null);
  }, []);

  const setPlacesDirectly = useCallback((newPlaces: Place[] | ((prev: Place[]) => Place[])) => {
    setPlaces(newPlaces);
  }, []);

  return {
    places,
    loading,
    error,
    loadPlaces,
    clearPlaces,
    setPlaces: setPlacesDirectly,
  };
}

