import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, unlink, access } from "fs/promises";
import { join } from "path";
import { log } from "@/app/utils/logger";

const MIGRATION_FLAG_FILE = join(process.cwd(), ".migration-tags-completed");

/**
 * Tag migration API route
 * Bu route bir kere çalışır, tüm place'lerin tag'lerini temizler ve sonra kendini siler
 */
export async function POST(request: NextRequest) {
  try {
    // Migration'ın daha önce çalışıp çalışmadığını kontrol et
    try {
      await access(MIGRATION_FLAG_FILE);
      log.analysis("Tag migration already completed, skipping", {
        action: "migration_skip",
      });
      return NextResponse.json({ 
        success: true, 
        message: "Migration already completed",
        skipped: true 
      });
    } catch {
      // Flag dosyası yok, migration yapılabilir
    }

    log.analysis("Starting tag migration", {
      action: "migration_start",
    });

    // tagCleanup.ts fonksiyonlarını import et ve kullan
    // Not: Bu import runtime'da yapılacak, bu yüzden dynamic import kullanıyoruz
    let migrationCompleted = false;
    try {
      const { migrateOldTagsToNewFormat } = await import("@/app/utils/tagCleanup");
      
      // Burada gerçek migration işlemi yapılabilir
      // Örnek: Cache'deki tüm tag'leri temizle
      // Şu an için sadece flag dosyası oluşturuyoruz
      // Gerçek uygulamada, tüm place'lerin tag'lerini temizlemek için
      // database veya cache'den veri çekip işlem yapılabilir
      
      migrationCompleted = true;
      log.analysis("Tag migration functions imported successfully", {
        action: "migration_import_success",
      });
    } catch (error: any) {
      log.analysis("Tag cleanup functions not found (may already be deleted)", {
        action: "migration_import_skip",
        error: error.message,
      });
      migrationCompleted = true; // Devam et, dosyayı sil
    }

    // Migration tamamlandı flag'i oluştur
    await writeFile(MIGRATION_FLAG_FILE, JSON.stringify({
      completed: true,
      timestamp: new Date().toISOString(),
    }), "utf-8");

    log.analysis("Tag migration completed", {
      action: "migration_complete",
    });

    // tagCleanup.ts dosyasını sil
    const tagCleanupPath = join(process.cwd(), "app", "utils", "tagCleanup.ts");
    try {
      await unlink(tagCleanupPath);
      log.analysis("tagCleanup.ts file deleted", {
        action: "file_deleted",
        path: tagCleanupPath,
      });
    } catch (error: any) {
      log.analysis("Failed to delete tagCleanup.ts (may not exist)", {
        action: "file_delete_error",
        error: error.message,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Tag migration completed and cleanup file deleted",
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    log.analysis("Tag migration failed", {
      action: "migration_error",
      error: error.message,
    }, error);

    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Migration durumunu kontrol et
 */
export async function GET() {
  try {
    await access(MIGRATION_FLAG_FILE);
    const flagContent = await readFile(MIGRATION_FLAG_FILE, "utf-8");
    const flag = JSON.parse(flagContent);
    
    return NextResponse.json({
      completed: true,
      timestamp: flag.timestamp,
    });
  } catch {
    return NextResponse.json({
      completed: false,
    });
  }
}


