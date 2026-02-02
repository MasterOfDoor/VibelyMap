"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useProxy } from "../hooks/useProxy";

interface AutocompleteSuggestion {
  placeId: string;
  text: string;
  matchedSubstrings: Array<{ offset: number; length: number }>;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  onPlaceSelect?: (placeId: string) => void;
  searchMode?: "map" | "event";
}

export default function SearchOverlay({
  isOpen,
  onClose,
  onSearch,
  onPlaceSelect,
  searchMode = "map",
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentQueryRef = useRef<string>("");
  const [noResultsFor, setNoResultsFor] = useState<string | null>(null);
  const { googleAutocomplete } = useProxy();

  useEffect(() => {
    currentQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Autocomplete fetch with debounce, stale-response ignore, and timeout
  const fetchAutocomplete = useCallback(async (input: string) => {
    const trimmed = input?.trim() || "";
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    setNoResultsFor(null);
    setIsLoadingSuggestions(true);

    let lat: string | undefined;
    let lng: string | undefined;
    try {
      if (navigator.geolocation && (window as any).getUserLocation) {
        const userLoc = (window as any).getUserLocation();
        if (userLoc?.lat != null && userLoc?.lng != null) {
          lat = String(userLoc.lat);
          lng = String(userLoc.lng);
        }
      }
    } catch {
      /* ignore */
    }
    if (lat == null || lng == null) {
      lat = "41.015137";
      lng = "28.97953";
    }

    const fetchPromise = googleAutocomplete({
      input: trimmed,
      lat,
      lng,
      radius: "30000",
    });

    const timeoutMs = 10000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Autocomplete timeout")), timeoutMs)
    );

    try {
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      if (currentQueryRef.current.trim() !== trimmed) return;
      const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setSuggestions(list);
      if (list.length === 0) setNoResultsFor(trimmed);
      else setNoResultsFor(null);
    } catch (err: any) {
      if (currentQueryRef.current.trim() !== trimmed) return;
      console.error("[Autocomplete] Error:", err?.message || err);
      setSuggestions([]);
      setNoResultsFor(null);
    } finally {
      if (currentQueryRef.current.trim() === trimmed) {
        setIsLoadingSuggestions(false);
      }
    }
  }, [googleAutocomplete]);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const q = query.trim();
    if (q.length >= 2) {
      debounceTimerRef.current = setTimeout(() => fetchAutocomplete(query), 300);
    } else {
      setSuggestions([]);
      setNoResultsFor(null);
      setIsLoadingSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, fetchAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(-1);
  };

  const handleSuggestionSelect = async (suggestion: AutocompleteSuggestion) => {
    // Don't update query state - go directly to search/select
    setSuggestions([]);
    setSelectedIndex(-1);

    // If onPlaceSelect callback is provided, fetch place details and call it
    if (onPlaceSelect && suggestion.placeId) {
      try {
        // Place details will be handled by the callback
        onPlaceSelect(suggestion.placeId);
      } catch (error) {
        console.error("[Autocomplete] Place select error:", error);
      }
    } else {
      // Fallback to regular search
      onSearch(suggestion.text);
    }
    
    // Clear and close after handling
    setQuery("");
    onClose();
  };

  const handleSearch = () => {
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSuggestionSelect(suggestions[selectedIndex]);
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    onSearch(trimmedQuery);
    setQuery("");
    setSuggestions([]);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  };

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Highlight matched text in suggestion
  const highlightMatchedText = (text: string, matches: Array<{ offset: number; length: number }>): React.ReactNode => {
    if (!matches || matches.length === 0) return text;

    const parts: Array<{ text: string; matched: boolean }> = [];
    let lastIndex = 0;

    // Sort matches by offset
    const sortedMatches = [...matches].sort((a, b) => a.offset - b.offset);

    sortedMatches.forEach((match) => {
      // Add unmatched text before match
      if (match.offset > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.offset),
          matched: false,
        });
      }

      // Add matched text
      parts.push({
        text: text.substring(match.offset, match.offset + match.length),
        matched: true,
      });

      lastIndex = match.offset + match.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        matched: false,
      });
    }

    return (
      <>
        {parts.map((part, index) =>
          part.matched ? (
            <strong key={index} style={{ fontWeight: "600" }}>
              {part.text}
            </strong>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </>
    );
  };

  return (
    <div
      id="searchOverlay"
      className={`search-overlay ${isOpen ? "" : "collapsed"}`}
    >
      <div className="search-shell">
        <input
          ref={inputRef}
          type="text"
          id="placeSearchInput"
          placeholder="Search places"
          aria-label="Search places"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />
        <button
          id="placeSearchBtn"
          className="pill secondary"
          onClick={handleSearch}
        >
          Search
        </button>
        {(suggestions.length > 0 || isLoadingSuggestions || (noResultsFor != null && noResultsFor === query.trim())) && (
          <div 
            id="searchSuggestions" 
            ref={suggestionsRef}
            className="search-suggestions"
          >
            {isLoadingSuggestions ? (
              <div className="suggestion-item loading">Searching...</div>
            ) : noResultsFor != null && noResultsFor === query.trim() ? (
              <div className="suggestion-item loading">No results found</div>
            ) : (
              suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId || index}
                  className={`suggestion-item ${index === selectedIndex ? "selected" : ""}`}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="suggestion-text">
                    {suggestion.matchedSubstrings && suggestion.matchedSubstrings.length > 0
                      ? highlightMatchedText(suggestion.text, suggestion.matchedSubstrings)
                      : suggestion.text}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}



