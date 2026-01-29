"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useProfileAvatar } from "../hooks/useProfileAvatar";

interface TopBarProps {
  onMenuToggle: () => void;
  onSearchClick: () => void;
  onLocationClick: () => void;
  onProfileClick: () => void;
  onEventsClick: () => void;
  /** Filtre, arama veya profil paneli açıkken top bar sabit kalır (hover ile gizlenmez). */
  anyPanelOpen?: boolean;
}

export default function TopBar({
  onMenuToggle,
  onSearchClick,
  onLocationClick,
  onProfileClick,
  onEventsClick,
  anyPanelOpen = false,
}: TopBarProps) {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isVisible = isHovered || anyPanelOpen;
  
  // Cloudinary avatar hook
  const { avatarUrl } = useProfileAvatar(address);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Client-side hydration için
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Avatar'ı uygula
  useEffect(() => {
    if (isMounted && isConnected && address) {
      const avatarElement = document.querySelector("#profileButton .avatar") as HTMLElement;
      if (avatarElement) {
        if (avatarUrl) {
          avatarElement.style.backgroundImage = `url(${avatarUrl})`;
          avatarElement.style.backgroundSize = "cover";
          avatarElement.style.backgroundPosition = "center";
          avatarElement.textContent = "";
          avatarElement.classList.add("with-photo");
        } else {
          avatarElement.style.backgroundImage = "";
          avatarElement.style.backgroundSize = "";
          avatarElement.style.backgroundPosition = "";
          avatarElement.classList.remove("with-photo");
        }
      }
    }
  }, [isMounted, isConnected, address, avatarUrl]);

  return (
    <div
      className="top-bar-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Üst menü hover alanı"
    >
      <div
        className={`top-bar ${isVisible ? "top-bar--visible" : "top-bar--hidden"}`}
        aria-hidden={!isVisible}
      >
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
    </div>
  );
}


