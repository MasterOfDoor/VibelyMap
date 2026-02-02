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
    [key: string]: number; // Isiklandirma: 1-5, Oturma (Koltuk): 0-3, Priz: 1-4
  };
}

const baseCriteria = ["Lighting", "Outlets", "Ambiance", "Seating", "Sea", "Smoking"];

const criterionOptions: { [key: string]: string[] } = {
  Category: ["Cafe", "Restaurant", "Bar", "Cocktail Lounge", "Tavern", "Shot Bar"],
  Lighting: ["Dim", "Natural", "Bright"],
  Outlets: ["Few Outlets", "Some Outlets", "Available", "Table Outlet"],
  Ambiance: ["Retro", "Modern"],
  Seating: ["Has Armchairs", "No Armchairs"],
  Sea: ["Sea View", "No Sea View"],
  Smoking: ["Smoking Allowed", "Indoor Smoking Allowed"],
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
    Lighting: 3,
    Seating: 0,
    Outlets: 0,
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
    // Gerçek bir kategori seçilip seçilmediğini kontrol et
    const hasCategory = selectedFilters.sub.Category && selectedFilters.sub.Category.length > 0;
    
    if (!hasCategory) {
      alert("You must select at least one category.");
      return;
    }

    // Add range values only if different from defaults
    // Default values: Lighting: 3, Seating: 0, Outlets: 0
    const ranges: { [key: string]: number } = {};
    if (rangeValues.Lighting !== 3) ranges.Lighting = rangeValues.Lighting;
    if (rangeValues.Seating !== 0) ranges.Seating = rangeValues.Seating;
    if (rangeValues.Outlets !== 0 && rangeValues.Outlets !== undefined) ranges.Outlets = rangeValues.Outlets;
    
    const filtersWithExtra = {
      ...selectedFilters,
      ranges: Object.keys(ranges).length > 0 ? ranges : undefined,
      // searchRadius sabit değer (kullanıcı seçemez)
      searchRadius: 1500 // Google Maps gibi optimize edilmiş sabit radius
    };

    onApplyFilters(filtersWithExtra as any);
  };

  const handleReset = () => {
    setSelectedFilters({ main: [], sub: {}, ranges: {} });
    setRangeValues({ Lighting: 3, Seating: 0, Outlets: 0 });
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
          <p className="eyebrow">What kind of place do you want?</p>
          <h2>Filter</h2>
        </div>
        <button
          id="closeFilter"
          className="icon-btn hide-close"
          onClick={onClose}
          aria-label="Close filter"
        >
          &times;
        </button>
      </div>
      <form id="filterForm" className="filter-list">
        {Object.entries(criterionOptions).map(([criterion, options]) => {
          // Show range input for Lighting, Seating, Outlets
          if (criterion === "Lighting" || criterion === "Seating" || criterion === "Outlets") {
            const isLighting = criterion === "Lighting";
            const isOutlets = criterion === "Outlets";
            
            const min = isLighting ? 1 : (isOutlets ? 1 : 0);
            const max = isLighting ? 5 : (isOutlets ? 4 : 3);
            const step = 1;
            
            const currentValue = rangeValues[criterion];
            
            const labels = isLighting 
              ? ["Bright", "", "Natural", "", "Dim"]
              : isOutlets
              ? ["", "Few", "Medium", "Available", "Table Outlet"]
              : ["None", "Few", "Medium", "Available"];
            
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
                      <span style={{ minWidth: "80px", fontSize: "14px", fontWeight: "500" }}>
                        Score: {currentValue}
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
                      <span style={{ fontSize: "24px", lineHeight: "1" }}>⭐</span>
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
          
          // Don't show chip-options for Outlets (range input is used)
          if (criterion === "Outlets") {
            return null;
          }
          
          // Normal chip-options for other criteria
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
          Clear
        </button>
        <button
          type="button"
          id="applyFilters"
          className="pill secondary"
          onClick={handleApply}
        >
          Apply Filter
        </button>
      </form>
    </aside>
  );
}



