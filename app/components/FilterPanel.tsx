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
}

const baseCriteria = ["Isiklandirma", "Yemek", "Priz", "Fiyat", "Ambiyans", "Oturma", "Deniz", "Sigara"];

const criterionOptions: { [key: string]: string[] } = {
  Kategori: ["Kafe", "Restoran", "Bar"],
  Isiklandirma: ["Los", "Dogal", "Canli"],
  Yemek: ["Tatli", "Kahvalti", "Vegan", "Atistirmalik"],
  Priz: ["Masada priz"],
  Fiyat: ["Uygun", "Orta", "Pahali"],
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
      );
    if (!hasFilters) {
      alert("En az bir filtre seçmelisin.");
      return;
    }
    onApplyFilters(selectedFilters);
  };

  const handleReset = () => {
    setSelectedFilters({ main: [], sub: {} });
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
        {Object.entries(criterionOptions).map(([criterion, options]) => (
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
        ))}

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



