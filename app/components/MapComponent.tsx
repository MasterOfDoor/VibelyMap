"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Place } from "./DetailPanel";

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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);

  // API key'i yükle
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const response = await fetch("/api/maps-key");
        if (response.ok) {
          const data = await response.json();
          setApiKey(data.apiKey);
        }
      } catch (error) {
        console.error("Failed to load Google Maps API key:", error);
      }
    };
    loadApiKey();
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    language: "tr",
  });

  // Map instance'ı kaydet
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    
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
  }, []);

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
      map.fitBounds(bounds, { padding: 50 });
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

  if (!isLoaded || !apiKey) {
    return (
      <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gray-100" style={{ zIndex: 1 }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4a657] mx-auto mb-4"></div>
          <p className="text-gray-600">Harita yükleniyor...</p>
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
                {isActive && (
                  <InfoWindow
                    onCloseClick={() => setActiveInfoWindow(null)}
                    options={{
                      pixelOffset: new google.maps.Size(0, -10),
                    }}
                  >
                    <div style={{ minWidth: "150px" }}>
                      <strong>{place.name}</strong>
                      <br />
                      <span style={{ color: "#666", fontSize: "0.9em" }}>{place.type}</span>
                      {place.rating && <><br />⭐ {place.rating}</>}
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

MapComponent.displayName = "MapComponent";

export default MapComponent;
