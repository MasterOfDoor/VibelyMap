"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useMapPlaces } from "./hooks/useMapPlaces";
import { useMapSearch } from "./hooks/useMapSearch";
import { useMapFilters } from "./hooks/useMapFilters";
import { usePlaceAnalysis } from "./hooks/usePlaceAnalysis";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { Place } from "./components/DetailPanel";
import { buildQueryFromFilters } from "./utils/filterHelpers";
import TopBar from "./components/TopBar";
import SearchOverlay from "./components/SearchOverlay";
import ResultsPanel from "./components/ResultsPanel";
import DetailPanel from "./components/DetailPanel";
import FilterPanel, { FilterState } from "./components/FilterPanel";
import ProfilePanel from "./components/ProfilePanel";
import WalletConnectModal from "./components/WalletConnectModal";
import { sdk } from '@farcaster/miniapp-sdk';


// Leaflet haritasını dinamik olarak yükle (SSR sorunlarını önlemek için)
const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
});

export default function Home() {
  const { address, isConnected } = useAccount();
  const { setMiniAppReady, isMiniAppReady } = useMiniKit();

  useEffect(() => {
    sdk.actions.ready();
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
  const { analyzePlaces } = usePlaceAnalysis();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    main: [],
    sub: {},
  });
  // Filter places based on current filters
  const filteredPlaces = useMemo(() => {
    return filterPlaces(places || [], currentFilters);
  }, [places, currentFilters, filterPlaces]);

  const handlePlaceClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    setIsDetailOpen(true);
    setIsResultsOpen(false);
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      console.log("[handleSearch] Arama başlatılıyor:", query);
      const results = await performSearch(query);
      console.log("[handleSearch] Sonuç sayısı:", results.length);
      
      // Reset filters when new search is performed
      setCurrentFilters({ main: [], sub: {} });
      resetFilters();
      
      if (results.length > 0) {
        setIsResultsOpen(true);
        
        // AI analizi yap
        console.log("[handleSearch] AI analizi başlatılıyor...");
        try {
          const analysisResults = await analyzePlaces(results);
          console.log("[handleSearch] AI analizi tamamlandı, sonuç:", analysisResults.size);
          
          // Sonuçları zenginleştir
          const enrichedResults = results.map((place) => {
            const analysis = analysisResults.get(place.id);
            if (analysis) {
              console.log("[handleSearch] Zenginleştirildi:", place.name, "Labels:", analysis.labels);
              return {
                ...place,
                tags: [...(place.tags || []), ...analysis.tags],
                features: [...(place.features || []), ...analysis.features],
                labels: analysis.labels,
              };
            }
            return place;
          });
          
          setPlaces(enrichedResults);
        } catch (error) {
          console.error("[handleSearch] AI analizi hatası:", error);
          // Hata durumunda orijinal sonuçları göster
          setPlaces(results);
        }
      }
    },
    [performSearch, resetFilters, analyzePlaces, setPlaces]
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

        // AI analizi her zaman yap (sadece kategori seçilse bile)
        if (results.length > 0) {
          console.log("[handleApplyFilters] AI analizi başlatılıyor...", results.length, "mekan için");
          const analysisResults = await analyzePlaces(results);
          console.log("[handleApplyFilters] AI analizi tamamlandı, sonuç:", analysisResults.size);

          // AI sonuçlarını places'lere uygula
          const enrichedResults = results.map((place) => {
            const analysis = analysisResults.get(place.id);
            if (analysis) {
              console.log("[handleApplyFilters] Mekan zenginleştirildi:", place.name, "Labels:", analysis.labels);
              return {
                ...place,
                tags: [...(place.tags || []), ...analysis.tags],
                features: [...(place.features || []), ...analysis.features],
                labels: analysis.labels,
              };
            }
            return place;
          });

          // Diğer filtreler varsa AI analizi sonrası filtreleme yap
          if (otherFilters.length > 0) {
            const filteredAfterAnalysis = filterPlaces(enrichedResults, filters);
            setPlaces(filteredAfterAnalysis);
            
            if (filteredAfterAnalysis.length > 0) {
              setIsResultsOpen(true);
            } else {
              alert("Seçtiğiniz filtrelerle eşleşen mekan bulunamadı.");
            }
          } else {
            // Sadece kategori filtresi var, tüm sonuçları göster
            setPlaces(enrichedResults);
            setIsResultsOpen(true);
          }
        }
      } catch (error: any) {
        console.error("Filtre uygulama hatası:", error);
        alert("Filtre uygulanırken bir hata oluştu: " + error.message);
      }
    },
    [loadPlaces, analyzePlaces, applyFilters]
  );

  const handleResetFilters = useCallback(() => {
    setCurrentFilters({ main: [], sub: {} });
    resetFilters();
  }, [resetFilters]);

  if (!isConnected) {
    return (
      <main className="relative w-full h-screen overflow-hidden">
        <WalletConnectModal isOpen={true} onClose={() => {}} />
      </main>
    );
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
      />

      <DetailPanel
        isOpen={isDetailOpen}
        place={selectedPlace}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedPlace(null);
        }}
      />

      <ProfilePanel
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </main>
  );
}

