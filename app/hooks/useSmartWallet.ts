"use client";

import { useAccount, useConnect } from "wagmi";

/**
 * Smart Wallet bağlantısı ve durumu için hook
 * Base Account connector ile Mini App'lerde otomatik bağlanır, login butonu gerekmez
 */
export function useSmartWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();

  return {
    address,
    isConnected,
    isConnecting,
    connect, // Manuel bağlantı için (genellikle gerekmez, Base Account otomatik bağlanır)
  };
}

