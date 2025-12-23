import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY || "";

// CORS headers
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Goog-Api-Key, X-Goog-FieldMask");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

// Google Places API (New) - Text Search (Google Maps benzeri deneyim)
// Google Maps gibi esnek ve kısıtlamasız arama
async function textSearchNew(q: string, lat: string, lng: string, radius: string, pageToken?: string) {
  // Radius'u 1000-2000 arası optimize et (Google Maps gibi)
  const optimizedRadius = Math.min(Math.max(parseFloat(radius), 1000), 2000);
  
  const requestBody: any = {
    textQuery: q,
    locationBias: {
      circle: {
        center: {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
        radius: optimizedRadius, // Google Maps gibi optimize edilmiş radius
      },
    },
    maxResultCount: 20, // İlk sayfa için makul bir limit (pagination ile devam eder)
    languageCode: "tr", // Türkçe sonuçlar için
  };

  // includedType KULLANILMIYOR - Google Maps gibi tüm sonuçları göster
  // Kullanıcı text query ile istediği şeyi arar, algoritma en iyi sonuçları döner

  if (pageToken) {
    requestBody.pageToken = pageToken;
  }

  // Google Maps'teki liste görünümü için optimize edilmiş FieldMask (sadece gerekli alanlar)
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Text Search failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Yeni API formatını eski formata çevir (backward compatibility)
  return {
    status: data.places?.length > 0 ? "OK" : "ZERO_RESULTS",
    results: (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || "",
      formatted_address: place.formattedAddress || "",
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating || null,
      user_ratings_total: place.userRatingCount || 0,
      photos: (place.photos || []).map((photo: any) => ({
        photo_reference: photo.name, // Yeni API'de name kullanılıyor
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
      })),
      website: place.websiteUri || "",
      price_level: place.priceLevel ? ["FREE", "INEXPENSIVE", "MODERATE", "EXPENSIVE", "VERY_EXPENSIVE"].indexOf(place.priceLevel) : null,
    })),
    next_page_token: data.nextPageToken || null,
  };
}

// Google Places API (New) - Nearby Search
async function nearbySearchNew(type: string, lat: string, lng: string, radius: string, pageToken?: string) {
  const requestBody: any = {
    includedTypes: [type],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
        radius: parseFloat(radius),
      },
    },
  };

  if (pageToken) {
    requestBody.pageToken = pageToken;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.priceLevel",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Nearby Search failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Yeni API formatını eski formata çevir (backward compatibility)
  return {
    status: data.places?.length > 0 ? "OK" : "ZERO_RESULTS",
    results: (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || "",
      formatted_address: place.formattedAddress || "",
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating || null,
      user_ratings_total: place.userRatingCount || 0,
      photos: (place.photos || []).map((photo: any) => ({
        photo_reference: photo.name, // Yeni API'de name kullanılıyor
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
      })),
      website: place.websiteUri || "",
      price_level: place.priceLevel ? ["FREE", "INEXPENSIVE", "MODERATE", "EXPENSIVE", "VERY_EXPENSIVE"].indexOf(place.priceLevel) : null,
    })),
    next_page_token: data.nextPageToken || null,
  };
}

// Google Places API (New) - Autocomplete
async function autocompleteNew(input: string, lat?: string, lng?: string, radius?: string) {
  const requestBody: any = {
    input: input,
    locationBias: lat && lng ? {
      circle: {
        center: {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
        radius: radius ? parseFloat(radius) : 30000, // 30km default
      },
    } : undefined,
    includedRegionCodes: ["TR"], // Türkiye için
  };

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Autocomplete failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Format suggestions
  return {
    suggestions: (data.suggestions || []).map((suggestion: any) => ({
      placeId: suggestion.placePrediction?.placeId || "",
      text: suggestion.placePrediction?.text?.text || "",
      matchedSubstrings: suggestion.placePrediction?.text?.matches || [],
    })),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get("endpoint");

  if (!GOOGLE_PLACES_KEY) {
    return setCorsHeaders(NextResponse.json({ error: "missing_google_key" }, { status: 500 }));
  }

  try {
    if (endpoint === "autocomplete") {
      const input = searchParams.get("input") || "";
      const lat = searchParams.get("lat") || undefined;
      const lng = searchParams.get("lng") || undefined;
      const radius = searchParams.get("radius") || undefined;

      if (!input || input.trim().length < 2) {
        return setCorsHeaders(
          NextResponse.json({ suggestions: [] })
        );
      }

      const data = await autocompleteNew(input, lat, lng, radius);
      return setCorsHeaders(NextResponse.json(data));
    } else if (endpoint === "textsearch") {
      const q = searchParams.get("q") || "";
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      const radius = searchParams.get("radius") || "1500"; // Google Maps gibi 1000-2000 arası default
      const type = searchParams.get("type") || "";
      const nextPageToken = searchParams.get("pagetoken") || "";

      if (!lat || !lng) {
        return setCorsHeaders(NextResponse.json(
          { error: "missing_coords" },
          { status: 400 }
        ));
      }

      // Google Maps mantığı: Text Search kullan (daha akıllı sonuçlar için)
      // Eğer query varsa Text Search kullan (işletme adları, yorumlar, popülerlik harmanlanır)
      // includedType KULLANILMIYOR - Google Maps gibi tüm sonuçları göster, algoritma en iyilerini seçer
      if (q.trim()) {
        const data = await textSearchNew(q, lat, lng, radius, nextPageToken || undefined);
        return setCorsHeaders(NextResponse.json(data));
      }

      // Query yoksa ve type varsa -> Nearby Search (New) kullan
      if (type) {
        const data = await nearbySearchNew(type, lat, lng, radius, nextPageToken || undefined);
        return setCorsHeaders(NextResponse.json(data));
      }

      // Query ve type yoksa hata
      return setCorsHeaders(NextResponse.json(
        { error: "missing_query_or_type" },
        { status: 400 }
      ));
    } else if (endpoint === "details") {
      const placeId = searchParams.get("place_id");
      if (!placeId) {
        return setCorsHeaders(NextResponse.json({ error: "missing_place_id" }, { status: 400 }));
      }

      // Place Details (New) - GET request
      // Place ID formatını kontrol et ve normalize et
      // Google Places API (New) place_id formatı: places/ChIJ... veya sadece ChIJ...
      let normalizedId = placeId.trim();
      
      // Eğer places/PLACE_ID/photos/... formatındaysa (photo reference) sadece place ID'yi al
      if (normalizedId.includes("/photos/")) {
        // Photo reference formatından place ID'yi çıkar: places/PLACE_ID/photos/PHOTO_ID
        const placeIdMatch = normalizedId.match(/places\/([^/]+)/);
        if (placeIdMatch) {
          normalizedId = `places/${placeIdMatch[1]}`;
        } else {
          // Photo reference içinde place ID bulunamadı, hata
          return setCorsHeaders(NextResponse.json(
            { error: "invalid_place_id_format", placeId },
            { status: 400 }
          ));
        }
      } else if (normalizedId.startsWith("places/")) {
        // Zaten places/ ile başlıyor, olduğu gibi kullan
        // Ama places/places/ gibi tekrarlı prefix kontrolü yap
        if (normalizedId.startsWith("places/places/")) {
          normalizedId = normalizedId.replace(/^places\//, "");
        }
        // Eğer places/ ile başlıyor ama ID kısmı yoksa hata
        if (normalizedId === "places/" || normalizedId.endsWith("/")) {
          return setCorsHeaders(NextResponse.json(
            { error: "invalid_place_id_format", placeId },
            { status: 400 }
          ));
        }
      } else {
        // places/ ile başlamıyorsa ekle
        // ID'nin boş olmadığından emin ol
        if (!normalizedId || normalizedId.length < 10) {
          return setCorsHeaders(NextResponse.json(
            { error: "invalid_place_id_format", placeId },
            { status: 400 }
          ));
        }
        normalizedId = `places/${normalizedId}`;
      }
      
      // FieldMask: Google Places API (New) için field mask
      // photos field'ı tüm fotoğrafları getirir (max 10 fotoğraf)
      // Not: Field mask syntax'ı: "field.subfield" veya sadece "field"
      const fieldMask = [
        "id",
        "displayName",
        "formattedAddress",
        "formattedPhoneNumber",
        "websiteUri",
        "location",
        "location.latitude",
        "location.longitude",
        "regularOpeningHours.weekdayDescriptions",
        "photos", // photos field'ı tüm photo bilgilerini içerir (name, widthPx, heightPx)
        "types",
        "rating",
        "userRatingCount",
        "reviews.authorAttribution.displayName",
        "reviews.text.text",
        "reviews.rating",
        "reviews.publishTime",
      ].join(",");
      
      const url = `https://places.googleapis.com/v1/${normalizedId}`;
      
      console.log("[Google Details] Request:", {
        placeId,
        normalizedId,
        fieldMask,
        url: url.substring(0, 100) + "...",
      });
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": fieldMask,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: { message: errorText || "Unknown error" } };
        }
        
        // 400 hatası durumunda daha detaylı log
        const errorMessage = error.error?.message || error.message || "Place details failed";
        console.error("[Google Details] Error:", {
          status: response.status,
          statusText: response.statusText,
          error: error.error || error,
          errorText: errorText.substring(0, 500),
          placeId,
          normalizedId,
          url,
          fieldMask,
        });
        
        // 400 hatası için özel mesaj
        if (response.status === 400) {
          console.warn("[Google Details] 400 Bad Request - Possible causes: invalid place ID format, invalid field mask, or API key issue");
        }
        
        return setCorsHeaders(NextResponse.json(
          { 
            error: errorMessage,
            detail: error.error || error,
            placeId,
            normalizedId,
          },
          { status: response.status }
        ));
      }

      const data = await response.json();
      
      // Google Places API'den gelen fotoğraf sayısını logla
      const rawPhotosCount = data.photos?.length || 0;
      console.log("[Google Details] API Response:", {
        placeId: normalizedId,
        rawPhotosCount,
        photos: data.photos?.map((p: any) => p.name) || [],
      });
      
      // Yeni API formatını eski formata çevir (backward compatibility)
      const photosArray = (data.photos || []).map((photo: any) => ({
        photo_reference: photo.name, // Yeni API'de name kullanılıyor
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
      }));
      
      console.log("[Google Details] Processed photos:", {
        placeId: normalizedId,
        processedPhotosCount: photosArray.length,
        photoReferences: photosArray.map((p: any) => p.photo_reference),
      });
      
      const result = {
        result: {
          place_id: data.id,
          name: data.displayName?.text || "",
          formatted_address: data.formattedAddress || "",
          formatted_phone_number: data.formattedPhoneNumber || "",
          website: data.websiteUri || "",
          opening_hours: data.regularOpeningHours ? {
            weekday_text: data.regularOpeningHours.weekdayDescriptions || [],
          } : null,
          photos: photosArray,
          geometry: {
            location: {
              lat: data.location?.latitude || 0,
              lng: data.location?.longitude || 0,
            },
          },
          types: data.types || [],
          rating: data.rating || null,
          user_ratings_total: data.userRatingCount || 0,
          reviews: (data.reviews || []).map((review: any) => ({
            author_name: review.authorAttribution?.displayName || "Ziyaretçi",
            text: review.text?.text || "",
            rating: review.rating || null,
            relative_time_description: review.publishTime || "",
          })),
        },
      };

      return setCorsHeaders(NextResponse.json(result));
    } else if (endpoint === "photo") {
      const ref = searchParams.get("ref");
      const maxwidth = searchParams.get("maxwidth") || "800";
      const maxheight = searchParams.get("maxheight") || maxwidth; // Default to maxwidth if not specified
      
      if (!ref) {
        return setCorsHeaders(NextResponse.json(
          { error: "missing_photo_reference" },
          { status: 400 }
        ));
      }

      // Place Photos (New API v1) - photo name format: places/PLACE_ID/photos/PHOTO_RESOURCE
      // According to Google Places API documentation:
      // GET https://places.googleapis.com/v1/places/{PLACE_ID}/photos/{PHOTO_ID}/media?maxHeightPx=400&maxWidthPx=400&key=YOUR_API_KEY
      // ref zaten URL-encoded geliyor (places%2FChIJ...%2Fphotos%2F...)
      let decoded = decodeURIComponent(ref);
      
      // Decode edilmiş hali places/PLACE_ID/photos/PHOTO_ID formatında olmalı
      let photoName = decoded;
      
      // Eğer hala encoded görünüyorsa (çift encoding), tekrar decode et
      if (photoName.includes("%2F") || photoName.includes("%")) {
        photoName = decodeURIComponent(photoName);
      }
      
      // Eğer ref sadece photo resource ID ise (places/ ile başlamıyorsa)
      // Bu durumda place ID'yi bilmiyoruz, bu bir hata olmalı
      if (!photoName.startsWith("places/")) {
        console.warn("[Google Photo] Photo reference does not start with 'places/':", photoName);
        // Fotoğraf referansı geçersiz format, hata döndür
        return setCorsHeaders(NextResponse.json(
          { error: "invalid_photo_reference_format", ref: photoName },
          { status: 400 }
        ));
      }
      
      // Google Places API v1 photo endpoint requires /media suffix
      // photoName format: places/PLACE_ID/photos/PHOTO_ID
      // URL format: https://places.googleapis.com/v1/places/PLACE_ID/photos/PHOTO_ID/media
      // Build URL - photoName'a /media ekle
      const urlParams = new URLSearchParams({
        maxWidthPx: maxwidth,
        maxHeightPx: maxheight,
        key: GOOGLE_PLACES_KEY,
      });
      
      // URL path kısmını encode etme, sadece query params'ı ekle
      const url = `https://places.googleapis.com/v1/${photoName}/media?${urlParams.toString()}`;
      
      console.log("[Google Photo] Request:", {
        photoName: photoName.substring(0, 100) + "...",
        maxWidthPx: maxwidth,
        maxHeightPx: maxheight,
        url: url.substring(0, 150) + "...",
      });
      
      // Fetch photo - API key is in query params, but also try header as fallback
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("[Google Photo] Error:", {
          status: response.status,
          error: error.error || error,
          photoName: photoName.substring(0, 100) + "...",
        });
        return setCorsHeaders(
          NextResponse.json(
            { error: "google_photo_failed", detail: error.error || error },
            { status: response.status }
          )
        );
      }

      // Fotoğrafı proxy üzerinden döndür
      const imageBuffer = await response.arrayBuffer();
      const photoResponse = new NextResponse(imageBuffer, {
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
      return setCorsHeaders(photoResponse);
    }

    return setCorsHeaders(NextResponse.json({ error: "invalid_endpoint" }, { status: 400 }));
  } catch (error: any) {
    console.error("Google proxy error:", error);
    return setCorsHeaders(NextResponse.json(
      { error: "proxy_failed", detail: error.message },
      { status: 502 }
    ));
  }
}
