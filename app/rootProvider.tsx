"use client";
import { ReactNode } from "react";
import { base } from "wagmi/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";

export function RootProvider({ children }: { children: ReactNode }) {
  // API key yoksa bile çalışması için fallback
  const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || "";

  return (
    <OnchainKitProvider
      apiKey={apiKey}
      chain={base}
      config={{
        appearance: {
          mode: "auto",
        },
        wallet: {
          display: "modal",
          preference: "all", // Base Mini App içinde Base Account otomatik önceliklendirilir
        },
      }}
      miniKit={{
        enabled: true,
        autoConnect: false, // Kullanıcı wallet seçimini yapsın
        notificationProxyUrl: undefined,
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}