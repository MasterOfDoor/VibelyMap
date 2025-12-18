"use client";

import { useState } from "react";

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  onResetFilters: () => void;
}

export interface FilterState {
  main: string[];
  sub: {
    [key: string]: string[];
  };
  ranges?: {
    [key: string]: number; // Isiklandirma: 1-5, Oturma (Koltuk): 0-3, Priz: 1-4, Radius: 500-10000
  };
}

const baseCriteria = ["Isiklandirma", "Priz", "Ambiyans", "Oturma", "Deniz", "Sigara", "Mesafe"];

const criterionOptions: { [key: string]: string[] } = {
  Kategori: ["Kafe", "Restoran", "Bar", "Cocktail Lounge", "Meyhane", "Shot Bar"],
  Isiklandirma: ["Los", "Dogal", "Canli"],
  Priz: ["Priz Az", "Priz Orta", "Priz Var", "Masada priz"],
  Ambiyans: ["Retro", "Modern"],
  Oturma: ["Koltuk var", "Koltuk yok"],
  Deniz: ["Deniz goruyor", "Deniz gormuyor"],
  Sigara: ["Sigara icilebilir", "Kapali alanda sigara icilebilir"],
  Mesafe: ["500m", "1km", "2km", "3km", "5km", "10km"],
};

export default function FilterPanel({
  isOpen,
  onClose,
  onApplyFilters,
  onResetFilters,
}: FilterPanelProps) {
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<FilterState>({
    main: [],
    sub: {},
    ranges: {},
  });
  const [rangeValues, setRangeValues] = useState<{ [key: string]: number }>({
    Isiklandirma: 3,
    Oturma: 0,
    Priz: 0,
    Mesafe: 2000, // Default: 2km
  });

  const toggleCriterion = (criterion: string) => {
    setExpandedCriterion(expandedCriterion === criterion ? null : criterion);
  };

  const toggleFilter = (criterion: string, option: string) => {
    setSelectedFilters((prev) => {
      const newSub = { ...prev.sub };
      if (!newSub[criterion]) {
        newSub[criterion] = [];
      }
      const optionIndex = newSub[criterion].indexOf(option);
      if (optionIndex > -1) {
        newSub[criterion] = newSub[criterion].filter((o) => o !== option);
      } else {
        newSub[criterion] = [...newSub[criterion], option];
      }
      return {
        main: prev.main,
        sub: newSub,
      };
    });
  };

  const handleApply = () => {
    const hasFilters =
      selectedFilters.main.length > 0 ||
      Object.keys(selectedFilters.sub).some(
        (key) => selectedFilters.sub[key].length > 0
      ) ||
      (selectedFilters.ranges && Object.keys(selectedFilters.ranges).length > 0);
    if (!hasFilters) {
      alert("En az bir filtre seçmelisin.");
      return;
    }
    // Range değerlerini ekle, ama default değerlerdeyse ekleme
    // Default değerler: Isiklandirma: 3, Oturma: 0, Priz: 0
    const ranges: { [key: string]: number } = {};
    if (rangeValues.Isiklandirma !== 3) {
      ranges.Isiklandirma = rangeValues.Isiklandirma;
    }
    if (rangeValues.Oturma !== 0) {
      ranges.Oturma = rangeValues.Oturma;
    }
    if (rangeValues.Priz !== 0 && rangeValues.Priz !== undefined) {
      ranges.Priz = rangeValues.Priz;
    }
    // Mesafe her zaman eklenmeli (default olsa bile arama için kritik)
    ranges.Mesafe = rangeValues.Mesafe;
    
    const filtersWithRanges = {
      ...selectedFilters,
      ranges: Object.keys(ranges).length > 0 ? ranges : undefined,
    };
    onApplyFilters(filtersWithRanges);
  };

  const handleReset = () => {
    setSelectedFilters({ main: [], sub: {}, ranges: {} });
    setRangeValues({ Isiklandirma: 3, Oturma: 0, Priz: 0, Mesafe: 2000 });
    setExpandedCriterion(null);
    onResetFilters();
  };

  return (
    <aside
      id="filterPanel"
      className={`panel ${isOpen ? "open" : ""}`}
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Nasıl bir mekan istediğin?</p>
          <h2>Filtrele</h2>
        </div>
        <button
          id="closeFilter"
          className="icon-btn hide-close"
          onClick={onClose}
          aria-label="Filtreyi kapat"
        >
          &times;
        </button>
      </div>
      <form id="filterForm" className="filter-list">
        {Object.entries(criterionOptions).map(([criterion, options]) => {
          // Işıklandırma, Oturma, Priz ve Mesafe için range input göster
          if (criterion === "Isiklandirma" || criterion === "Oturma" || criterion === "Priz" || criterion === "Mesafe") {
            const isIsiklandirma = criterion === "Isiklandirma";
            const isPriz = criterion === "Priz";
            const isMesafe = criterion === "Mesafe";
            
            const min = isIsiklandirma ? 1 : (isPriz ? 1 : (isMesafe ? 500 : 0));
            const max = isIsiklandirma ? 5 : (isPriz ? 4 : (isMesafe ? 10000 : 3));
            const step = isMesafe ? 500 : 1;
            
            const currentValue = rangeValues[criterion];
            
            const labels = isIsiklandirma 
              ? ["Canlı", "", "Doğal", "", "Loş"]
              : isPriz
              ? ["", "Az", "Orta", "Var", "Masada Priz"]
              : isMesafe
              ? ["500m", "2km", "5km", "10km"]
              : ["Yok", "Az", "Orta", "Var"];
            
            return (
              <div
                key={criterion}
                className={`filter-group ${expandedCriterion === criterion ? "open" : ""}`}
                data-criterion={criterion}
              >
                <button
                  type="button"
                  className={`filter-main ${expandedCriterion === criterion ? "active" : ""}`}
                  onClick={() => toggleCriterion(criterion)}
                >
                  {criterion === "Mesafe" ? "Arama Mesafesi" : criterion}
                  <span className="chevron">
                    {expandedCriterion === criterion ? "∧" : "∨"}
                  </span>
                </button>
                <div className="sub-options">
                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <span style={{ minWidth: "80px", fontSize: "14px", fontWeight: "500" }}>
                        {isMesafe ? `${currentValue / 1000} km` : `Puan: ${currentValue}`}
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={currentValue}
                        data-criterion={criterion}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setRangeValues((prev) => ({ ...prev, [criterion]: newValue }));
                          setSelectedFilters((prev) => ({
                            ...prev,
                            ranges: { ...(prev.ranges || {}), [criterion]: newValue },
                          }));
                        }}
                        style={{ 
                          flex: 1,
                          height: "8px",
                          borderRadius: "4px",
                          background: "#e0e0e0",
                          outline: "none",
                          WebkitAppearance: "none",
                        }}
                      />
                      <span style={{ fontSize: "24px", lineHeight: "1" }}>{isMesafe ? "📍" : "⭐"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      {labels.map((label, idx) => (
                        <span key={idx} style={{ flex: idx === 0 || idx === labels.length - 1 ? "0 0 auto" : "1", textAlign: idx === labels.length - 1 ? "right" : (idx === 0 ? "left" : "center") }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          // Priz ve Mesafe için chip-option gösterme (range input kullanılıyor)
          if (criterion === "Priz" || criterion === "Mesafe") {
            return null;
          }
          
          // Diğer kriterler için normal chip-option'lar
          return (
            <div
              key={criterion}
              className={`filter-group ${expandedCriterion === criterion ? "open" : ""}`}
              data-criterion={criterion}
            >
              <button
                type="button"
                className={`filter-main ${expandedCriterion === criterion ? "active" : ""}`}
                onClick={() => toggleCriterion(criterion)}
              >
                {criterion}
                <span className="chevron">
                  {expandedCriterion === criterion ? "∧" : "∨"}
                </span>
              </button>
              <div className="sub-options">
                {options.map((option) => {
                  const isSelected =
                    selectedFilters.sub[criterion]?.includes(option) || false;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`chip-option ${isSelected ? "active" : ""}`}
                      data-criterion={criterion}
                      data-option={option}
                      onClick={() => toggleFilter(criterion, option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          id="resetFilters"
          className="pill ghost"
          onClick={handleReset}
        >
          Temizle
        </button>
        <button
          type="button"
          id="applyFilters"
          className="pill secondary"
          onClick={handleApply}
        >
          Filtreyi Uygula
        </button>
      </form>
    </aside>
  );
}



