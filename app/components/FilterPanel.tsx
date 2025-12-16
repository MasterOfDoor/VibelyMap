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
    [key: string]: number; // Isiklandirma: 1-5, Oturma (Koltuk): 0-3
  };
}

const baseCriteria = ["Isiklandirma", "Priz", "Ambiyans", "Oturma", "Deniz", "Sigara"];

const criterionOptions: { [key: string]: string[] } = {
  Kategori: ["Kafe", "Restoran", "Bar"],
  Isiklandirma: ["Los", "Dogal", "Canli"],
  Priz: ["Masada priz"],
  Ambiyans: ["Retro", "Modern"],
  Oturma: ["Koltuk var", "Koltuk yok"],
  Deniz: ["Deniz goruyor", "Deniz gormuyor"],
  Sigara: ["Sigara icilebilir", "Kapali alanda sigara icilebilir"],
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
    // Range değerlerini de ekle
    const filtersWithRanges = {
      ...selectedFilters,
      ranges: rangeValues,
    };
    onApplyFilters(filtersWithRanges);
  };

  const handleReset = () => {
    setSelectedFilters({ main: [], sub: {}, ranges: {} });
    setRangeValues({ Isiklandirma: 3, Oturma: 0 });
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
          // Işıklandırma ve Oturma için range input göster
          if (criterion === "Isiklandirma" || criterion === "Oturma") {
            const isIsiklandirma = criterion === "Isiklandirma";
            const min = isIsiklandirma ? 1 : 0;
            const max = isIsiklandirma ? 5 : 3;
            const currentValue = rangeValues[criterion] || (isIsiklandirma ? 3 : 0);
            const labels = isIsiklandirma 
              ? ["Canlı", "", "Doğal", "", "Loş"]
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
                  {criterion}
                  <span className="chevron">
                    {expandedCriterion === criterion ? "∧" : "∨"}
                  </span>
                </button>
                <div className="sub-options">
                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <span style={{ minWidth: "80px", fontSize: "14px", fontWeight: "500" }}>Puan: {currentValue}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
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
                      <span style={{ fontSize: "24px", lineHeight: "1" }}>⭐</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      {labels.map((label, idx) => (
                        <span key={idx} style={{ flex: idx === 0 || idx === labels.length - 1 ? "0 0 auto" : "1" }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
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



