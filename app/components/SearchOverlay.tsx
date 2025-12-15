"use client";

import { useState, useRef, useEffect } from "react";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  searchMode?: "map" | "event";
}

export default function SearchOverlay({
  isOpen,
  onClose,
  onSearch,
  searchMode = "map",
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = () => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return;
    onSearch(trimmedQuery);
    setQuery("");
    setSuggestions([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          id="placeSearchBtn"
          className="pill secondary"
          onClick={handleSearch}
        >
          Ara
        </button>
        {suggestions.length > 0 && (
          <div id="searchSuggestions" className="search-suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-item"
                onClick={() => {
                  setQuery(suggestion);
                  setSuggestions([]);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



