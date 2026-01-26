"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useMapPlaces } from "./hooks/useMapPlaces";
import { useMapSearch } from "./hooks/useMapSearch";
import { useMapFilters } from "./hooks/useMapFilters";
import { analyzePlacesPhotos } from "./hooks/ChatGPT_analysis";
import { useAIAnalysis } from "./hooks/useAIAnalysis";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { Place } from "./components/DetailPanel";
import { buildQueryFromFilters } from "./utils/filterHelpers";
import { useProxy } from "./hooks/useProxy";
import TopBar from "./components/TopBar";
import SearchOverlay from "./components/SearchOverlay";
import ResultsPanel from "./components/ResultsPanel";
import DetailPanel from "./components/DetailPanel";
import FilterPanel, { FilterState } from "./components/FilterPanel";
import ProfilePanel from "./components/ProfilePanel";
import WalletConnectionScreen from "./components/WalletConnectionScreen";
import UsernameSetupModal from "./components/UsernameSetupModal";

// Haritayı dinamik olarak yükle (SSR sorunlarını önlemek için)
// loading prop'u ile yükleme durumunu göster
const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gray-100" style={{ zIndex: 1 }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4a657] mx-auto mb-4"></div>
        <p className="text-gray-600">Harita yükleniyor...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { address, isConnected } = useAccount();
  
  // Tag migration'ı bir kere çalıştır (sadece client-side)
  useEffect(() => {
    const runTagMigration = async () => {
      try {
        // Migration durumunu kontrol et
        const statusResponse = await fetch("/api/migrate/tags");
        if (!statusResponse.ok) {
          console.warn("[Tag Migration] Status check failed:", statusResponse.status);
          return;
        }
        
        let status;
        try {
          const statusText = await statusResponse.text();
          status = statusText ? JSON.parse(statusText) : { completed: false };
        } catch (parseError) {
          console.warn("[Tag Migration] Failed to parse status response, assuming not completed");
          status = { completed: false };
        }
        
        // Eğer migration tamamlanmamışsa çalıştır
        if (!status.completed) {
          const response = await fetch("/api/migrate/tags", {
            method: "POST",
          });
          
          if (!response.ok) {
            console.warn("[Tag Migration] Migration request failed:", response.status);
            return;
          }
          
          let result;
          try {
            const resultText = await response.text();
            result = resultText ? JSON.parse(resultText) : { success: false };
          } catch (parseError) {
            console.warn("[Tag Migration] Failed to parse migration response");
            return;
          }
          
          if (result.success) {
            console.log("[Tag Migration] Completed:", result.message);
          }
        }
      } catch (error: any) {
        // Migration hatası kritik değil, sessizce geç
        console.warn("[Tag Migration] Failed or already completed:", error?.message || error);
      }
    };
    
    // Sadece client-side'da çalıştır
    if (typeof window !== "undefined") {
      runTagMigration();
    }
  }, []); // Sadece bir kere çalışır
  const { setMiniAppReady, isMiniAppReady } = useMiniKit();

  // Farcaster SDK ready (if available)
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).farcaster?.sdk?.actions?.ready) {
      (window as any).farcaster.sdk.actions.ready();
    }
  }, []);


  // Base Mini App SDK ready callback
  useEffect(() => {
    if (!isMiniAppReady) {
      setMiniAppReady();
    }
  }, [setMiniAppReady, isMiniAppReady]);

  // Harita bileşenini önceden yükle (cüzdan bağlandığında hemen hazır olsun)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // MapComponent'i önceden yükle
      import("./components/MapComponent");
    }
  }, []);
  const { places, loading: placesLoading, loadPlaces, setPlaces } = useMapPlaces();
  const {
    isSearchOpen,
    searchMode,
    openSearch,
    closeSearch,
    performSearch,
  } = useMapSearch();
  const { filterPlaces, applyFilters, resetFilters } = useMapFilters();
  const { googlePlaceDetails } = useProxy();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    main: [],
    sub: {},
  });

  const handlePlaceUpdate = useCallback((placeId: string, updatedPlace: Place) => {
    // Places listesindeki ilgili place'i güncelle
    const updatedPlaces = places.map((p: Place) => {
      if (p.id === placeId) {
        return updatedPlace;
      }
      return p;
    });
    setPlaces(updatedPlaces);
    
    // Eğer seçili place ise, onu da güncelle
    setSelectedPlace((prevSelected) => {
      if (prevSelected?.id === placeId) {
        return updatedPlace;
      }
      return prevSelected;
    });
  }, [places, setPlaces]);

  // AI Analizi Hook'u
  const { triggerAnalysis, isPlaceAnalyzing } = useAIAnalysis(places, setPlaces, handlePlaceUpdate);

  // Filter places based on current filters
  const filteredPlaces = useMemo(() => {
    return filterPlaces(places || [], currentFilters);
  }, [places, currentFilters, filterPlaces]);

  const handlePlaceClick = useCallback((place: Place) => {
    // Places listesinden güncel place'i bul (analiz sonuçları dahil)
    const updatedPlace = places.find((p) => p.id === place.id) || place;
    setSelectedPlace(updatedPlace);
    setIsDetailOpen(true);
    setIsResultsOpen(false);

    // Marker'a tıklandığında analizi başlat
    triggerAnalysis(updatedPlace);
  }, [places, triggerAnalysis]);

  const handleSearch = useCallback(
    async (query: string) => {
      console.log("[handleSearch] Arama başlatılıyor:", query);
      const results = await performSearch(query);
      console.log("[handleSearch] Sonuç sayısı:", results.length);
      
      // Reset filters when new search is performed
      setCurrentFilters({ main: [], sub: {} });
      resetFilters();
      
      if (results.length > 0) {
        // Google Places'ten place ID'leri alındı
        // Cache kontrolü ve analiz marker tıklamasına ertelendi
        console.log("[handleSearch] Place ID'leri alındı, AI analizi marker tıklamasına ertelendi");
        console.log("[handleSearch] Place IDs:", results.map(r => r.id));
        setIsResultsOpen(true);
        setPlaces(results);
      }
    },
    [performSearch, resetFilters, setPlaces]
  );

  // Handle place selection from autocomplete
  const handlePlaceSelect = useCallback(
    async (placeId: string) => {
      console.log("[handlePlaceSelect] Place ID seçildi:", placeId);
      try {
        // Fetch place details using proxy
        const detailData = await googlePlaceDetails(placeId);
        const result = detailData?.result || detailData;
        
        if (result) {
          // Convert to Place format using useMapPlaces normalization logic
          const photos = Array.isArray(result.photos) && result.photos.length > 0
            ? result.photos.map((p: any) => {
                const ref = p?.photo_reference || p?.name;
                return ref ? `/api/proxy/google?endpoint=photo&ref=${encodeURIComponent(ref)}&maxwidth=800` : "";
              }).filter(Boolean)
            : [];

          const place: Place = {
            id: result.place_id || placeId,
            name: result.name || "",
            type: result.types?.[0] || "Mekan",
            coords: result.geometry?.location 
              ? [result.geometry.location.lat, result.geometry.location.lng]
              : [41.015137, 28.97953],
            address: result.formatted_address || "",
            website: result.website || "",
            hours: Array.isArray(result.opening_hours?.weekday_text)
              ? result.opening_hours.weekday_text.join(" | ")
              : "",
            rating: result.rating || null,
            tel: result.formatted_phone_number || "",
            photo: photos[0] || "",
            photos: photos.length > 0 ? photos : undefined,
            tags: result.types || [],
            subOptions: { 
              Kategori: result.types?.map((t: string) => t.replace(/_/g, " ")) || [] 
            },
          };

          // Show place on map and open detail panel
          setPlaces([place]);
          setSelectedPlace(place);
          setIsDetailOpen(true);
          setIsResultsOpen(false);

          // Trigger AI analysis for this place
          triggerAnalysis(place);
        }
      } catch (error: any) {
        console.error("[handlePlaceSelect] Error:", error);
        // Fallback to regular search with place ID as query
        handleSearch(placeId);
      }
    },
    [googlePlaceDetails, setPlaces, triggerAnalysis, handleSearch]
  );

  const handleApplyFilters = useCallback(
    async (filters: FilterState) => {
      // Kategori kontrolü
      const kategoriFilters = filters.sub.Kategori || [];
      if (kategoriFilters.length === 0) {
        alert("En az bir kategori seçmelisiniz.");
        return;
      }

      // Kullanıcı konumunu al
      let userLocation = { lat: 41.015137, lng: 28.97953 }; // Varsayılan İstanbul
      if ((window as any).getUserLocation) {
        const loc = (window as any).getUserLocation();
        if (loc) {
          userLocation = loc;
        }
      } else if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
              });
            }
          );
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (err) {
          console.warn("Konum alınamadı, varsayılan konum kullanılıyor:", err);
        }
      }

      // Kategori filtrelerini al
      const kategoriOptions = filters.sub.Kategori || [];
      if (kategoriOptions.length === 0) {
        alert("En az bir kategori seçmelisiniz.");
        return;
      }

      setIsFilterOpen(false);
      setCurrentFilters(filters);
      applyFilters(filters);

      try {
        // 1. Her kategori için ayrı ayrı arama yap ve sonuçları birleştir
        const allResults: Place[] = [];
        const seenIds = new Set<string>();

        for (const kategori of kategoriOptions) {
          // Her kategori için birden fazla arama parametresi tanımla
          type SearchParam = {
            query: string;
            type?: string;
          };

          let searchParams: SearchParam[] = [];
          
          if (kategori === "Kafe") {
            // Kafe için ana arama + ekstra parametreler
            searchParams = [
              { query: "cafe", type: "cafe" },
              { query: "coffee shop", type: "cafe" },
              { query: "kahve", type: "cafe" },
              { query: "dog_cafe", type: "dog_cafe" },
            ];
          } else if (kategori === "Restoran") {
            // Restoran için ana arama + ekstra parametreler
            searchParams = [
              { query: "restaurant", type: "restaurant" },
              { query: "restoran", type: "restaurant" },
              { query: "lokanta", type: "restaurant" },
              // Google Places restaurant types
              { query: "acai_shop", type: "acai_shop" },
              { query: "afghani_restaurant", type: "afghani_restaurant" },
              { query: "african_restaurant", type: "african_restaurant" },
              { query: "american_restaurant", type: "american_restaurant" },
              { query: "asian_restaurant", type: "asian_restaurant" },
              { query: "bagel_shop", type: "bagel_shop" },
              { query: "bakery", type: "bakery" },
              { query: "bar_and_grill", type: "bar_and_grill" },
              { query: "barbecue_restaurant", type: "barbecue_restaurant" },
              { query: "brazilian_restaurant", type: "brazilian_restaurant" },
              { query: "breakfast_restaurant", type: "breakfast_restaurant" },
              { query: "brunch_restaurant", type: "brunch_restaurant" },
              { query: "buffet_restaurant", type: "buffet_restaurant" },
              { query: "chinese_restaurant", type: "chinese_restaurant" },
              { query: "chocolate_factory", type: "chocolate_factory" },
              { query: "chocolate_shop", type: "chocolate_shop" },
              { query: "confectionery", type: "confectionery" },
              { query: "deli", type: "deli" },
              { query: "dessert_restaurant", type: "dessert_restaurant" },
              { query: "dessert_shop", type: "dessert_shop" },
              { query: "diner", type: "diner" },
              { query: "donut_shop", type: "donut_shop" },
              { query: "fast_food_restaurant", type: "fast_food_restaurant" },
              { query: "fine_dining_restaurant", type: "fine_dining_restaurant" },
              { query: "food_court", type: "food_court" },
              { query: "french_restaurant", type: "french_restaurant" },
              { query: "greek_restaurant", type: "greek_restaurant" },
              { query: "hamburger_restaurant", type: "hamburger_restaurant" },
              { query: "ice_cream_shop", type: "ice_cream_shop" },
              { query: "indian_restaurant", type: "indian_restaurant" },
              { query: "indonesian_restaurant", type: "indonesian_restaurant" },
              { query: "italian_restaurant", type: "italian_restaurant" },
              { query: "japanese_restaurant", type: "japanese_restaurant" },
              { query: "juice_shop", type: "juice_shop" },
              { query: "korean_restaurant", type: "korean_restaurant" },
              { query: "lebanese_restaurant", type: "lebanese_restaurant" },
              { query: "meal_delivery", type: "meal_delivery" },
              { query: "meal_takeaway", type: "meal_takeaway" },
              { query: "mediterranean_restaurant", type: "mediterranean_restaurant" },
              { query: "mexican_restaurant", type: "mexican_restaurant" },
              { query: "middle_eastern_restaurant", type: "middle_eastern_restaurant" },
              { query: "pizza_restaurant", type: "pizza_restaurant" },
              { query: "ramen_restaurant", type: "ramen_restaurant" },
              { query: "sandwich_shop", type: "sandwich_shop" },
              { query: "seafood_restaurant", type: "seafood_restaurant" },
              { query: "spanish_restaurant", type: "spanish_restaurant" },
              { query: "steak_house", type: "steak_house" },
              { query: "sushi_restaurant", type: "sushi_restaurant" },
              { query: "tea_house", type: "tea_house" },
              { query: "thai_restaurant", type: "thai_restaurant" },
              { query: "turkish_restaurant", type: "turkish_restaurant" },
              { query: "vegan_restaurant", type: "vegan_restaurant" },
              { query: "vegetarian_restaurant", type: "vegetarian_restaurant" },
              { query: "vietnamese_restaurant", type: "vietnamese_restaurant" },
            ];
          } else if (kategori === "Bar") {
            searchParams = [
              { query: "bar", type: "bar" },
              { query: "wine_bar", type: "wine_bar" },
              { query: "pub", type: "pub" },
            ];
          } else if (kategori === "Cocktail Lounge") {
            searchParams = [
              { query: "cocktail lounge", type: "bar" },
            ];
          } else if (kategori === "Meyhane") {
            searchParams = [
              { query: "meyhane", type: "bar" },
            ];
          } else if (kategori === "Shot Bar") {
            searchParams = [
              { query: "shot bar", type: "bar" },
            ];
          } else {
            searchParams = [
              { query: kategori.toLowerCase(), type: kategori.toLowerCase() },
            ];
          }

          // Her parametre için ayrı ayrı arama yap ve sonuçları birleştir
          // Kategori aramalarında sadece type kullanılmalı, query gönderilmemeli (nearby search için)
          for (const searchParam of searchParams) {
            // Kategori aramalarında query gönderme - sadece type ile nearby search kullan
            const categoryResults = await loadPlaces("", {
              lat: userLocation.lat,
              lng: userLocation.lng,
              radius: 1500, // Google Maps gibi optimize edilmiş sabit radius (kullanıcı seçemez)
              type: searchParam.type, // Yeni API için type parametresi - nearby search kullanılacak
            });

            // Duplicate'leri filtrele ve ekle
            categoryResults.forEach((place) => {
              if (!seenIds.has(place.id)) {
                seenIds.add(place.id);
                allResults.push(place);
              }
            });
          }
        }

        const results = allResults;

        // 2. Diğer filtreler var mı kontrol et (Kategori dışında)
        const otherFilters = Object.keys(filters.sub).filter(
          (key) => key !== "Kategori" && filters.sub[key].length > 0
        );
        
        // Range filtreleri var mı kontrol et (default değerler dikkate alınmaz)
        // Default değerler: Isiklandirma: 3, Oturma: 0, Priz: 0
        const hasRangeFilters = filters.ranges && Object.keys(filters.ranges).some((key) => {
          const value = filters.ranges![key];
          // Sadece AI analizini tetikleyecek fiziksel kriterleri kontrol et
          if (key === "Isiklandirma" && value === 3) return false;
          if (key === "Oturma" && value === 0) return false;
          if (key === "Priz" && value === 0) return false;
          return true; // Kullanıcı bu değerlerden birini değiştirdiyse true döner
        });
        
        // Eğer sadece kategori seçildiyse (diğer filtreler ve range filtreleri yoksa), AI analizini marker tıklamasına ertele
        const shouldDeferAnalysis = otherFilters.length === 0 && !hasRangeFilters;

        if (results.length > 0) {
          if (shouldDeferAnalysis) {
            // Sadece kategori seçildi, AI analizini marker tıklamasına ertele
            console.log("[handleApplyFilters] Sadece kategori seçildi, AI analizi marker tıklamasına ertelendi");
            setPlaces(results);
            setIsResultsOpen(true);
          } else {
            // Diğer filtreler veya range filtreleri var, AI analizini hemen yap
            // Önce cache kontrolü yapılacak, sadece cache'de olmayanlar için analiz yapılacak
            console.log("[handleApplyFilters] Place ID'leri alındı:", results.map(r => r.id));
            console.log("[handleApplyFilters] AI analizi başlatılıyor (ChatGPT & Gemini %50/%50)...", results.length, "mekan için");
            console.log("[handleApplyFilters] Önce cache kontrolü yapılacak, sonra sadece gerekli olanlar için analiz yapılacak");
            setIsBatchAnalyzing(true);
            try {
              const analysisResults = await analyzePlacesPhotos(results);
              const resultsWithTags = Array.from(analysisResults.keys());
              const resultsWithoutTags = results.filter(r => !analysisResults.has(r.id)).map(r => r.id);
              
              console.log("[handleApplyFilters] AI analizi tamamlandı:", {
                totalResults: results.length,
                resultsWithTags: resultsWithTags.length,
                resultsWithoutTags: resultsWithoutTags.length,
                placeIdsWithTags: resultsWithTags.slice(0, 5),
              });

              // Analiz sonuçlarını places'lere uygula
              const enrichedResults = results.map((place) => {
                const analysisTags = analysisResults.get(place.id);
                if (analysisTags && analysisTags.length > 0) {
                  console.log(`[handleApplyFilters] ✅ Mekan zenginleştirildi (${analysisTags.length} tag):`, place.name);
                  return {
                    ...place,
                    tags: [...(place.tags || []), ...analysisTags],
                  };
                } else {
                  console.log(`[handleApplyFilters] ⚠️ Mekan tag'siz (cache'de yok ve analiz başarısız):`, place.name);
                }
                return place;
              });

              // Analiz sonrası filtreleme yap
              const filteredAfterAnalysis = filterPlaces(enrichedResults, filters);
              
              console.log("[handleApplyFilters] Filtreleme sonrası:", {
                enrichedResults: enrichedResults.length,
                filteredResults: filteredAfterAnalysis.length,
              });
              
              setPlaces(filteredAfterAnalysis);
              
              if (filteredAfterAnalysis.length > 0) {
                setIsResultsOpen(true);
              } else {
                alert("Seçtiğiniz filtrelerle eşleşen mekan bulunamadı.");
              }
            } catch (error: any) {
              console.error("[handleApplyFilters] ❌ AI analizi kritik hatası:", {
                error: error.message,
                stack: error.stack,
                placeIdsCount: results.length,
              });
              // Hata durumunda orijinal sonuçları göster (cache'den gelenler varsa onlar kullanılabilir)
              // Google Places sonuçları zaten mevcut, sadece AI analizi başarısız oldu
              setPlaces(results);
              setIsResultsOpen(true);
              console.warn("[handleApplyFilters] ⚠️ AI analizi başarısız oldu, ancak Google Places sonuçları gösteriliyor");
            } finally {
              setIsBatchAnalyzing(false);
            }
          }
        }
      } catch (error: any) {
        console.error("Filtre uygulama hatası:", error);
        alert("Filtre uygulanırken bir hata oluştu: " + error.message);
      }
    },
    [loadPlaces, applyFilters, filterPlaces, setPlaces]
  );

  const handleResetFilters = useCallback(() => {
    setCurrentFilters({ main: [], sub: {} });
    resetFilters();
  }, [resetFilters]);

  // Wallet bağlantısı kontrolü - bağlı değilse wallet seçim ekranını göster
  if (!isConnected) {
    return <WalletConnectionScreen />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* Wallet bağlı - uygulama gösteriliyor */}
      {address && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm">
          Wallet: {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      )}

      <TopBar
        onMenuToggle={() => setIsFilterOpen(!isFilterOpen)}
        onSearchClick={() => openSearch("map")}
        onLocationClick={() => {
          if ((window as any).handleMapLocation) {
            (window as any).handleMapLocation();
          }
        }}
        onProfileClick={() => {
          if (isProfileOpen) {
            setIsProfileOpen(false);
            setIsDetailOpen(false);
            setSelectedPlace(null);
          } else {
            setIsProfileOpen(true);
            setIsDetailOpen(false);
            setSelectedPlace(null);
          }
        }}
        onEventsClick={() => openSearch("event")}
      />

      <MapComponent
        places={filteredPlaces}
        selectedPlace={selectedPlace}
        onPlaceClick={handlePlaceClick}
        onLocationClick={() => {
          if ((window as any).handleMapLocation) {
            (window as any).handleMapLocation();
          }
        }}
        shouldFitBounds={isResultsOpen && filteredPlaces.length > 0}
        isPlaceAnalyzing={isPlaceAnalyzing}
        isBatchAnalyzing={isBatchAnalyzing}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSearch={handleSearch}
        onPlaceSelect={handlePlaceSelect}
        searchMode={searchMode}
      />

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />

      <ResultsPanel
        isOpen={isResultsOpen}
        places={filteredPlaces}
        onClose={() => setIsResultsOpen(false)}
        onPlaceClick={handlePlaceClick}
        isPlaceAnalyzing={isPlaceAnalyzing}
      />

      <DetailPanel
        isOpen={isDetailOpen}
        place={selectedPlace}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedPlace(null);
        }}
        onPlaceUpdate={handlePlaceUpdate}
        isAnalyzing={selectedPlace ? isPlaceAnalyzing(selectedPlace.id) : false}
      />

      <ProfilePanel
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <UsernameSetupModal />
    </main>
  );
}

