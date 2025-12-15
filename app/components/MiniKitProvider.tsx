"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
import { useState } from "react";

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  // QueryClient oluştur (her render'da yeni instance oluşturmamak için)
  const [queryClient] = useState(() => new QueryClient());

  // Wagmi config - Base chain için
  // Base App içinde açıldığında Base Account otomatik olarak bağlanır
  const [config] = useState(() =>
    createConfig({
      chains: [base],
      connectors: [
        coinbaseWallet({
          appName: "Harita Uygulamasi",
          appLogoUrl: typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "",
        }),
      ],
      transports: {
        [base.id]: http(),
      },
    })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

