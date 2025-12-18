"use client";

import { Place } from "./DetailPanel";

interface ResultsPanelProps {
  isOpen: boolean;
  places: Place[];
  onClose: () => void;
  onPlaceClick: (place: Place) => void;
  isPlaceAnalyzing?: (placeId: string) => boolean;
}

export default function ResultsPanel({
  isOpen,
  places,
  onClose,
  onPlaceClick,
  isPlaceAnalyzing,
}: ResultsPanelProps) {
  if (!isOpen) return null;

  return (
    <aside
      id="resultsPanel"
      className={`panel results ${isOpen ? "" : "hidden"}`}
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sonuçlar</p>
          <h2>Bulunan mekanlar ({places.length})</h2>
        </div>
        <button
          id="closeResults"
          className="icon-btn hide-close"
          onClick={onClose}
          aria-label="Sonuç listesini kapat"
        >
          &times;
        </button>
      </div>
      <div
        id="resultsList"
        className={`results-list ${places.length === 0 ? "empty" : ""}`}
      >
        {places.length === 0 ? (
          <p>Sonuç yok.</p>
        ) : (
          places.map((place) => {
            const analyzing = isPlaceAnalyzing?.(place.id);
            return (
              <div
                key={place.id}
                className={`result-item ${analyzing ? 'analyzing' : ''}`}
                onClick={() => onPlaceClick(place)}
              >
                <div className="result-item-content">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3>{place.name}</h3>
                    {analyzing && <span className="animate-spin" style={{ fontSize: "12px" }}>⏳</span>}
                  </div>
                  <p className="result-type">{place.type}</p>
                {place.address && (
                  <p className="result-address muted-text tiny">
                    {place.address}
                  </p>
                )}
                <div className="result-meta">
                  {place.rating && (
                    <span className="result-rating">⭐ {place.rating}</span>
                  )}
                  {place.priceLabel && (
                    <span className="result-price">{place.priceLabel}</span>
                  )}
                </div>
                {place.tags && place.tags.length > 0 && (
                  <div className="result-tags">
                    {place.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="tag small">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {place.photo && (
                <div className="result-image">
                  <img src={place.photo} alt={place.name} loading="lazy" />
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
    </aside>
  );
}



