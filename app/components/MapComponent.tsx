"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Place } from "./DetailPanel";
import { useTheme } from "../contexts/ThemeContext";

export interface MapComponentRef {
  getMap: () => google.maps.Map | null;
  addMarker: (coords: [number, number], popup: string) => google.maps.Marker | null;
  clearMarkers: () => void;
  setView: (coords: [number, number], zoom?: number) => void;
  fitBounds: (coords: [number, number][]) => void;
}

interface MapComponentProps {
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
  onLocationClick?: () => void;
  shouldFitBounds?: boolean; // Arama sonrası haritayı fit etmek için
  isPlaceAnalyzing?: (placeId: string) => boolean;
  isBatchAnalyzing?: boolean;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 41.0082,
  lng: 28.9784,
}; // İstanbul

// Google Maps Dark Mode Styles
const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

// Inner component that uses the loader - only renders when API key is available
function MapWithLoader({
  apiKey,
  places,
  selectedPlace,
  onPlaceClick,
  onLocationClick,
  shouldFitBounds = false,
  isPlaceAnalyzing,
  isBatchAnalyzing = false,
}: MapComponentProps & { apiKey: string }) {
  const { isDark } = useTheme();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);

  // useJsApiLoader hook'u sadece API key varsa çağrılır (bu component sadece key varsa render edilir)
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    language: "tr",
  });

  // Map instance'ı kaydet
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    
    // Dark mode stilini uygula
    if (isDark) {
      mapInstance.setOptions({ styles: darkMapStyles });
    } else {
      mapInstance.setOptions({ styles: [] });
    }
    
    // Get user location - map hazır olduktan sonra
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          mapInstance.setCenter({ lat: latitude, lng: longitude });
          mapInstance.setZoom(15);
        },
        (error) => {
          console.warn("Geolocation error:", error);
        }
      );
    }
  }, [isDark]);

  // Dark mode değiştiğinde harita stilini güncelle
  useEffect(() => {
    if (!map) return;
    if (isDark) {
      map.setOptions({ styles: darkMapStyles });
    } else {
      map.setOptions({ styles: [] });
    }
  }, [map, isDark]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds when places change
  useEffect(() => {
    if (!map || !shouldFitBounds || places.length === 0 || isBatchAnalyzing) return;

    const bounds = new google.maps.LatLngBounds();
    places.forEach((place) => {
      if (place.coords && place.coords.length === 2) {
        bounds.extend({ lat: place.coords[0], lng: place.coords[1] });
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50,
      });
    }
  }, [map, places, shouldFitBounds, isBatchAnalyzing]);

  // User location marker'ı güncelle
  useEffect(() => {
    if (!map || !userLocation) return;

    // Eski marker'ı kaldır
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setMap(null);
    }

    // Yeni marker ekle (mavi renkli, kullanıcı konumu için)
    const userIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeWeight: 3,
    };

    const marker = new google.maps.Marker({
      position: { lat: userLocation[0], lng: userLocation[1] },
      map: map,
      icon: userIcon,
      zIndex: 1000,
      title: "Konumunuz",
    });

    userLocationMarkerRef.current = marker;
  }, [map, userLocation]);

  // Expose location function and map center globally
  useEffect(() => {
    const handleLocationRequest = () => {
      if (!map) return;

      if (userLocation) {
        map.setCenter({ lat: userLocation[0], lng: userLocation[1] });
        map.setZoom(15);
        if (userLocationMarkerRef.current) {
          // InfoWindow açmak için marker'a tıklama simüle et
          const infoWindow = new google.maps.InfoWindow({
            content: "<strong>Konumunuz</strong>",
          });
          if (userLocationMarkerRef.current) {
            infoWindow.open(map, userLocationMarkerRef.current);
          }
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            map.setCenter({ lat: latitude, lng: longitude });
            map.setZoom(15);
          },
          (error) => {
            console.warn("Geolocation error:", error);
            alert("Konum alınamadı. Lütfen tarayıcı ayarlarınızdan konum iznini açın.");
          }
        );
      }
    };

    // Map center'ı almak için function
    const getMapCenter = () => {
      if (!map) return { lat: 41.015137, lng: 28.97953 };
      const center = map.getCenter();
      if (!center) return { lat: 41.015137, lng: 28.97953 };
      return { lat: center.lat(), lng: center.lng() };
    };

    // Kullanıcı konumunu almak için function
    const getUserLocation = () => {
      if (userLocation) {
        return { lat: userLocation[0], lng: userLocation[1] };
      }
      // Kullanıcı konumu yoksa harita merkezini kullan
      return getMapCenter();
    };

    // Store handlers globally
    (window as any).handleMapLocation = handleLocationRequest;
    (window as any).getMapCenter = getMapCenter;
    (window as any).getUserLocation = getUserLocation;

    return () => {
      delete (window as any).handleMapLocation;
      delete (window as any).getMapCenter;
      delete (window as any).getUserLocation;
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
      }
    };
  }, [map, userLocation]);

  // API key yüklendi ama harita henüz hazır değil
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gray-100" style={{ zIndex: 1 }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4a657] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full" style={{ zIndex: 1 }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={userLocation ? { lat: userLocation[0], lng: userLocation[1] } : defaultCenter}
        zoom={userLocation ? 15 : 13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: isDark ? darkMapStyles : [],
        }}
      >
        {/* Place markers */}
        {!isBatchAnalyzing &&
          places.map((place) => {
            if (!place.coords || place.coords.length !== 2) return null;

            const analyzing = isPlaceAnalyzing?.(place.id);
            const isActive = activeInfoWindow === place.id;

            return (
              <Marker
                key={place.id}
                position={{ lat: place.coords[0], lng: place.coords[1] }}
                onClick={() => {
                  setActiveInfoWindow(place.id);
                  onPlaceClick(place);
                }}
                icon={
                  analyzing
                    ? {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#d4a657",
                        fillOpacity: 1,
                        strokeColor: "#FFFFFF",
                        strokeWeight: 2,
                      }
                    : undefined
                }
                animation={analyzing ? google.maps.Animation.BOUNCE : undefined}
              >
                {isActive && place.coords && place.coords.length === 2 && (
                  <InfoWindow
                    position={{ lat: place.coords[0], lng: place.coords[1] }}
                    onCloseClick={() => setActiveInfoWindow(null)}
                    options={{
                      pixelOffset: new google.maps.Size(0, -40),
                      disableAutoPan: true,
                    }}
                  >
                    <div>
                      {place.name}
                      {place.rating && ` ⭐ ${place.rating}`}
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            );
          })}
      </GoogleMap>

      {isBatchAnalyzing && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-black/20 backdrop-blur-sm">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <span className="text-lg font-semibold text-gray-800 tracking-wide">
              🤖 AI analizi sürüyor
            </span>
            <p className="text-sm text-gray-500">Mekanlar analiz ediliyor...</p>
          </div>
        </div>
      )}
    </div>
  );
}

MapWithLoader.displayName = "MapWithLoader";

function MapComponent({
  places,
  selectedPlace,
  onPlaceClick,
  onLocationClick,
  shouldFitBounds = false,
  isPlaceAnalyzing,
  isBatchAnalyzing = false,
}: MapComponentProps) {
  const [apiKey, setApiKey] = useState<string>("");

  // API key'i yükle - component mount olduğunda hemen yükle (optimize edilmiş)
  useEffect(() => {
    // Cache'den kontrol et (localStorage)
    const cachedKey = typeof window !== "undefined" ? localStorage.getItem("maps_api_key") : null;
    if (cachedKey) {
      setApiKey(cachedKey);
    }

    // API'den yükle (cache miss veya ilk yükleme)
    const loadApiKey = async () => {
      try {
        const response = await fetch("/api/maps-key", {
          cache: "force-cache", // Browser cache kullan
        });
        if (response.ok) {
          const data = await response.json();
          if (data.apiKey) {
            setApiKey(data.apiKey);
            // Cache'e kaydet
            if (typeof window !== "undefined") {
              localStorage.setItem("maps_api_key", data.apiKey);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load Google Maps API key:", error);
      }
    };
    
    // Cache yoksa veya geçersizse API'den yükle
    if (!cachedKey) {
      loadApiKey();
    }
  }, []);

  // API key yüklenene kadar bekle
  if (!apiKey) {
    return (
      <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gray-100" style={{ zIndex: 1 }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4a657] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // API key yüklendi, MapWithLoader component'ini render et
  return (
    <MapWithLoader
      apiKey={apiKey}
      places={places}
      selectedPlace={selectedPlace}
      onPlaceClick={onPlaceClick}
      onLocationClick={onLocationClick}
      shouldFitBounds={shouldFitBounds}
      isPlaceAnalyzing={isPlaceAnalyzing}
      isBatchAnalyzing={isBatchAnalyzing}
    />
  );
}

MapComponent.displayName = "MapComponent";

export default MapComponent;
