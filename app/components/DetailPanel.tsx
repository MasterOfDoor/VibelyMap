"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useProxy } from "../hooks/useProxy";
import { useReviews, BlockchainReview } from "../hooks/useReviews";
import { useSmartWallet } from "../hooks/useSmartWallet";
import { analyzePlacePhotos } from "../hooks/ChatGPT_analysis";

export interface Place {
  id: string;
  name: string;
  type: string;
  coords: [number, number];
  address?: string;
  website?: string;
  hours?: string;
  rating?: number;
  priceLabel?: string;
  tel?: string;
  photo?: string;
  photos?: string[];
  tags?: string[];
  features?: string[];
  labels?: string[]; // AI analizi sonrası eklenen labels
  subOptions?: {
    [key: string]: string[];
  };
  externalReviews?: Array<{
    author: string;
    text: string;
    rating: number | null;
    relativeTime: string;
  }>;
  blockchainReviews?: BlockchainReview[];
}

interface DetailPanelProps {
  isOpen: boolean;
  place: Place | null;
  onClose: () => void;
  onPlaceUpdate?: (placeId: string, updatedPlace: Place) => void;
  isAnalyzing?: boolean;
}

export default function DetailPanel({ isOpen, place, onClose, onPlaceUpdate, isAnalyzing }: DetailPanelProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  // Use ref to track current index to avoid stale closures
  const currentPhotoIndexRef = useRef(0);
  // Use ref to maintain stable photos array reference
  const photosRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [placeDetails, setPlaceDetails] = useState<Place | null>(place);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { googlePlaceDetails, googlePhoto } = useProxy();
  
  // Blockchain yorumları
  const { address, isConnected } = useSmartWallet();
  const { reviews: blockchainReviews, submitReview, isSubmitting, isConfirmed, submitError, refetch } = useReviews(place?.id || null);
  
  // Yorum formu state
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [showReviewForm, setShowReviewForm] = useState(false);
  
  // Detaylı rating kriterleri
  const [detailedRatings, setDetailedRatings] = useState({
    lighting: 3, // 1-5
    ambiance: 3, // 1-5
    seating: 3, // 1-5
    powerOutlets: 3, // 1-5
    proximityToWater: 1, // 1-5
    smokingOption: "" as "" | "indoor_smoking" | "non_smoking", // "" = not selected
    category: "" as "" | "Kafe" | "Restoran" | "Bar", // "" = not selected
  });

  const loadPlaceDetails = useCallback(async (placeId: string) => {
    if (!placeId) return;
    setLoading(true);
    try {
      const data = await googlePlaceDetails(placeId);
      const result = data?.result || data;
      if (result) {
        const rawPhotos = result.photos || [];
        console.log("[DetailPanel] Google Places API'den gelen fotoğraflar:", {
          placeId,
          rawPhotosCount: rawPhotos.length,
          rawPhotos: rawPhotos.map((p: any) => ({
            ref: p?.photo_reference || p?.name,
            name: p?.name,
          })),
        });
        
        const photos = rawPhotos
          .map((p: any) => {
            const ref = p?.photo_reference || p?.name;
            return ref ? googlePhoto(ref, "800") : "";
          })
          .filter(Boolean);
        
        console.log("[DetailPanel] İşlenmiş fotoğraf URL'leri:", {
          placeId,
          processedPhotosCount: photos.length,
          photos: photos,
        });
        
        setPlaceDetails((prev) => ({
          ...prev!,
          address: result.formatted_address || prev?.address,
          tel: result.formatted_phone_number || prev?.tel,
          website: result.website || prev?.website,
          hours: Array.isArray(result.opening_hours?.weekday_text)
            ? result.opening_hours.weekday_text.join(" | ")
            : prev?.hours,
          photo: photos[0] || prev?.photo,
          photos: photos.length > 0 ? photos : prev?.photos,
          externalReviews: (result.reviews || []).map((r: any) => ({
            author: r.author_name || "Visitor",
            text: r.text || "",
            rating: r.rating || null,
            relativeTime: r.relative_time_description || "",
          })),
        }));
      }
    } catch (error) {
      console.error("Failed to load place details:", error);
    } finally {
      setLoading(false);
    }
  }, [googlePlaceDetails, googlePhoto]);

  // Track previous place ID to detect when a new place is opened
  const prevPlaceIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (place && isOpen) {
      const isNewPlace = prevPlaceIdRef.current !== place.id;
      prevPlaceIdRef.current = place.id;
      
      // Place objesini güncelle (tags dahil tüm bilgileri)
      setPlaceDetails({
        ...place,
        tags: place.tags || [],
        features: place.features || [],
        labels: place.labels || [],
      });
      // Index reset is now handled by the useEffect that watches placeDetails.id
      // No need to reset here as it will be handled by the consolidated effect
      
      // Sadece yeni bir mekan açıldığında formu kapat ve temizle
      if (isNewPlace) {
        setReviewComment(""); // Formu temizle
        setReviewRating(5);
        setShowReviewForm(false);
        setDetailedRatings({
          lighting: 3,
          ambiance: 3,
          seating: 3,
          powerOutlets: 3,
          proximityToWater: 1,
          smokingOption: "",
          category: "",
        });
      }
      
      // Fetch detailed information if not already loaded
      if (!place.address && !place.hours) {
        loadPlaceDetails(place.id);
      }
    }
  }, [place, isOpen, loadPlaceDetails]);

  // Blockchain review'leri placeDetails'e ekle
  useEffect(() => {
    if (blockchainReviews && blockchainReviews.length > 0) {
      setPlaceDetails((prev) => ({
        ...prev!,
        blockchainReviews,
      }));
    }
  }, [blockchainReviews]);

  // Yorum gönderme
  const handleSubmitReview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place?.id || !isConnected) {
      alert("Wallet connection required to comment");
      return;
    }

    if (!reviewComment.trim()) {
      alert("Please write a comment");
      return;
    }

    try {
      // Detailed ratings as structured data for Supabase
      const detailedInfo = {
        lighting: detailedRatings.lighting,
        ambiance: detailedRatings.ambiance,
        seating: detailedRatings.seating,
        powerOutlets: detailedRatings.powerOutlets,
        proximityToWater: detailedRatings.proximityToWater,
        smokingOption: detailedRatings.smokingOption,
        category: detailedRatings.category,
      };
      
      // Submit review with detailed ratings as separate field
      await submitReview(reviewRating, reviewComment.trim(), [], detailedInfo);
      setReviewComment("");
      setReviewRating(5);
      setShowReviewForm(false);
      // Refresh review list
      setTimeout(() => {
        refetch();
      }, 1000);
      
      // Form state'lerini sıfırla
      setDetailedRatings({
        lighting: 3,
        ambiance: 3,
        seating: 3,
        powerOutlets: 3,
        proximityToWater: 1,
        smokingOption: "",
        category: "",
      });
    } catch (error: any) {
      console.error("Yorum gönderme hatası:", error);
      alert(error?.message || "An error occurred while sending the comment");
    }
  }, [place?.id, isConnected, reviewComment, reviewRating, detailedRatings, submitReview, refetch]);

  // Photos array'ini memoize et - hooks must be called before early return
  // Use deep comparison to maintain stable reference
  const photos = useMemo(() => {
    if (!placeDetails) {
      photosRef.current = [];
      return [];
    }
    const list = placeDetails.photos?.length
      ? placeDetails.photos
      : placeDetails.photo
      ? [placeDetails.photo]
      : [];
    const filtered = list.filter(Boolean);
    
    // Deep comparison to avoid unnecessary reference changes
    const currentStr = JSON.stringify(photosRef.current);
    const newStr = JSON.stringify(filtered);
    
    if (currentStr === newStr && photosRef.current.length > 0) {
      // Return existing reference if content is identical
      return photosRef.current;
    }
    
    console.log("[DetailPanel] Photos memoized:", {
      placeName: placeDetails.name,
      photosArrayLength: placeDetails.photos?.length || 0,
      photoString: placeDetails.photo ? "var" : "yok",
      finalPhotosCount: filtered.length,
      photos: filtered,
    });
    
    // Update ref with new array
    photosRef.current = filtered;
    return filtered;
  }, [placeDetails?.photos, placeDetails?.photo, placeDetails?.name]);

  // Track previous place ID to detect actual place changes
  const prevPlaceIdForIndexRef = useRef<string | null>(null);
  
  // Yeni mekan açıldığında index'i sıfırla (sadece placeDetails.id gerçekten değiştiğinde)
  useEffect(() => {
    if (placeDetails?.id && prevPlaceIdForIndexRef.current !== placeDetails.id) {
      prevPlaceIdForIndexRef.current = placeDetails.id;
        setCurrentPhotoIndex(0);
      currentPhotoIndexRef.current = 0;
      console.log("[DetailPanel] Place ID changed, resetting photo index to 0");
    }
  }, [placeDetails?.id]);
  
  // Sync ref with state
  useEffect(() => {
    currentPhotoIndexRef.current = currentPhotoIndex;
  }, [currentPhotoIndex]);

  // Klavye ile navigasyon (ESC ile kapat, ok tuşları ile gezin)
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft" && photosRef.current.length > 1) {
        const newIndex = (currentPhotoIndexRef.current - 1 + photosRef.current.length) % photosRef.current.length;
        currentPhotoIndexRef.current = newIndex;
        setCurrentPhotoIndex(newIndex);
      } else if (e.key === "ArrowRight" && photosRef.current.length > 1) {
        const newIndex = (currentPhotoIndexRef.current + 1) % photosRef.current.length;
        currentPhotoIndexRef.current = newIndex;
        setCurrentPhotoIndex(newIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, photos]);

  // Fotoğraf navigasyon fonksiyonları
  const handlePrevPhoto = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Use ref to get current photos array (stable reference)
    const currentPhotos = photosRef.current;
    const currentIndex = currentPhotoIndexRef.current;
    
    console.log("[DetailPanel] handlePrevPhoto called", { 
      photosLength: currentPhotos.length,
      currentIndex,
      photos: currentPhotos 
    });
    
    if (currentPhotos.length > 1) {
      const newIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
      console.log("[DetailPanel] Önceki fotoğraf:", { 
        prev: currentIndex, 
        newIndex, 
        photoUrl: currentPhotos[newIndex] 
      });
      
      // Update both ref and state
      currentPhotoIndexRef.current = newIndex;
      setCurrentPhotoIndex(newIndex);
    } else {
      console.warn("[DetailPanel] Fotoğraf yok veya tek fotoğraf var, navigasyon yapılamıyor");
    }
  }, []); // No dependencies - uses refs for stable access

  const handleNextPhoto = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Use ref to get current photos array (stable reference)
    const currentPhotos = photosRef.current;
    const currentIndex = currentPhotoIndexRef.current;
    
    console.log("[DetailPanel] handleNextPhoto called", { 
      photosLength: currentPhotos.length,
      currentIndex,
      photos: currentPhotos 
    });
    
    if (currentPhotos.length > 1) {
      const newIndex = (currentIndex + 1) % currentPhotos.length;
      console.log("[DetailPanel] Sonraki fotoğraf:", { 
        prev: currentIndex, 
        newIndex, 
        photoUrl: currentPhotos[newIndex] 
      });
      
      // Update both ref and state
      currentPhotoIndexRef.current = newIndex;
      setCurrentPhotoIndex(newIndex);
    } else {
      console.warn("[DetailPanel] Fotoğraf yok veya tek fotoğraf var, navigasyon yapılamıyor");
    }
  }, []); // No dependencies - uses refs for stable access

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Tag helper functions
  const getTagCategory = (tag: string): string => {
    const lowerTag = tag.toLowerCase();
    if (lowerTag.includes("ışıklandırma") || lowerTag.includes("isiklandirma")) return "lighting";
    if (lowerTag.includes("koltuk") || lowerTag.includes("oturma")) return "seating";
    if (lowerTag.includes("sigara")) return "smoking";
    if (lowerTag.includes("deniz")) return "view";
    if (lowerTag.includes("priz")) return "power";
    if (lowerTag.includes("retro") || lowerTag.includes("modern")) return "ambiance";
    if (lowerTag.includes("kafe") || lowerTag.includes("restoran") || lowerTag.includes("bar")) return "category";
    return "general";
  };

  const getTagIcon = (tag: string): string => {
    const category = getTagCategory(tag);
    const iconMap: { [key: string]: string } = {
      lighting: "💡",
      seating: "🪑",
      smoking: "🚬",
      view: "🌊",
      power: "🔌",
      ambiance: "🎨",
      category: "📍",
      general: "🏷️",
    };
    return iconMap[category] || "🏷️";
  };

  const getTagTooltip = (tag: string): string => {
    const lowerTag = tag.toLowerCase();
    if (lowerTag.includes("ışıklandırma") || lowerTag.includes("isiklandirma")) {
      const level = tag.match(/\d+/)?.[0];
      return level ? `Lighting level: ${level}/5` : "Lighting info";
    }
    if (lowerTag.includes("koltuk")) {
      const level = tag.match(/\d+/)?.[0];
      return level ? `Seating area level: ${level}/3` : "Seating area info";
    }
    if (lowerTag.includes("sigara")) return "Smoking area available";
    if (lowerTag.includes("deniz")) return "Sea view";
    if (lowerTag.includes("priz")) return "Power outlet available";
    if (lowerTag.includes("retro")) return "Retro ambiance";
    if (lowerTag.includes("modern")) return "Modern design";
    return tag;
  };

  if (!isOpen || !placeDetails) return null;

  return (
    <section
      id="detailPanel"
      className={`panel detail ${isOpen ? "visible" : "hidden"}`}
    >
      <div className="panel-header">
        <div>
          <p id="placeType" className="eyebrow">
            {placeDetails.type || "Place"}
          </p>
          <h2 id="placeName">{placeDetails.name}</h2>
          {placeDetails.hours && (
            <div id="placeHours" className="muted-text tiny">
              {placeDetails.hours}
            </div>
          )}
          {placeDetails.address && (
            <div id="placeAddress" className="muted-text tiny">
              Address: {placeDetails.address}
            </div>
          )}
          <div id="placeTags" className="tags-container">
            {isAnalyzing && (
              <div className="analysis-loader" style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)" }}>
                <span className="animate-spin">⏳</span>
                <span className="tiny" style={{ fontWeight: 600 }}>AI Analysis in progress...</span>
              </div>
            )}
            {placeDetails.tags && placeDetails.tags.length > 0 && (
              <div className="tags-section">
                <div className="tags-header">
                  <span className="tags-label">Tags</span>
                  {placeDetails.tags.length > 0 && (
                    <span className="tags-count">{placeDetails.tags.length}</span>
                  )}
                </div>
                <div className="tags" role="list">
                  {placeDetails.tags.map((tag, index) => {
                    // AI analizi etiketlerini belirle (yeni eklenen etiketler genellikle AI'dan gelir)
                    const isAITag = tag.includes("Işıklandırma") || 
                                   tag.includes("Retro") || 
                                   tag.includes("Modern") || 
                                   tag.includes("Koltuk") || 
                                   tag.includes("Sigara") ||
                                   tag.includes("Deniz") ||
                                   tag.includes("Priz");
                    const tagCategory = getTagCategory(tag);
                    
                    return (
                      <span
                        key={`tag-${index}`}
                        className={`tag ${isAITag ? 'tag-ai' : 'tag-default'} tag-${tagCategory}`}
                        role="listitem"
                        title={getTagTooltip(tag)}
                        aria-label={`${tag} - ${getTagTooltip(tag)}`}
                        data-tag={tag}
                        data-category={tagCategory}
                      >
                        {isAITag && (
                          <span className="tag-badge tag-badge-ai" aria-label="AI analysis tag" title="Analyzed with AI">
                            🤖
              </span>
                        )}
                        <span className="tag-icon">{getTagIcon(tag)}</span>
                        <span className="tag-text">{tag}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {placeDetails.features && placeDetails.features.length > 0 && (
              <div className="tags-section">
                <div className="tags-header">
                  <span className="tags-label">Features</span>
                </div>
                <div className="tags" role="list">
                  {placeDetails.features.map((feature, index) => (
                    <span
                      key={`feat-${index}`}
                      className="tag tag-feature subtag"
                      role="listitem"
                      title={feature}
                    >
                      <span className="tag-text">{feature}</span>
              </span>
            ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          id="closeDetail"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close details"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.1)",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0,0,0,0.1)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0,0,0,0.05)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          &times;
        </button>
      </div>

      {photos.length > 0 && (
        <div id="placePhoto" className="place-photo">
          <div className="photo-gallery" style={{ position: "relative" }}>
            {photos.length > 1 && (
              <>
              <button
                className="photo-nav prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handlePrevPhoto(e);
                  }}
                aria-label="Previous photo"
                type="button"
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    background: "rgba(0, 0, 0, 0.5)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    fontSize: "20px",
                    fontWeight: "bold",
                    pointerEvents: "auto",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
                  }}
              >
                &lt;
              </button>
              <button
                className="photo-nav next"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleNextPhoto(e);
                  }}
                aria-label="Next photo"
                type="button"
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    background: "rgba(0, 0, 0, 0.5)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    fontSize: "20px",
                    fontWeight: "bold",
                    pointerEvents: "auto",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
                  }}
              >
                &gt;
              </button>
              </>
            )}
            <img
              className="photo-main"
              key={`${placeDetails.id}-photo-${currentPhotoIndex}`}
              src={photos[currentPhotoIndex] || photos[0] || ""}
              alt={placeDetails.name}
              loading="lazy"
              onClick={openFullscreen}
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onError={(e) => {
                console.error("[DetailPanel] Fotoğraf yüklenemedi:", photos[currentPhotoIndex]);
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          {photos.length > 1 && (
            <div style={{ 
              marginTop: "8px", 
              textAlign: "center", 
              fontSize: "12px", 
              color: "var(--muted)" 
            }}>
              Photo {currentPhotoIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}

      {/* Tam ekran fotoğraf modal */}
      {isFullscreen && photos.length > 0 && typeof window !== "undefined" && createPortal(
        <>
          {/* Modal arka planı */}
          <div
            className="fullscreen-photo-modal"
            onClick={closeFullscreen}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 1)",
              zIndex: 99999,
              cursor: "pointer",
            }}
          />
          
          {/* Fotoğraf - tam ekran */}
          <img
            key={`${placeDetails.id}-fullscreen-${currentPhotoIndex}`}
            src={photos[currentPhotoIndex] || photos[0] || ""}
            alt={placeDetails.name}
            onError={(e) => {
              console.error("[DetailPanel] Tam ekran fotoğraf yüklenemedi:", photos[currentPhotoIndex]);
              (e.target as HTMLImageElement).style.display = "none";
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Fotoğrafa tıklayınca da gezin (sağ tarafta sonraki, sol tarafta önceki)
              if (photos.length > 1) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const imageWidth = rect.width;
                if (clickX > imageWidth / 2) {
                  handleNextPhoto(e as any);
                } else {
                  handlePrevPhoto(e as any);
                }
              }
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              objectFit: "cover",
              cursor: photos.length > 1 ? "pointer" : "default",
              zIndex: 100000,
              userSelect: "none",
            }}
            draggable={false}
          />

          {/* Kapat butonu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              closeFullscreen();
            }}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              background: "#FFFFFF",
              border: "3px solid #000000",
              color: "#000000",
              fontSize: "40px",
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              cursor: "pointer",
              zIndex: 100001,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              boxShadow: "0 6px 20px rgba(0,0,0,0.8)",
              transition: "all 0.2s",
              lineHeight: "1",
              margin: 0,
              padding: 0,
              WebkitAppearance: "none",
              appearance: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.8)";
            }}
            aria-label="Close"
          >
            &times;
          </button>
          
          {/* Navigasyon butonları - sadece birden fazla fotoğraf varsa */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handlePrevPhoto(e);
                }}
                type="button"
                style={{
                  position: "fixed",
                  left: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "#FFFFFF",
                  border: "3px solid #000000",
                  color: "#000000",
                  fontSize: "48px",
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  zIndex: 100002,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.8)",
                  transition: "all 0.2s ease",
                  lineHeight: "1",
                  margin: 0,
                  padding: 0,
                  WebkitAppearance: "none",
                  appearance: "none",
                  pointerEvents: "auto",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.15)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.8)";
                }}
                aria-label="Previous photo"
              >
                &lt;
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleNextPhoto(e);
                }}
                type="button"
                style={{
                  position: "fixed",
                  right: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "#FFFFFF",
                  border: "3px solid #000000",
                  color: "#000000",
                  fontSize: "48px",
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  zIndex: 100002,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.8)",
                  transition: "all 0.2s ease",
                  lineHeight: "1",
                  margin: 0,
                  padding: 0,
                  WebkitAppearance: "none",
                  appearance: "none",
                  pointerEvents: "auto",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.15)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.8)";
                }}
                aria-label="Next photo"
              >
                &gt;
              </button>
              
              {/* Fotoğraf sayacı */}
              <div
                style={{
                  position: "fixed",
                  bottom: "30px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "white",
                  background: "rgba(0, 0, 0, 0.85)",
                  padding: "14px 28px",
                  borderRadius: "35px",
                  fontSize: "18px",
                  fontWeight: "700",
                  zIndex: 100001,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.8)",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  pointerEvents: "none",
                }}
              >
                {currentPhotoIndex + 1} / {photos.length}
              </div>
            </>
          )}
        </>,
        document.body
      )}

      <div className="info-row" id="placeInfo">
        {placeDetails.rating && (
          <span>Rating: {placeDetails.rating}</span>
        )}
        {placeDetails.priceLabel && (
          <span>Price: {placeDetails.priceLabel}</span>
        )}
        {placeDetails.tel && <span>Tel: {placeDetails.tel}</span>}
        {placeDetails.website && (
          <span>
            <a
              href={placeDetails.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Web
            </a>
          </span>
        )}
      </div>

      {/* Blockchain Yorumları */}
      {placeDetails.blockchainReviews && placeDetails.blockchainReviews.length > 0 && (
        <div className="reviews">
          <h3>User Reviews</h3>
          <div id="blockchainReviewsList" className="review-list">
            {placeDetails.blockchainReviews.map((review, index) => (
              <div key={`blockchain-${review.tokenId}`} className="review-item">
                <div className="review-header">
                  <strong>
                    {review.reviewer.slice(0, 6)}...{review.reviewer.slice(-4)}
                  </strong>
                  <span>⭐ {review.rating}</span>
                  <span className="muted-text tiny">
                    {new Date(Number(review.createdAt) * 1000).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <p>{review.comment}</p>
                {review.photos && review.photos.length > 0 && (
                  <div className="review-photos">
                    {review.photos.map((photo, photoIndex) => (
                      <img
                        key={photoIndex}
                        src={photo}
                        alt="Review photo"
                        style={{ maxWidth: "200px", marginTop: "8px", borderRadius: "8px" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Google'dan gelen yorumlar */}
      {placeDetails.externalReviews && placeDetails.externalReviews.length > 0 && (
        <div className="reviews">
          <h3>Google Reviews</h3>
          <div id="reviewsList" className="review-list">
            {placeDetails.externalReviews.map((review, index) => (
              <div key={index} className="review-item">
                <div className="review-header">
                  <strong>{review.author}</strong>
                  {review.rating && <span>⭐ {review.rating}</span>}
                  {review.relativeTime && (
                    <span className="muted-text tiny">{review.relativeTime}</span>
                  )}
                </div>
                <p>{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yorum Yapma Formu */}
      <div className="reviews">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3>Write Review</h3>
          {!isConnected && (
            <span className="muted-text tiny" style={{ color: "#ff6b6b" }}>
              Connect wallet to comment
            </span>
          )}
        </div>

        {!showReviewForm && isConnected && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowReviewForm(true);
            }}
            className="pill primary"
            style={{ width: "100%", marginBottom: "16px" }}
          >
            Write Review
          </button>
        )}

        {showReviewForm && isConnected && (
          <form onSubmit={handleSubmitReview} className="review-form" style={{ marginTop: "16px" }}>
            {/* Genel Puan */}
            <div style={{ marginBottom: "24px" }}>
              <label htmlFor="reviewRating" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Overall Rating: {reviewRating} ⭐
            </label>
            <input
              type="range"
              id="reviewRating"
              min="1"
              max="5"
              value={reviewRating}
              onChange={(e) => setReviewRating(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                <span>1 ⭐</span>
                <span>5 ⭐</span>
              </div>
            </div>

            {/* Detaylı Değerlendirme Kriterleri */}
            <div className="detailed-ratings-section" style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px" }}>
              <h4 style={{ marginBottom: "16px", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                Detailed Review
              </h4>

              {/* Işıklandırma */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>💡 Lighting</span>
                  <span className="rating-value-display">{detailedRatings.lighting} ⭐</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={detailedRatings.lighting}
                  onChange={(e) => setDetailedRatings(prev => ({ ...prev, lighting: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div className="rating-range-labels">
                  <span>Poor (1)</span>
                  <span>Excellent (5)</span>
                </div>
              </div>

              {/* Ambiyans */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>🎨 Ambiance</span>
                  <span className="rating-value-display">{detailedRatings.ambiance} ⭐</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={detailedRatings.ambiance}
                  onChange={(e) => setDetailedRatings(prev => ({ ...prev, ambiance: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div className="rating-range-labels">
                  <span>Poor (1)</span>
                  <span>Excellent (5)</span>
                </div>
              </div>

              {/* Oturma */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>🪑 Seating</span>
                  <span className="rating-value-display">{detailedRatings.seating} ⭐</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={detailedRatings.seating}
                  onChange={(e) => setDetailedRatings(prev => ({ ...prev, seating: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div className="rating-range-labels">
                  <span>Poor (1)</span>
                  <span>Excellent (5)</span>
                </div>
              </div>

              {/* Priz */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>🔌 Power Outlets</span>
                  <span className="rating-value-display">{detailedRatings.powerOutlets} ⭐</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={detailedRatings.powerOutlets}
                  onChange={(e) => setDetailedRatings(prev => ({ ...prev, powerOutlets: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div className="rating-range-labels">
                  <span>Insufficient (1)</span>
                  <span>Excellent (5)</span>
                </div>
              </div>

              {/* Deniz Yakınlığı */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>🌊 Proximity to Water</span>
                  <span className="rating-value-display">{detailedRatings.proximityToWater} ⭐</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={detailedRatings.proximityToWater}
                  onChange={(e) => setDetailedRatings(prev => ({ ...prev, proximityToWater: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div className="rating-range-labels">
                  <span>Far (1)</span>
                  <span>Very Close (5)</span>
                </div>
              </div>

              {/* Sigara Seçenekleri */}
              <div className="rating-criterion">
                <label className="rating-label">
                  <span>🚬 Smoking Options</span>
                </label>
                <div className="option-buttons">
                  <button
                    type="button"
                    onClick={() => setDetailedRatings(prev => ({ 
                      ...prev, 
                      smokingOption: prev.smokingOption === "indoor_smoking" ? "" : "indoor_smoking" 
                    }))}
                    className={`option-button ${detailedRatings.smokingOption === "indoor_smoking" ? "active" : ""}`}
                  >
                    Indoor Smoking Allowed
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailedRatings(prev => ({ 
                      ...prev, 
                      smokingOption: prev.smokingOption === "non_smoking" ? "" : "non_smoking" 
                    }))}
                    className={`option-button ${detailedRatings.smokingOption === "non_smoking" ? "active" : ""}`}
                  >
                    Non-Smoking
                  </button>
                </div>
              </div>

              {/* Category */}
              <div className="rating-criterion" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
                <label className="rating-label">
                  <span>📍 Category</span>
                </label>
                <div className="option-buttons">
                  {["Kafe", "Restoran", "Bar"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDetailedRatings(prev => ({ 
                        ...prev, 
                        category: prev.category === cat ? "" : cat as "Kafe" | "Restoran" | "Bar"
                      }))}
                      className={`option-button ${detailedRatings.category === cat ? "active" : ""}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Yorum Metni */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="reviewComment" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Your Comment
            </label>
            <textarea
              id="reviewComment"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              placeholder="Share your thoughts about this place..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontFamily: "inherit",
                resize: "vertical",
              }}
              required
            />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="submit"
                className="pill primary"
                disabled={isSubmitting || !reviewComment.trim()}
                style={{ flex: 1 }}
              >
                {isSubmitting ? "Submitting..." : isConfirmed ? "Submitted! ✅" : "Submit Review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewComment("");
                  setReviewRating(5);
                  setDetailedRatings({
                    lighting: 3,
                    ambiance: 3,
                    seating: 3,
                    powerOutlets: 3,
                    proximityToWater: 1,
                    smokingOption: "",
                    category: "",
                  });
                }}
                className="pill ghost"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>

            {submitError && (
              <div style={{ marginTop: "12px", padding: "8px", background: "#ffebee", borderRadius: "8px", color: "#c62828" }}>
                Error: {submitError.message || "Failed to submit review"}
              </div>
            )}
          </form>
        )}
      </div>

      {loading && (
        <div className="loading-indicator">
          <p>Loading details...</p>
        </div>
      )}
    </section>
  );
}

