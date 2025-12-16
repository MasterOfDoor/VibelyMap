"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface TopBarProps {
  onMenuToggle: () => void;
  onSearchClick: () => void;
  onLocationClick: () => void;
  onProfileClick: () => void;
  onEventsClick: () => void;
}

// localStorage'dan profil fotoğrafını yükle (ProfilePanel ile aynı key kullan)
function loadProfileAvatar(address: string | undefined): string | null {
  if (!address) return null;
  try {
    // Önce yeni key'i dene (profile_avatar_url_)
    const stored = localStorage.getItem(`profile_avatar_url_${address.toLowerCase()}`);
    if (stored) return stored;
    // Eski key'i de kontrol et (backward compatibility)
    const oldStored = localStorage.getItem(`profile_avatar_${address.toLowerCase()}`);
    return oldStored;
  } catch {
    return null;
  }
}

// Avatar'ı uygula
function applyAvatarToElement(element: HTMLElement | null, avatarDataUrl: string | null): void {
  if (!element) return;
  
  if (avatarDataUrl) {
    element.style.backgroundImage = `url(${avatarDataUrl})`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.textContent = "";
    element.classList.add("with-photo");
  } else {
    element.style.backgroundImage = "";
    element.style.backgroundSize = "";
    element.style.backgroundPosition = "";
    element.classList.remove("with-photo");
  }
}

export default function TopBar({
  onMenuToggle,
  onSearchClick,
  onLocationClick,
  onProfileClick,
  onEventsClick,
}: TopBarProps) {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  // Client-side hydration için
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Avatar'ı yükle ve güncelle
  useEffect(() => {
    if (isMounted && isConnected && address) {
      const savedAvatar = loadProfileAvatar(address);
      const avatarElement = document.querySelector("#profileButton .avatar") as HTMLElement;
      if (avatarElement) {
        applyAvatarToElement(avatarElement, savedAvatar);
      }
    }
  }, [isMounted, isConnected, address]);

  return (
    <div className="top-bar">
      <div className="brand-group">
        <button
          id="menuToggle"
          className="hamburger"
          onClick={onMenuToggle}
          aria-label="Filtreleri aç/kapat"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <button
          id="openSearch"
          className="icon-btn search-icon"
          onClick={onSearchClick}
          aria-label="Mekan ara"
        >
          🔍
        </button>
        <div className="brand">
          <h1>Yakın mekanlar</h1>
        </div>
      </div>
      <div className="actions">
        <button
          id="notificationButton"
          className="icon-btn bell"
          aria-label="Bildirimler"
        >
          🔔
          <span id="notificationDot" className="notif-dot hidden" aria-hidden="true"></span>
        </button>
        <button
          id="btnKonum"
          className="pill primary"
          onClick={() => {
            if ((window as any).handleMapLocation) {
              (window as any).handleMapLocation();
            }
            onLocationClick();
          }}
        >
          Konumumu Göster
        </button>
        <button
          id="openEventPanel"
          className="pill secondary"
          onClick={onEventsClick}
          disabled
          style={{ opacity: 0.5, cursor: "not-allowed" }}
          title="Etkinlikler özelliği yakında gelecek"
        >
          Etkinlikler
        </button>
        <button
          id="profileButton"
          className="icon-pill"
          onClick={onProfileClick}
          aria-label="Profil"
        >
          <span className="avatar">
            {isMounted && isConnected && address
              ? address.slice(2, 4).toUpperCase()
              : "P"}
          </span>
          <span className="profile-label">Profil</span>
        </button>
      </div>
    </div>
  );
}


