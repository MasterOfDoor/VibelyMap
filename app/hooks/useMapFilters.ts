"use client";

import { useState, useCallback } from "react";
import { FilterState } from "../components/FilterPanel";
import { Place } from "../components/DetailPanel";

const optionCategory: { [key: string]: string } = {
  Dim: "Lighting",
  Natural: "Lighting",
  Bright: "Lighting",
  "Table Outlet": "Outlets",
  "Few Outlets": "Outlets",
  "Some Outlets": "Outlets",
  Available: "Outlets",
  Retro: "Ambiance",
  Modern: "Ambiance",
  "Has Armchairs": "Seating",
  "No Armchairs": "Seating",
  "Sea View": "Sea",
  "No Sea View": "Sea",
  "Smoking Allowed": "Smoking",
  "Indoor Smoking Allowed": "Smoking",
  Cafe: "Category",
  Restaurant: "Category",
  Bar: "Category",
  "Cocktail Lounge": "Category",
  Tavern: "Category",
  "Shot Bar": "Category",
};

function findOptionCategory(label: string): string | null {
  if (!label) return null;
  if (optionCategory[label]) return optionCategory[label];
  const lower = label.toLowerCase();
  const hit = Object.entries(optionCategory).find(
    ([opt]) => opt.toLowerCase() === lower
  );
  return hit ? hit[1] : null;
}

const CATEGORY_KEYWORDS: { [key: string]: string[] } = {
  Cafe: ["cafe", "coffee", "kahve", "espresso", "coffeeshop", "coffee shop", "kafe"],
  Restaurant: ["restaurant", "restoran", "diner", "bistro", "lokanta", "kebap", "kebab", "ocakbasi", "canteen", "grill", "kokoreç", "kokorec", "ızgara", "izgara"],
  Bar: ["bar", "pub", "bistro bar", "cocktail", "wine", "gece hayatı", "nightlife"],
  "Cocktail Lounge": ["cocktail", "lounge", "mixology", "kokteyl"],
  Tavern: ["meyhane", "tavern", "rakı", "raki"],
  "Shot Bar": ["shot bar", "shots", "shotlar"],
};

// Alcohol serving categories
const ALCOHOL_CATEGORIES = ["Bar", "Cocktail Lounge", "Tavern", "Shot Bar"];
// Alkol kategorilerinde kesinlikle olmaması gereken yiyecek odaklı anahtar kelimeler
const FOOD_EXCLUSION_KEYWORDS = ["kokoreç", "kokorec", "grill", "ızgara", "izgara", "pide", "lahmacun"];

function matchesCategoryOption(place: Place, option: string): boolean {
  const lowOpt = (option || "").toLowerCase();
  const keywords = (CATEGORY_KEYWORDS[option] || []).map((k) => k.toLowerCase());
  const placeCats = (place.subOptions?.Category || place.subOptions?.Kategori || []).map((c: string) => c.toLowerCase());
  const placeTags = (place.tags || []).map((t) => t.toLowerCase());
  const placeType = (place.type || "").toLowerCase();
  const placeName = (place.name || "").toLowerCase();
  
  const haystack = [
    ...placeCats,
    ...placeTags,
    placeType,
    placeName,
  ].filter(Boolean);

  // Eğer alkol kategorisi seçildiyse ve mekanda yemek odaklı anahtar kelimeler varsa eliyoruz
  if (ALCOHOL_CATEGORIES.includes(option)) {
    const hasFoodExclusion = haystack.some(val => 
      FOOD_EXCLUSION_KEYWORDS.some(ex => val.toLowerCase().includes(ex))
    );
    if (hasFoodExclusion) {
      console.log(`[Filter] Mekan alkol kategorisinden elendi (Yemek odağı tespit edildi): ${place.name}`);
      return false;
    }
  }

  return haystack.some((val) => {
    const lowVal = val.toLowerCase();
    if (lowVal === lowOpt) return true;
    if (lowVal.includes(lowOpt)) return true;
    return keywords.some((k) => lowVal.includes(k));
  });
}

function matchesFilters(place: Place, filters: FilterState): boolean {
  const { main, sub, ranges } = filters;
  const hasFilters = main.length > 0 || 
    Object.keys(sub).some((key) => sub[key].length > 0) ||
    (ranges && Object.keys(ranges).length > 0);

  if (!hasFilters) return true;

  // Check range filters (Lighting, Seating, Outlets)
  if (ranges) {
    // Lighting filter (1-5)
    if (ranges.Lighting !== undefined) {
      const placeLightingTag = (place.tags || []).find((tag) => 
        tag.toLowerCase().includes("ışıklandırma") || tag.toLowerCase().includes("isiklandirma") || tag.toLowerCase().includes("lighting")
      );
      if (placeLightingTag) {
        const match = placeLightingTag.match(/\d+/);
        if (match) {
          const placeLightingValue = Number(match[0]);
          if (placeLightingValue < ranges.Lighting) return false;
        }
      }
    }
    
    // Seating filter (0-3)
    if (ranges.Seating !== undefined) {
      const placeSeatingTag = (place.tags || []).find((tag) => 
        tag.toLowerCase().includes("koltuk") || tag.toLowerCase().includes("armchair") || tag.toLowerCase().includes("seating")
      );
      if (placeSeatingTag) {
        let placeSeatingValue = -1;
        const lowerTag = placeSeatingTag.toLowerCase();
        if (lowerTag.includes("yok") || lowerTag.includes("no")) placeSeatingValue = 0;
        else if (lowerTag.includes("az") || lowerTag.includes("few")) placeSeatingValue = 1;
        else if (lowerTag.includes("orta") || lowerTag.includes("medium")) placeSeatingValue = 2;
        else if ((lowerTag.includes("var") || lowerTag.includes("has")) && !lowerTag.includes("az") && !lowerTag.includes("orta")) placeSeatingValue = 3;
        
        const match = placeSeatingTag.match(/\d+/);
        if (match) {
          placeSeatingValue = Number(match[0]);
        }
        
        if (placeSeatingValue >= 0) {
          if (placeSeatingValue < ranges.Seating) return false;
        }
      }
    }

    // Outlets filter (1-4)
    if (ranges.Outlets !== undefined && ranges.Outlets > 0) {
      const placeOutletsTag = (place.tags || []).find((tag) => 
        tag.toLowerCase().includes("priz") || tag.toLowerCase().includes("outlet")
      );
      if (placeOutletsTag) {
        let placeOutletsValue = -1;
        const lowerTag = placeOutletsTag.toLowerCase();
        if (lowerTag.includes("az") || lowerTag.includes("few")) placeOutletsValue = 1;
        else if (lowerTag.includes("orta") || lowerTag.includes("some") || lowerTag.includes("medium")) placeOutletsValue = 2;
        else if ((lowerTag.includes("var") || lowerTag.includes("available")) && !lowerTag.includes("az") && !lowerTag.includes("orta") && !lowerTag.includes("masada") && !lowerTag.includes("table")) placeOutletsValue = 3;
        else if (lowerTag.includes("masada") || lowerTag.includes("table")) placeOutletsValue = 4;
        
        const match = placeOutletsTag.match(/\d+/);
        if (match) {
          placeOutletsValue = Number(match[0]);
        }
        
        if (placeOutletsValue >= 1) {
          if (placeOutletsValue < ranges.Outlets) return false;
        }
      }
    }
  }

  // Check main filters
  if (main.length > 0) {
    // Main filters logic if needed
  }

  // Check sub filters
  for (const [criterion, selectedOptions] of Object.entries(sub)) {
    if (selectedOptions.length === 0) continue;

    // Lighting, Seating and Outlets are handled by ranges, skip here
    if (criterion === "Lighting" || criterion === "Seating" || criterion === "Outlets") {
      continue;
    }

    // Special handling for Category
    if (criterion === "Category") {
      const hasMatchingCategory = selectedOptions.some((option) =>
        matchesCategoryOption(place, option)
      );
      if (!hasMatchingCategory) return false;
      continue;
    }

    // For other criteria, check tags, features, and AI labels
    const placeFeatures = [
      ...(place.tags || []),
      ...(place.features || []),
      ...((place as any).labels || []), // AI'dan gelen labels
    ];

    const hasMatchingOption = selectedOptions.some((option) => {
      // Direct match (case insensitive)
      const optionLower = option.toLowerCase();
      if (placeFeatures.some((f) => f.toLowerCase() === optionLower)) return true;
      
      // Partial match (contains)
      if (placeFeatures.some((f) => f.toLowerCase().includes(optionLower))) return true;

      // Category match
      const optionCat = findOptionCategory(option);
      if (optionCat === criterion) {
        return placeFeatures.some((feat) => {
          const featCat = findOptionCategory(feat);
          return featCat === criterion;
        });
      }

      return false;
    });

    if (!hasMatchingOption) return false;
  }

  return true;
}

export function useMapFilters() {
  const [filters, setFilters] = useState<FilterState>({
    main: [],
    sub: {},
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const openFilters = useCallback(() => {
    setIsFilterOpen(true);
  }, []);

  const closeFilters = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  const applyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setIsFilterOpen(false);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ main: [], sub: {} });
  }, []);

  const filterPlaces = useCallback(
    (places: Place[], currentFilters?: FilterState): Place[] => {
      const filtersToUse = currentFilters || filters;
      return places.filter((place) => matchesFilters(place, filtersToUse));
    },
    [filters]
  );

  return {
    filters,
    isFilterOpen,
    openFilters,
    closeFilters,
    applyFilters,
    resetFilters,
    filterPlaces,
  };
}


