"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useProxy } from "../hooks/useProxy";
import { useReviews, BlockchainReview } from "../hooks/useReviews";
import { useSmartWallet } from "../hooks/useSmartWallet";
import { analyzePlacePhotos } from "../hooks/Gemini_analysis";

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
}

export default function DetailPanel({ isOpen, place, onClose }: DetailPanelProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
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
            author: r.author_name || "Ziyaretçi",
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
      
      setPlaceDetails(place);
      setCurrentPhotoIndex(0); // Her yeni mekan açıldığında ilk fotoğrafa dön
      
      // Sadece yeni bir mekan açıldığında formu kapat ve temizle
      if (isNewPlace) {
        setReviewComment(""); // Formu temizle
        setReviewRating(5);
        setShowReviewForm(false);
      }
      
      // Fetch detailed information if not already loaded
      if (!place.address && !place.hours) {
        loadPlaceDetails(place.id);
      }

      // Yeni mekan açıldığında Gemini fotoğraf analizi yap
      if (isNewPlace && place) {
        analyzePlacePhotos(place).then((tags) => {
          if (tags.length > 0) {
            setPlaceDetails((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                tags: [...(prev.tags || []), ...tags],
              };
            });
          }
        }).catch((error) => {
          console.error("[DetailPanel] Gemini analizi hatası:", error);
        });
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
      alert("Yorum yapmak için wallet bağlantısı gerekli");
      return;
    }

    if (!reviewComment.trim()) {
      alert("Lütfen bir yorum yazın");
      return;
    }

    try {
      await submitReview(reviewRating, reviewComment.trim(), []);
      setReviewComment("");
      setReviewRating(5);
      setShowReviewForm(false);
      // Review listesini yenile
      setTimeout(() => {
        refetch();
      }, 3000);
    } catch (error: any) {
      console.error("Yorum gönderme hatası:", error);
      alert(error?.message || "Yorum gönderilirken bir hata oluştu");
    }
  }, [place?.id, isConnected, reviewComment, reviewRating, submitReview, refetch]);

  // Photos array'ini memoize et - hooks must be called before early return
  const photos = useMemo(() => {
    if (!placeDetails) return [];
    const list = placeDetails.photos?.length
      ? placeDetails.photos
      : placeDetails.photo
      ? [placeDetails.photo]
      : [];
    const filtered = list.filter(Boolean);
    console.log("[DetailPanel] Photos memoized:", {
      placeName: placeDetails.name,
      photosArrayLength: placeDetails.photos?.length || 0,
      photoString: placeDetails.photo ? "var" : "yok",
      finalPhotosCount: filtered.length,
      photos: filtered,
    });
    return filtered;
  }, [placeDetails?.photos, placeDetails?.photo, placeDetails?.name]);

  // Photos değiştiğinde index'i sıfırla
  useEffect(() => {
    if (placeDetails) {
      if (photos.length > 0 && currentPhotoIndex >= photos.length) {
        setCurrentPhotoIndex(0);
      }
    }
  }, [placeDetails, photos, currentPhotoIndex]);

  // Klavye ile navigasyon (ESC ile kapat, ok tuşları ile gezin)
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft" && photos.length > 1) {
        setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight" && photos.length > 1) {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, photos]);

  // Fotoğraf navigasyon fonksiyonları
  const handlePrevPhoto = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => {
        const newIndex = (prev - 1 + photos.length) % photos.length;
        return newIndex;
      });
    }
  }, [photos]);

  const handleNextPhoto = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => {
        const newIndex = (prev + 1) % photos.length;
        return newIndex;
      });
    }
  }, [photos]);

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
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
            {placeDetails.type || "Mekan"}
          </p>
          <h2 id="placeName">{placeDetails.name}</h2>
          {placeDetails.hours && (
            <div id="placeHours" className="muted-text tiny">
              {placeDetails.hours}
            </div>
          )}
          {placeDetails.address && (
            <div id="placeAddress" className="muted-text tiny">
              Adres: {placeDetails.address}
            </div>
          )}
          <div id="placeTags" className="tags">
            {placeDetails.tags?.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
            {placeDetails.features?.map((feature, index) => (
              <span key={`feat-${index}`} className="tag subtag">
                {feature}
              </span>
            ))}
          </div>
        </div>
        <button
          id="closeDetail"
          className="icon-btn hide-close"
          onClick={onClose}
          aria-label="Detayı kapat"
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
                  onClick={handlePrevPhoto}
                  aria-label="Önceki foto"
                  type="button"
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 10,
                    display: "flex",
                  }}
                >
                  &lt;
                </button>
                <button
                  className="photo-nav next"
                  onClick={handleNextPhoto}
                  aria-label="Sonraki foto"
                  type="button"
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 10,
                    display: "flex",
                  }}
                >
                  &gt;
                </button>
              </>
            )}
            <img
              className="photo-main"
              key={photos[currentPhotoIndex] || photos[0]}
              src={photos[currentPhotoIndex] || photos[0]}
              alt={placeDetails.name}
              loading="lazy"
              onClick={openFullscreen}
              style={{ cursor: "pointer" }}
            />
          </div>
          {photos.length > 1 && (
            <div style={{ 
              marginTop: "8px", 
              textAlign: "center", 
              fontSize: "12px", 
              color: "var(--muted)" 
            }}>
              Fotoğraf {currentPhotoIndex + 1} / {photos.length}
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
            key={photos[currentPhotoIndex] || photos[0]}
            src={photos[currentPhotoIndex] || photos[0]}
            alt={placeDetails.name}
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
            aria-label="Kapat"
          >
            &times;
          </button>
          
          {/* Navigasyon butonları - sadece birden fazla fotoğraf varsa */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
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
                  zIndex: 100001,
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.15)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.8)";
                }}
                aria-label="Önceki foto"
              >
                &lt;
              </button>
              <button
                onClick={handleNextPhoto}
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
                  zIndex: 100001,
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.15)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.8)";
                }}
                aria-label="Sonraki foto"
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
          <span>Puan: {placeDetails.rating}</span>
        )}
        {placeDetails.priceLabel && (
          <span>Fiyat: {placeDetails.priceLabel}</span>
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
          <h3>Blockchain Yorumları</h3>
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
          <h3>Google Yorumları</h3>
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
          <h3>Yorum Yap</h3>
          {!isConnected && (
            <span className="muted-text tiny" style={{ color: "#ff6b6b" }}>
              Yorum yapmak için wallet bağlayın
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
            Yorum Yaz
          </button>
        )}

        {showReviewForm && isConnected && (
          <form onSubmit={handleSubmitReview} className="review-form" style={{ marginTop: "16px" }}>
            <label htmlFor="reviewRating" style={{ display: "block", marginBottom: "8px" }}>
              Puan: {reviewRating} ⭐
            </label>
            <input
              type="range"
              id="reviewRating"
              min="1"
              max="5"
              value={reviewRating}
              onChange={(e) => setReviewRating(Number(e.target.value))}
              style={{ width: "100%", marginBottom: "16px" }}
            />

            <label htmlFor="reviewComment" style={{ display: "block", marginBottom: "8px" }}>
              Yorumunuz
            </label>
            <textarea
              id="reviewComment"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              placeholder="Bu mekan hakkında düşüncelerinizi paylaşın..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                marginBottom: "16px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
              required
            />

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="submit"
                className="pill primary"
                disabled={isSubmitting || !reviewComment.trim()}
                style={{ flex: 1 }}
              >
                {isSubmitting ? "Gönderiliyor..." : isConfirmed ? "Gönderildi! ✅" : "Yorumu Gönder"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewComment("");
                  setReviewRating(5);
                }}
                className="pill ghost"
                disabled={isSubmitting}
              >
                İptal
              </button>
            </div>

            {submitError && (
              <div style={{ marginTop: "12px", padding: "8px", background: "#ffebee", borderRadius: "8px", color: "#c62828" }}>
                Hata: {submitError.message || "Yorum gönderilemedi"}
              </div>
            )}
          </form>
        )}
      </div>

      {loading && (
        <div className="loading-indicator">
          <p>Detaylar yükleniyor...</p>
        </div>
      )}
    </section>
  );
}

