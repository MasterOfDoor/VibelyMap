import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import "./globals.css";
import "../style.css";
import "./utils/suppressConsoleErrors";
import { RootProvider } from "./rootProvider";

const inter = Inter({ subsets: ["latin"] });




export const metadata: Metadata = {
  other: {
    "base:app_id": "69407ee4d77c069a945bdf34",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#d4a657",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d4a657'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-size='28' fill='white' font-family='Inter,Arial' font-weight='700'%3EH%3C/text%3E%3C/svg%3E"
        />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <RootProvider>
          {children}
        </RootProvider>
        {/* Load vanilla JS modules - script.js must load first */}
        <script src="/script.js" defer></script>
        <script src="/filtreleme.js" defer></script>
        <script src="/etkinlikler.js" defer></script>
      </body>
    </html>
  );
}

