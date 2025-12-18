"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { Place } from "./DetailPanel";

export interface MapComponentRef {
  getMap: () => L.Map | null;
  addMarker: (coords: [number, number], popup: string) => L.Marker;
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
}

function MapComponent({
  places,
  selectedPlace,
  onPlaceClick,
  onLocationClick,
  shouldFitBounds = false,
  isPlaceAnalyzing,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Fix Leaflet default icon issue
  useEffect(() => {
    // Fix for Leaflet default icon in Next.js
    if (typeof window !== "undefined") {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([41.0082, 28.9784], 13); // İstanbul

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Get user location - map hazır olduktan sonra
    if (navigator.geolocation) {
      // Map'in tamamen yüklenmesini bekle
      map.whenReady(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([latitude, longitude], 15);
            }
          },
          (error) => {
            console.warn("Geolocation error:", error);
          }
        );
      });
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when places change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each place
    if (!places || !Array.isArray(places)) return;
    
    places.forEach((place) => {
      if (!place.coords || place.coords.length !== 2) return;

      const analyzing = isPlaceAnalyzing?.(place.id);

      // Create marker with explicit icon
      const marker = L.marker([place.coords[0], place.coords[1]], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `
            <div class="marker-container ${analyzing ? 'analyzing' : ''}">
              <img src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png" class="marker-img" />
              ${analyzing ? '<div class="marker-pulse"></div>' : ''}
            </div>
          `,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      }).addTo(mapInstanceRef.current!);

      const popupContent = `
        <div style="min-width: 150px;">
          <strong>${place.name}</strong><br/>
          <span style="color: #666; font-size: 0.9em;">${place.type}</span>
          ${place.rating ? `<br/>⭐ ${place.rating}` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onPlaceClick(place);
        // Zoom yapma - sadece detay paneli açılsın
        // if (mapInstanceRef.current) {
        //   mapInstanceRef.current.setView([place.coords[0], place.coords[1]], 16);
        // }
      });

      markersRef.current.push(marker);
    });

    // Fit bounds sadece shouldFitBounds true olduğunda (arama sonrası)
    if (shouldFitBounds && places.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(
        places.map((p) => [p.coords[0], p.coords[1]] as [number, number])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [places, onPlaceClick, shouldFitBounds]);

  // Focus on selected place - zoom yapma, sadece marker'ı highlight et
  // useEffect(() => {
  //   if (selectedPlace && mapInstanceRef.current) {
  //     mapInstanceRef.current.setView(
  //       [selectedPlace.coords[0], selectedPlace.coords[1]],
  //       16
  //     );
  //   }
  // }, [selectedPlace]);

  // User location marker'ı güncelle
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;

    // Eski marker'ı kaldır
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove();
    }

    // Yeni marker ekle (mavi renkli, kullanıcı konumu için)
    const userIcon = L.divIcon({
      className: "user-location-marker",
      html: `<div style="
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #4285F4;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([userLocation[0], userLocation[1]], {
      icon: userIcon,
      zIndexOffset: 1000, // Diğer marker'ların üstünde
    }).addTo(mapInstanceRef.current);

    marker.bindPopup("<strong>Konumunuz</strong>");
    userLocationMarkerRef.current = marker;
  }, [userLocation]);

  // Expose location function and map center globally
  useEffect(() => {
    const handleLocationRequest = () => {
      if (!mapInstanceRef.current) return;

      if (userLocation && mapInstanceRef.current) {
        mapInstanceRef.current.setView(userLocation, 15);
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.openPopup();
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([latitude, longitude], 15);
            }
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
      if (!mapInstanceRef.current) return { lat: 41.015137, lng: 28.97953 };
      const center = mapInstanceRef.current.getCenter();
      return { lat: center.lat, lng: center.lng };
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
        userLocationMarkerRef.current.remove();
      }
    };
  }, [userLocation]);

  return (
    <div className="fixed inset-0 w-full h-full" style={{ zIndex: 1 }}>
      <div ref={mapRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

MapComponent.displayName = "MapComponent";

export default MapComponent;
