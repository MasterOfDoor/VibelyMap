"use client";

import { useAccount } from "wagmi";

/**
 * Smart Wallet bağlantısı ve durumu için hook
 * Base Account (Smart Wallet) otomatik olarak Base Mini App içinde bağlanır
 * OnchainKitProvider tarafından yönetilir
 */
export function useSmartWallet() {
  const { address, isConnected, isConnecting } = useAccount();

  return {
    address,
    isConnected,
    isConnecting,
    // connect fonksiyonu kaldırıldı - Base Account otomatik bağlanır
  };
}

