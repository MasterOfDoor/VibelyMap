"use client";

import { log } from "./logger";

/**
 * ⚠️ UYARI: Bu dosya bir kere çalıştırıldıktan sonra otomatik olarak silinecektir.
 * Migration için: POST /api/migrate/tags endpoint'ini çağırın.
 * 
 * Bu utility fonksiyonları tag migration için kullanılır.
 * Migration tamamlandıktan sonra bu dosya silinir.
 */

/**
 * Eski tag formatlarını yeni formata dönüştürür
 * Örnek: "Masada priz" -> "Masada priz" (aynı kalır, ama artık 4 değeri ile gelir)
 */
export function migrateOldTagsToNewFormat(tags: string[]): string[] {
  const migratedTags: string[] = [];
  const seenTags = new Set<string>();

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase().trim();
    
    // Eski "Masada priz" tag'ini koru (yeni format ile uyumlu)
    if (lowerTag === "masada priz" || lowerTag === "masada_priz") {
      if (!seenTags.has("Masada priz")) {
        migratedTags.push("Masada priz");
        seenTags.add("Masada priz");
      }
      continue;
    }

    // Diğer tag'leri olduğu gibi ekle
    if (!seenTags.has(tag)) {
      migratedTags.push(tag);
      seenTags.add(tag);
    }
  }

  return migratedTags;
}

/**
 * Place objesindeki tag'leri temizler ve yeni formata dönüştürür
 */
export function cleanPlaceTags(place: { tags?: string[] }): string[] {
  if (!place.tags || place.tags.length === 0) {
    return [];
  }

  const cleanedTags = migrateOldTagsToNewFormat(place.tags);
  
  log.analysis("Tags cleaned and migrated", {
    action: "tag_cleanup",
    originalCount: place.tags.length,
    cleanedCount: cleanedTags.length,
    originalTags: place.tags,
    cleanedTags: cleanedTags,
  });

  return cleanedTags;
}

/**
 * Birden fazla place için tag temizleme
 */
export function cleanPlacesTags(places: Array<{ tags?: string[] }>): void {
  places.forEach((place, index) => {
    if (place.tags) {
      place.tags = cleanPlaceTags(place);
    }
  });

  log.analysis("Batch tag cleanup completed", {
    action: "batch_tag_cleanup",
    placesCount: places.length,
  });
}

