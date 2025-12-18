"use client";

import { useState, useEffect, useCallback } from "react";
import { log } from "../utils/logger";

export interface UserProfile {
  address: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function useUserProfile(address: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/profile?address=${address}`);
      if (!response.ok) throw new Error("Profil yüklenemedi");
      const data = await response.json();
      setProfile(data.profile);
    } catch (err: any) {
      log.error("Profil fetch hatası", { address }, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateUsername = async (username: string) => {
    if (!address) return { success: false, error: "Bağlantı yok" };

    setIsLoading(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, username }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Güncelleme başarısız");

      setProfile(data.profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    profile,
    isLoading,
    error,
    updateUsername,
    refreshProfile: fetchProfile,
  };
}

