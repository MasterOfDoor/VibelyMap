"use client";

import { useState, useEffect, useCallback } from "react";

const CACHE_KEY_PREFIX = "profile_avatar:";
const CACHE_TTL = 86400 * 30; // 30 days

/**
 * Generate avatar URL from wallet address (fallback)
 */
function generateAvatarFromAddress(address: string): string {
  // Use a simple hash-based avatar generation
  // In production, you might use a service like DiceBear or UI Avatars
  const hash = address.slice(2, 10);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${hash}`;
}

/**
 * Load avatar URL from cache (localStorage first, then Redis if available)
 */
async function loadAvatarFromCache(address: string): Promise<string | null> {
  const normalizedAddress = address.toLowerCase();
  
  // Try localStorage first (faster)
  try {
    const localCached = localStorage.getItem(`${CACHE_KEY_PREFIX}${normalizedAddress}`);
    if (localCached) {
      return localCached;
    }
  } catch (error) {
    console.warn("[useProfileAvatar] localStorage read error:", error);
  }

  // Try API endpoint for Redis cache (client-side)
  try {
    const response = await fetch(`/api/profile/avatar?address=${encodeURIComponent(normalizedAddress)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        // Cache in localStorage for faster access
        try {
          localStorage.setItem(`${CACHE_KEY_PREFIX}${normalizedAddress}`, data.url);
        } catch {}
        return data.url;
      }
    }
  } catch (error) {
    console.warn("[useProfileAvatar] API cache read error:", error);
  }

  return null;
}

/**
 * Save avatar URL to cache
 */
async function saveAvatarToCache(address: string, url: string): Promise<void> {
  const normalizedAddress = address.toLowerCase();

  // Save to localStorage
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${normalizedAddress}`, url);
  } catch (error) {
    console.warn("[useProfileAvatar] localStorage write error:", error);
  }

  // Save to Redis if available (via API endpoint)
  try {
    await fetch("/api/profile/avatar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: normalizedAddress,
        url,
      }),
    });
  } catch (error) {
    console.warn("[useProfileAvatar] Failed to save to Redis:", error);
  }
}

/**
 * Custom hook for managing profile avatar
 */
export function useProfileAvatar(address: string | undefined) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load avatar on mount and when address changes
  useEffect(() => {
    if (!address) {
      setAvatarUrl(null);
      setIsLoading(false);
      return;
    }

    const loadAvatar = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to load from cache
        const cachedUrl = await loadAvatarFromCache(address);
        if (cachedUrl) {
          setAvatarUrl(cachedUrl);
          setIsLoading(false);
          return;
        }

        // Fallback to generated avatar
        const generatedUrl = generateAvatarFromAddress(address);
        setAvatarUrl(generatedUrl);
      } catch (err: any) {
        console.error("[useProfileAvatar] Load error:", err);
        setError(err.message);
        // Still show generated avatar on error
        setAvatarUrl(generateAvatarFromAddress(address));
      } finally {
        setIsLoading(false);
      }
    };

    loadAvatar();
  }, [address]);

  /**
   * Upload new avatar
   */
  const uploadAvatar = useCallback(
    async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "Wallet address required" };
      }

      setIsLoading(true);
      setError(null);

      try {
        // Validate file
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error("Invalid file type. Only JPG, PNG, and WebP are allowed.");
        }

        if (file.size > MAX_SIZE) {
          throw new Error(`File too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB`);
        }

        // Upload to Cloudinary
        const formData = new FormData();
        formData.append("file", file);
        formData.append("address", address);

        const response = await fetch("/api/upload/avatar", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const data = await response.json();

        // Save to cache
        await saveAvatarToCache(address, data.url);

        // Update state
        setAvatarUrl(data.url);

        return { success: true, url: data.url };
      } catch (err: any) {
        const errorMessage = err.message || "Upload failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [address]
  );

  return {
    avatarUrl,
    isLoading,
    error,
    uploadAvatar,
    // Fallback URL generator
    generateFallback: address ? generateAvatarFromAddress(address) : null,
  };
}
