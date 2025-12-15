"use client";

import { useState, useEffect } from "react";

interface MiniKitSDK {
  ready?: () => void;
  [key: string]: any;
}

interface UseMiniKitReturn {
  isReady: boolean;
  miniKit: MiniKitSDK | null;
  coinbaseSDK: MiniKitSDK | null;
  ready: () => void;
}

/**
 * Base App SDK (MiniKit) için hook
 * Base Mini App içinde çalışırken SDK'ya erişim sağlar
 */
export function useMiniKit(): UseMiniKitReturn {
  const [isReady, setIsReady] = useState(false);
  const [miniKit, setMiniKit] = useState<MiniKitSDK | null>(null);
  const [coinbaseSDK, setCoinbaseSDK] = useState<MiniKitSDK | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // SDK'ları kontrol et
    const checkSDK = () => {
      const miniKitSDK = (window as any).miniKit;
      const coinbaseSDKInstance = (window as any).coinbaseSDK;

      if (miniKitSDK || coinbaseSDKInstance) {
        setMiniKit(miniKitSDK || null);
        setCoinbaseSDK(coinbaseSDKInstance || null);
        setIsReady(true);
        return true;
      }
      return false;
    };

    // İlk kontrol
    if (checkSDK()) {
      return;
    }

    // SDK henüz yüklenmemişse, yüklenmesini bekle
    const checkInterval = setInterval(() => {
      if (checkSDK()) {
        clearInterval(checkInterval);
      }
    }, 100);

    // 5 saniye sonra timeout
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!isReady) {
        console.warn("Base Mini App SDK bulunamadı. Uygulama Base App dışında çalışıyor olabilir.");
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  const ready = () => {
    if (typeof window === "undefined") return;

    // Base Mini App SDK ready callback
    if ((window as any).miniKit) {
      (window as any).miniKit.ready?.();
    }

    // Alternative: Coinbase SDK ready callback
    if ((window as any).coinbaseSDK) {
      (window as any).coinbaseSDK.ready?.();
    }

    // Fallback: Dispatch ready event
    window.dispatchEvent(new Event("minikit:ready"));
  };

  return {
    isReady,
    miniKit,
    coinbaseSDK,
    ready,
  };
}
