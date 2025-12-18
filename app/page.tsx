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
import TopBar from "./components/TopBar";
import SearchOverlay from "./components/SearchOverlay";
import ResultsPanel from "./components/ResultsPanel";
import DetailPanel from "./components/DetailPanel";
import FilterPanel, { FilterState } from "./components/FilterPanel";
import ProfilePanel from "./components/ProfilePanel";
import WalletConnectionScreen from "./components/WalletConnectionScreen";
import UsernameSetupModal from "./components/UsernameSetupModal";

// Leaflet haritasını dinamik olarak yükle (SSR sorunlarını önlemek için)
const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
});

export default function Home() {
  const { address, isConnected } = useAccount();
  
  // Tag migration'ı bir kere çalıştır (sadece client-side)
  useEffect(() => {
    const runTagMigration = async () => {
      try {
        // Migration durumunu kontrol et
        const statusResponse = await fetch("/api/migrate/tags");
        const status = await statusResponse.json();
        
        // Eğer migration tamamlanmamışsa çalıştır
        if (!status.completed) {
          const response = await fetch("/api/migrate/tags", {
            method: "POST",
          });
          const result = await response.json();
          if (result.success) {
            console.log("[Tag Migration] Completed:", result.message);
          }
        }
      } catch (error) {
        // Migration hatası kritik değil, sessizce geç
        console.warn("[Tag Migration] Failed or already completed:", error);
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
  const { places, loading: placesLoading, loadPlaces, setPlaces } = useMapPlaces();
  const {
    isSearchOpen,
    searchMode,
    openSearch,
    closeSearch,
    performSearch,
  } = useMapSearch();
  const { filterPlaces, applyFilters, resetFilters } = useMapFilters();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
          let categoryQuery = "";
          let categoryType = "";
          
          if (kategori === "Kafe") {
            categoryQuery = "cafe";
            categoryType = "cafe";
          } else if (kategori === "Restoran") {
            categoryQuery = "restaurant";
            categoryType = "restaurant";
          } else if (kategori === "Bar") {
            categoryQuery = "bar";
            categoryType = "bar";
          } else {
            categoryQuery = kategori.toLowerCase();
            categoryType = kategori.toLowerCase();
          }

          const categoryResults = await loadPlaces(categoryQuery, {
            lat: userLocation.lat,
            lng: userLocation.lng,
            radius: 3000, // 3km
            type: categoryType, // Yeni API için type parametresi
          });

          // Duplicate'leri filtrele ve ekle
          categoryResults.forEach((place) => {
            if (!seenIds.has(place.id)) {
              seenIds.add(place.id);
              allResults.push(place);
            }
          });
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
          // Isiklandirma default: 3, Oturma default: 0, Priz default: 0
          if (key === "Isiklandirma" && value === 3) return false;
          if (key === "Oturma" && value === 0) return false;
          if (key === "Priz" && value === 0) return false;
          return true; // Default dışında bir değer varsa true döndür
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
            console.log("[handleApplyFilters] AI analizi başlatılıyor (ChatGPT)...", results.length, "mekan için");
            console.log("[handleApplyFilters] Önce cache kontrolü yapılacak, sonra sadece gerekli olanlar için analiz yapılacak");
            try {
              const analysisResults = await analyzePlacesPhotos(results);
              console.log("[handleApplyFilters] AI analizi tamamlandı, sonuç:", analysisResults.size);
              console.log("[handleApplyFilters] Analiz edilen place ID'leri:", Array.from(analysisResults.keys()));

              // Analiz sonuçlarını places'lere uygula
              const enrichedResults = results.map((place) => {
                const analysisTags = analysisResults.get(place.id);
                if (analysisTags && analysisTags.length > 0) {
                  console.log("[handleApplyFilters] Mekan zenginleştirildi:", place.name, "Tags:", analysisTags);
                  return {
                    ...place,
                    tags: [...(place.tags || []), ...analysisTags],
                  };
                }
                return place;
              });

              // Analiz sonrası filtreleme yap
              const filteredAfterAnalysis = filterPlaces(enrichedResults, filters);
              setPlaces(filteredAfterAnalysis);
              
              if (filteredAfterAnalysis.length > 0) {
                setIsResultsOpen(true);
              } else {
                alert("Seçtiğiniz filtrelerle eşleşen mekan bulunamadı.");
              }
            } catch (error: any) {
              console.error("[handleApplyFilters] AI analizi hatası:", error);
              // Hata durumunda orijinal sonuçları göster (cache'den gelenler varsa onlar kullanılabilir)
              // Google Places sonuçları zaten mevcut, sadece AI analizi başarısız oldu
              setPlaces(results);
              setIsResultsOpen(true);
              // Kullanıcıya bilgi ver (opsiyonel)
              console.warn("[handleApplyFilters] AI analizi başarısız oldu, ancak mekanlar gösteriliyor");
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
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSearch={handleSearch}
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

