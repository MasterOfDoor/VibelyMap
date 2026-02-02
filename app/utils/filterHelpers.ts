// Filter helper functions

export const CATEGORY_SEARCH_TERMS: { [key: string]: string } = {
  Cafe: "cafe coffee espresso kahve",
  Restaurant: "restaurant lokanta kebap kebab",
  Bar: "bar pub cocktail wine",
};

export const GOOGLE_TYPE_MAP: { [key: string]: string } = {
  Cafe: "cafe",
  Restaurant: "restaurant",
  Bar: "bar",
};

export interface FilterState {
  main: string[];
  sub: {
    [key: string]: string[];
  };
}

export function buildQueryFromFilters(main: string[], sub: { [key: string]: string[] }): string {
  // Only category will be queried to Google Places
  // Other filters (lighting, price, ambiance etc.) will come from AI analysis
  const terms = new Set<string>();
  
  // Add only category filters
  const categoryOptions = sub.Category || [];
  categoryOptions.forEach((cat) => {
    if (cat === "Cafe") {
      terms.add("cafe");
    } else if (cat === "Restaurant") {
      terms.add("restaurant");
    } else if (cat === "Bar") {
      terms.add("bar");
    } else {
      // Fallback: convert category name to lowercase
      terms.add(cat.toLowerCase());
    }
  });
  
  // If multiple categories, use only the first one (better for Google API)
  const queryArray = Array.from(terms).filter(Boolean);
  return queryArray.length > 0 ? queryArray[0] : "";
}
