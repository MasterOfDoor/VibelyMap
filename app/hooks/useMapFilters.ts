"use client";

import { useState, useCallback } from "react";
import { FilterState } from "../components/FilterPanel";
import { Place } from "../components/DetailPanel";

const optionCategory: { [key: string]: string } = {
  Los: "Isiklandirma",
  Dogal: "Isiklandirma",
  Canli: "Isiklandirma",
  Tatli: "Yemek",
  Kahvalti: "Yemek",
  Vegan: "Yemek",
  Atistirmalik: "Yemek",
  "Masada priz": "Priz",
  Uygun: "Fiyat",
  Orta: "Fiyat",
  Pahali: "Fiyat",
  Retro: "Ambiyans",
  Modern: "Ambiyans",
  "Koltuk var": "Oturma",
  "Koltuk yok": "Oturma",
  "Deniz goruyor": "Deniz",
  "Deniz gormuyor": "Deniz",
  "Sigara icilebilir": "Sigara",
  "Kapali alanda sigara icilebilir": "Sigara",
  Kafe: "Kategori",
  Restoran: "Kategori",
  Bar: "Kategori",
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
  Kafe: ["cafe", "coffee", "kahve", "espresso", "coffeeshop", "coffee shop"],
  Restoran: ["restaurant", "restoran", "diner", "bistro", "lokanta", "kebap", "kebab", "ocakbasi", "canteen"],
  Bar: ["bar", "pub", "bistro bar", "cocktail", "wine"],
};

function matchesCategoryOption(place: Place, option: string): boolean {
  const lowOpt = (option || "").toLowerCase();
  const keywords = (CATEGORY_KEYWORDS[option] || []).map((k) => k.toLowerCase());
  const placeCats = (place.subOptions?.Kategori || []).map((c) => c.toLowerCase());
  const placeTags = (place.tags || []).map((t) => t.toLowerCase());
  const placeType = (place.type || "").toLowerCase();
  const placeName = (place.name || "").toLowerCase();
  
  const haystack = [
    ...placeCats,
    ...placeTags,
    placeType,
    placeName,
  ].filter(Boolean);

  return haystack.some((val) => {
    if (val === lowOpt) return true;
    if (val.includes(lowOpt)) return true;
    return keywords.some((k) => val.includes(k));
  });
}

function matchesFilters(place: Place, filters: FilterState): boolean {
  const { main, sub, ranges } = filters;
  const hasFilters = main.length > 0 || 
    Object.keys(sub).some((key) => sub[key].length > 0) ||
    (ranges && Object.keys(ranges).length > 0);

  if (!hasFilters) return true;

  // Check range filters (Isiklandirma and Oturma)
  if (ranges) {
    // Işıklandırma filtresi (1-5)
    if (ranges.Isiklandirma !== undefined) {
      const placeIsikTag = (place.tags || []).find((tag) => 
        tag.toLowerCase().includes("ışıklandırma") || tag.toLowerCase().includes("isiklandirma")
      );
      if (placeIsikTag) {
        // Etiketten sayıyı çıkar: "Işıklandırma 3" -> 3
        const match = placeIsikTag.match(/\d+/);
        if (match) {
          const placeIsikValue = Number(match[0]);
          // Kullanıcının seçtiği değerden küçük veya eşit olmalı (daha loş = daha yüksek sayı)
          // Örnek: Kullanıcı 3 seçtiyse, mekan 3, 4 veya 5 olabilir (daha loş veya eşit)
          if (placeIsikValue < ranges.Isiklandirma) return false;
        }
      }
      // Etiket yoksa, filtreleme yapma (veri eksik - kabul et)
    }
    
    // Koltuk filtresi (0-3)
    if (ranges.Oturma !== undefined) {
      const placeKoltukTag = (place.tags || []).find((tag) => 
        tag.toLowerCase().includes("koltuk")
      );
      if (placeKoltukTag) {
        // Etiketten sayıyı çıkar veya metin kontrolü yap
        let placeKoltukValue = -1;
        const lowerTag = placeKoltukTag.toLowerCase();
        if (lowerTag.includes("yok")) placeKoltukValue = 0;
        else if (lowerTag.includes("az")) placeKoltukValue = 1;
        else if (lowerTag.includes("orta")) placeKoltukValue = 2;
        else if (lowerTag.includes("var") && !lowerTag.includes("az") && !lowerTag.includes("orta")) placeKoltukValue = 3;
        
        const match = placeKoltukTag.match(/\d+/);
        if (match) {
          placeKoltukValue = Number(match[0]);
        }
        
        if (placeKoltukValue >= 0) {
          // Kullanıcının seçtiği değerden küçük veya eşit olmalı
          // Örnek: Kullanıcı 2 seçtiyse, mekan 2 veya 3 olabilir (daha fazla veya eşit)
          if (placeKoltukValue < ranges.Oturma) return false;
        }
      }
      // Etiket yoksa, filtreleme yapma (veri eksik - kabul et)
    }
  }

  // Check main filters
  if (main.length > 0) {
    // Main filters logic if needed
  }

  // Check sub filters
  for (const [criterion, selectedOptions] of Object.entries(sub)) {
    if (selectedOptions.length === 0) continue;

    // Isiklandirma and Oturma are handled by ranges, skip here
    if (criterion === "Isiklandirma" || criterion === "Oturma") {
      continue;
    }

    // Special handling for Kategori
    if (criterion === "Kategori") {
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


