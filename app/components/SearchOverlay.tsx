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
  const { googleAutocomplete, googlePlaceDetails } = useProxy();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Autocomplete fetch with debounce
  const fetchAutocomplete = useCallback(async (input: string) => {
    if (!input || input.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      // Get user location if available
      let lat: string | undefined;
      let lng: string | undefined;

      if (navigator.geolocation && (window as any).getUserLocation) {
        try {
          const userLoc = (window as any).getUserLocation();
          if (userLoc) {
            lat = userLoc.lat?.toString();
            lng = userLoc.lng?.toString();
          }
        } catch (e) {
          // Fallback to Istanbul center
          lat = "41.015137";
          lng = "28.97953";
        }
      } else {
        // Default Istanbul center
        lat = "41.015137";
        lng = "28.97953";
      }

      const data = await googleAutocomplete({
        input: input.trim(),
        lat,
        lng,
        radius: "30000", // 30km
      });

      setSuggestions(data.suggestions || []);
    } catch (error: any) {
      console.error("[Autocomplete] Error:", error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [googleAutocomplete]);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchAutocomplete(query);
      }, 300); // 300ms debounce
    } else {
      setSuggestions([]);
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
    setQuery(suggestion.text);
    setSuggestions([]);
    setSelectedIndex(-1);

    // If onPlaceSelect callback is provided, fetch place details and call it
    if (onPlaceSelect && suggestion.placeId) {
      try {
        // Place details will be handled by the callback
        onPlaceSelect(suggestion.placeId);
        onClose();
      } catch (error) {
        console.error("[Autocomplete] Place select error:", error);
      }
    } else {
      // Fallback to regular search
      onSearch(suggestion.text);
      onClose();
    }
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
          placeholder="Mekan ara"
          aria-label="Mekan ara"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />
        <button
          id="placeSearchBtn"
          className="pill secondary"
          onClick={handleSearch}
        >
          Ara
        </button>
        {(suggestions.length > 0 || isLoadingSuggestions) && (
          <div 
            id="searchSuggestions" 
            ref={suggestionsRef}
            className="search-suggestions"
          >
            {isLoadingSuggestions ? (
              <div className="suggestion-item loading">Aranıyor...</div>
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



