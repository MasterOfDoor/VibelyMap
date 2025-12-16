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
      if (!query.trim()) {
        setError("Sorgu boş olamaz");
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        const searchCenter = options.lat && options.lng
          ? { lat: options.lat, lng: options.lng }
          : ISTANBUL_CENTER;

        const searchRadius = options.radius || 3000; // 3km yarıçap
        const limit = options.limit || 1000; // Yüksek limit, sayfalama ile tüm sonuçları alacağız

        let allItems: any[] = [];
        let nextPageToken: string | undefined = undefined;
        let pageCount = 0;
        const maxPages = 5; // Maksimum sayfa sayısını azalttık (hız için)

        // Sayfalama ile tüm sonuçları al - optimize edilmiş
        do {
          console.log(`Fetching page ${pageCount + 1}, query: "${query}", center: ${searchCenter.lat},${searchCenter.lng}, radius: ${searchRadius}`);
          
          const response = await googleTextSearch({
            q: query,
            lat: searchCenter.lat.toString(),
            lng: searchCenter.lng.toString(),
            radius: searchRadius.toString(),
            type: options.type, // yeni API'de type'ı da ilet (Nearby Search için)
            pagetoken: nextPageToken,
          });

          console.log("Google API response status:", response.status);
          console.log("Google API response results count:", Array.isArray(response.results) ? response.results.length : 0);

          if (response.status === "OK" || response.status === "ZERO_RESULTS") {
            const items = Array.isArray(response.results) ? response.results : [];
            allItems = [...allItems, ...items];
            nextPageToken = response.next_page_token;
            pageCount++;

            console.log(`Page ${pageCount} completed. Total items: ${allItems.length}, Next page token: ${nextPageToken ? "yes" : "no"}`);

            // next_page_token varsa, Google API'nin token'ı hazırlaması için kısa bir bekleme
            // Bekleme süresini azalttık (2s -> 0.5s) hız için
            if (nextPageToken && pageCount < maxPages) {
              await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 saniye bekle (hızlandırıldı)
            } else {
              break; // Daha fazla sayfa yok
            }
          } else {
            // Hata durumu
            console.error("Google API error:", response.status, response);
            console.error("Query that failed:", query);
            console.error("Search params:", { lat: searchCenter.lat, lng: searchCenter.lng, radius: searchRadius });
            
            if (response.status === "INVALID_REQUEST") {
              // INVALID_REQUEST genellikle query ve type'ın birlikte kullanılmasından kaynaklanır
              // Type varsa query'yi kaldır, sadece type ile arama yap
              console.warn("INVALID_REQUEST - Retrying without query, using only type parameter");
              
              if (options.type) {
                // Type parametresi varsa, type'ı query olarak kullan
                const retryResponse = await googleTextSearch({
                  q: options.type, // Type'ı query olarak kullan
                  lat: searchCenter.lat.toString(),
                  lng: searchCenter.lng.toString(),
                  radius: searchRadius.toString(),
                });
                
                if (retryResponse.status === "OK") {
                  const items = Array.isArray(retryResponse.results) ? retryResponse.results : [];
                  allItems = [...allItems, ...items];
                  console.log("Retry successful (type as query), got", items.length, "results");
                } else {
                  throw new Error("Geçersiz arama sorgusu: " + (response.error_message || retryResponse.error_message || "Query geçersiz"));
                }
                break; // Retry sonrası dur
              } else {
                // Type yoksa, query'yi kısalt
                const shortQuery = query.split(" ").slice(0, 2).join(" "); // İlk 2 kelimeyi al
                console.warn("Retrying with shorter query:", shortQuery);
                
                if (shortQuery && shortQuery !== query) {
                  const retryResponse = await googleTextSearch({
                    q: shortQuery,
                    lat: searchCenter.lat.toString(),
                    lng: searchCenter.lng.toString(),
                    radius: searchRadius.toString(),
                  });
                  
                  if (retryResponse.status === "OK") {
                    const items = Array.isArray(retryResponse.results) ? retryResponse.results : [];
                    allItems = [...allItems, ...items];
                    console.log("Retry successful (short query), got", items.length, "results");
                  } else {
                    throw new Error("Geçersiz arama sorgusu: " + (response.error_message || retryResponse.error_message || "Query geçersiz"));
                  }
                  break;
                } else {
                  throw new Error("Geçersiz arama sorgusu: " + (response.error_message || "Query geçersiz"));
                }
              }
            } else if (response.status === "OVER_QUERY_LIMIT") {
              throw new Error("API limiti aşıldı");
            } else {
              console.warn("Unknown status, breaking:", response.status);
              break; // Diğer durumlarda dur
            }
          }
        } while (nextPageToken && pageCount < maxPages);

        // Limit uygula (eğer belirtilmişse)
        const limitedItems = options.limit 
          ? allItems.slice(0, options.limit)
          : allItems;

        const rawPlaces = limitedItems.map(normalizePlace).filter(Boolean) as Place[];
        const enrichedPlaces = rawPlaces.map(enrichPlace);

        // Duplicate place'leri filtrele (aynı ID'ye sahip olanlar)
        const uniquePlacesMap = new Map<string, Place>();
        enrichedPlaces.forEach((place) => {
          if (!uniquePlacesMap.has(place.id)) {
            uniquePlacesMap.set(place.id, place);
          }
        });
        const uniquePlaces = Array.from(uniquePlacesMap.values());

        // Fetch detailed info (website, photos, etc.) for top results to enrich data
        const detailedPlaces = await Promise.allSettled(
          uniquePlaces.slice(0, 20).map(async (place) => {
            try {
              const detail = await googlePlaceDetails(place.id);
              const result = detail?.result || detail;
              if (!result) return place;

              // Photo refs to URLs through proxy (yeni API formatında name kullanılıyor)
              const photos =
                Array.isArray(result.photos) && result.photos.length > 0
                  ? result.photos
                      .map((p: any) => {
                        const photoRef = p?.photo_reference || p?.name;
                        return photoRef
                          ? `/api/proxy/google?endpoint=photo&ref=${encodeURIComponent(
                              photoRef
                            )}&maxwidth=800`
                          : "";
                      })
                      .filter(Boolean)
                  : place.photos || [];

              return {
                ...place,
                address: result.formatted_address || place.address,
                website: result.website || place.website,
                hours: Array.isArray(result.opening_hours?.weekday_text)
                  ? result.opening_hours.weekday_text.join(" | ")
                  : place.hours,
                photo: photos[0] || place.photo,
                photos: photos.length > 0 ? photos : place.photos,
                externalReviews: Array.isArray(result.reviews)
                  ? result.reviews.map((r: any) => ({
                      author: r.author_name || "Ziyaretçi",
                      text: r.text || "",
                      rating: r.rating || null,
                      relativeTime: r.relative_time_description || "",
                    }))
                  : place.externalReviews,
              } as Place;
            } catch (err) {
              console.warn("Detail fetch failed for place:", place.id, err);
              return place;
            }
          })
        );

        const mergedDetailed = uniquePlaces.map((p, idx) => {
          const detailResult = detailedPlaces[idx];
          if (detailResult && detailResult.status === "fulfilled" && detailResult.value) {
            return detailResult.value as Place;
          }
          return p;
        });

        // Tüm sonuçları göster (sayfalama tamamlandıysa veya ilk sayfa gösterildiyse)
        setPlaces(mergedDetailed);
        return mergedDetailed;
      } catch (err: any) {
        const errorMessage = err.message || "Arama başarısız";
        setError(errorMessage);
        console.error("loadPlaces error:", err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [googleTextSearch, normalizePlace, enrichPlace]
  );

  const clearPlaces = useCallback(() => {
    setPlaces([]);
    setError(null);
  }, []);

  const setPlacesDirectly = useCallback((newPlaces: Place[]) => {
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

