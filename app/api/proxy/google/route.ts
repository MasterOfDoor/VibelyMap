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

// Google Places API (New) - Text Search
async function textSearchNew(q: string, lat: string, lng: string, radius: string, pageToken?: string) {
  const requestBody: any = {
    textQuery: q,
    locationBias: {
      circle: {
        center: {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
        radius: parseFloat(radius),
      },
    },
    pageSize: 20,
  };

  if (pageToken) {
    requestBody.pageToken = pageToken;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get("endpoint");

  if (!GOOGLE_PLACES_KEY) {
    return setCorsHeaders(NextResponse.json({ error: "missing_google_key" }, { status: 500 }));
  }

  try {
    if (endpoint === "textsearch") {
      const q = searchParams.get("q") || "";
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      const radius = searchParams.get("radius") || "3000";
      const type = searchParams.get("type") || "";
      const nextPageToken = searchParams.get("pagetoken") || "";

      if (!lat || !lng) {
        return setCorsHeaders(NextResponse.json(
          { error: "missing_coords" },
          { status: 400 }
        ));
      }

      // Tek kelimelik query ve type varsa -> Nearby Search (New)
      const queryWords = q.trim().split(/\s+/).filter(Boolean);
      const isSingleWord = queryWords.length === 1;
      
      if (isSingleWord && type) {
        const data = await nearbySearchNew(type, lat, lng, radius, nextPageToken || undefined);
        return setCorsHeaders(NextResponse.json(data));
      }

      // Query yoksa ve type varsa -> Nearby Search (New)
      if (!q.trim() && type) {
        const data = await nearbySearchNew(type, lat, lng, radius, nextPageToken || undefined);
        return setCorsHeaders(NextResponse.json(data));
      }

      // Query varsa -> Text Search (New)
      if (!q.trim()) {
        return setCorsHeaders(NextResponse.json(
          { error: "missing_query" },
          { status: 400 }
        ));
      }

      const data = await textSearchNew(q, lat, lng, radius, nextPageToken || undefined);
      return setCorsHeaders(NextResponse.json(data));
    } else if (endpoint === "details") {
      const placeId = searchParams.get("place_id");
      if (!placeId) {
        return setCorsHeaders(NextResponse.json({ error: "missing_place_id" }, { status: 400 }));
      }

      // Place Details (New) - GET request
      // Place ID formatını kontrol et ve normalize et
      let normalizedId = placeId;
      if (!normalizedId.startsWith("places/")) {
        normalizedId = `places/${normalizedId}`;
      }
      
      // FieldMask: Google Places API (New) için field mask
      // photos field'ı tüm fotoğrafları getirir (max 10 fotoğraf)
      const fieldMask = [
        "id",
        "displayName",
        "formattedAddress",
        "formattedPhoneNumber",
        "websiteUri",
        "regularOpeningHours.weekdayDescriptions",
        "photos", // Tüm fotoğraf bilgileri (name, widthPx, heightPx dahil)
        "location",
        "types",
        "rating",
        "userRatingCount",
        "reviews", // Tüm review bilgileri
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
        const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
        console.error("[Google Details] Error:", {
          status: response.status,
          error: error.error || error,
          placeId,
          normalizedId,
        });
        return setCorsHeaders(NextResponse.json(
          { error: error.error?.message || error.message || "Place details failed" },
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
      // GET https://places.googleapis.com/v1/PHOTO_NAME/media?maxHeightPx=400&maxWidthPx=400&key=YOUR_API_KEY
      // Note: /media endpoint is required for photo requests
      const decoded = decodeURIComponent(ref);
      const photoName = decoded.startsWith("places/") ? decoded : decoded;
      
      // Build URL with query parameters (API key in query params as per documentation)
      const urlParams = new URLSearchParams({
        maxWidthPx: maxwidth,
        maxHeightPx: maxheight,
        key: GOOGLE_PLACES_KEY,
      });
      
      const url = `https://places.googleapis.com/v1/${photoName}/media?${urlParams.toString()}`;
      
      console.log("[Google Photo] Request:", {
        photoName: photoName.substring(0, 100) + "...",
        maxWidthPx: maxwidth,
        maxHeightPx: maxheight,
        url: url.substring(0, 150) + "...",
      });
      
      // Fetch photo - API key is in query params, no need for header
      const response = await fetch(url, {
        method: "GET",
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
