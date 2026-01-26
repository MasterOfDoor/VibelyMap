"use client";

import { useState, useCallback } from "react";
import { useMapPlaces } from "./useMapPlaces";

export function useMapSearch() {
  const { loadPlaces } = useMapPlaces();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"map" | "event">("map");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSearch = useCallback((mode: "map" | "event" = "map") => {
    setSearchMode(mode);
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
  }, []);

  const performSearch = useCallback(
    async (query: string, options?: {
      lat?: number;
      lng?: number;
      radius?: number;
    }) => {
      if (!query.trim()) return [];

      setSearchQuery(query);
      setLoading(true);
      setError(null);
      
      try {
        // Text search için radius sınırı yok - kullanıcı belirli bir mekan adı arıyorsa nerede olursa olsun bulunmalı
        const searchOptions = options || {
          lat: 41.015137,
          lng: 28.97953,
          // radius belirtilmiyor - text search için sınır yok
        };

        const results = await loadPlaces(query, searchOptions);
        closeSearch();
        return results;
      } catch (err: any) {
        setError(err.message || "Arama başarısız");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [loadPlaces, closeSearch]
  );

  return {
    searchQuery,
    isSearchOpen,
    searchMode,
    openSearch,
    closeSearch,
    performSearch,
    loading,
    error,
  };
}



