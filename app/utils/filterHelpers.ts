// Filtreleme helper fonksiyonları (eski script.js'den)

export const CATEGORY_SEARCH_TERMS: { [key: string]: string } = {
  Kafe: "cafe coffee espresso kahve",
  Restoran: "restaurant lokanta kebap kebab",
  Bar: "bar pub cocktail wine",
};

export const GOOGLE_TYPE_MAP: { [key: string]: string } = {
  Kafe: "cafe",
  Restoran: "restaurant",
  Bar: "bar",
};

export interface FilterState {
  main: string[];
  sub: {
    [key: string]: string[];
  };
}

export function buildQueryFromFilters(main: string[], sub: { [key: string]: string[] }): string {
  // Google Places'e sadece kategori sorulacak
  // Diğer filtreler (ışıklandırma, fiyat, ambiyans vb.) AI analiziyle gelecek
  // Query'yi kısa tutmak için sadece kategori isimlerini kullanıyoruz
  const terms = new Set<string>();
  
  // Sadece kategori filtrelerini ekle - sadece kategori ismini kullan (uzun search terms yerine)
  const kategoriOptions = sub.Kategori || [];
  kategoriOptions.forEach((cat) => {
    // Sadece kategori ismini kullan, uzun search terms yerine
    // Google Places API daha iyi sonuç veriyor
    if (cat === "Kafe") {
      terms.add("cafe");
    } else if (cat === "Restoran") {
      terms.add("restaurant");
    } else if (cat === "Bar") {
      terms.add("bar");
    } else {
      // Fallback: kategori ismini küçük harfe çevir
      terms.add(cat.toLowerCase());
    }
  });
  
  // Birden fazla kategori varsa, sadece ilkini kullan (Google API için daha iyi)
  const queryArray = Array.from(terms).filter(Boolean);
  return queryArray.length > 0 ? queryArray[0] : "";
}


