"use client";

import { useAccount } from "wagmi";
import { useEffect, useRef, useState } from "react";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// localStorage'dan profil fotoğrafı URL'ini yükle
function loadProfileAvatar(address: string | undefined): string | null {
  if (!address) return null;
  try {
    const stored = localStorage.getItem(`profile_avatar_url_${address.toLowerCase()}`);
    return stored;
  } catch {
    return null;
  }
}

// localStorage'a profil fotoğrafı URL'ini kaydet
function saveProfileAvatarUrl(address: string | undefined, avatarUrl: string): void {
  if (!address) return;
  try {
    localStorage.setItem(`profile_avatar_url_${address.toLowerCase()}`, avatarUrl);
  } catch (error) {
    console.error("[ProfilePanel] Avatar URL kaydedilemedi:", error);
  }
}

// Fotoğrafı server'a upload et (Cloudinary veya fallback)
async function uploadAvatar(file: File, address: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("address", address);

  const response = await fetch("/api/upload/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Upload failed");
  }

  const data = await response.json();
  return data.url;
}

// Avatar'ı uygula (hem ProfilePanel hem de TopBar için)
function applyAvatar(elementId: string, avatarDataUrl: string | null): void {
  const element = document.getElementById(elementId);
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

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarUploadBtnRef = useRef<HTMLButtonElement>(null);

  // Client-side hydration için
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sayfa yüklendiğinde kaydedilmiş avatar'ı yükle
  useEffect(() => {
    if (isMounted && isConnected && address) {
      const savedAvatar = loadProfileAvatar(address);
      if (savedAvatar) {
        applyAvatar("profileAvatarLarge", savedAvatar);
        // TopBar'daki profil avatar'ını da güncelle
        const topBarAvatar = document.querySelector("#profileButton .avatar") as HTMLElement;
        if (topBarAvatar) {
          topBarAvatar.style.backgroundImage = `url(${savedAvatar})`;
          topBarAvatar.style.backgroundSize = "cover";
          topBarAvatar.style.backgroundPosition = "center";
          topBarAvatar.textContent = "";
          topBarAvatar.classList.add("with-photo");
        }
      }
    }
  }, [isMounted, isConnected, address]);

  useEffect(() => {
    if (!isOpen) return;

    const handleAvatarUpload = () => {
      avatarInputRef.current?.click();
    };

    const handleFileChange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && address) {
        // Dosya boyutu kontrolü (maksimum 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert("Fotoğraf boyutu çok büyük. Maksimum 5MB olmalıdır.");
          return;
        }

        try {
          // Yükleme başladı mesajı
          const avatarElement = document.getElementById("profileAvatarLarge");
          if (avatarElement) {
            avatarElement.textContent = "Yükleniyor...";
          }

          // Server'a upload et (Cloudinary veya fallback)
          const imageUrl = await uploadAvatar(file, address);
          
          // URL'i localStorage'a kaydet
          saveProfileAvatarUrl(address, imageUrl);
          
          // ProfilePanel'deki avatar'ı güncelle
          applyAvatar("profileAvatarLarge", imageUrl);
          
          // TopBar'daki profil avatar'ını da güncelle
          const topBarAvatar = document.querySelector("#profileButton .avatar") as HTMLElement;
          if (topBarAvatar) {
            topBarAvatar.style.backgroundImage = `url(${imageUrl})`;
            topBarAvatar.style.backgroundSize = "cover";
            topBarAvatar.style.backgroundPosition = "center";
            topBarAvatar.textContent = "";
            topBarAvatar.classList.add("with-photo");
          }
          
          // Başarı mesajı göster
          try {
            if (typeof window !== "undefined" && typeof (window as any).showToast === "function") {
              (window as any).showToast("Profil fotoğrafı güncellendi");
            } else {
              console.log("Profil fotoğrafı güncellendi");
            }
          } catch (error) {
            console.log("Profil fotoğrafı güncellendi");
          }
        } catch (error: any) {
          console.error("[ProfilePanel] Upload hatası:", error);
          alert(`Fotoğraf yüklenirken bir hata oluştu: ${error.message || "Bilinmeyen hata"}`);
          
          // Hata durumunda avatar'ı sıfırla
          const avatarElement = document.getElementById("profileAvatarLarge");
          if (avatarElement && address) {
            avatarElement.textContent = address.slice(2, 4).toUpperCase();
            avatarElement.style.backgroundImage = "";
          }
        }
      } else if (!address) {
        alert("Fotoğraf yüklemek için önce cüzdanınıza bağlanmalısınız.");
      }
    };

    const uploadBtn = avatarUploadBtnRef.current;
    const fileInput = avatarInputRef.current;

    if (uploadBtn) {
      uploadBtn.addEventListener("click", handleAvatarUpload);
    }
    if (fileInput) {
      fileInput.addEventListener("change", handleFileChange);
    }

    return () => {
      if (uploadBtn) {
        uploadBtn.removeEventListener("click", handleAvatarUpload);
      }
      if (fileInput) {
        fileInput.removeEventListener("change", handleFileChange);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <section id="profilePanel" className="panel profile visible">
      <div className="profile-hero">
        <div className="hero-avatar-wrap">
          <div className="hero-avatar" id="profileAvatarLarge" tabIndex={0}>
            {isMounted && isConnected && address
              ? address.slice(2, 4).toUpperCase()
              : "P"}
          </div>
          <button 
            type="button" 
            id="avatarUploadBtn" 
            ref={avatarUploadBtnRef}
            className="avatar-upload-btn"
          >
            Foto ekle
          </button>
          <input
            type="file"
            id="avatarInput"
            ref={avatarInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>
        <div className="hero-main">
          <div className="hero-top">
            <div>
              <p className="eyebrow">Hesabım</p>
              <h2 id="profileUsername">
                {isMounted && isConnected && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "Giriş yap"}
              </h2>
              <p id="profileEmail" className="muted-text tiny">
                {isMounted && isConnected ? "@wallet" : "@kullanici"}
              </p>
            </div>
            <div className="hero-actions">
              <button id="openSettings" className="pill secondary">
                Ayarlar
              </button>
              {isMounted && isConnected && (
                <button id="signOut" className="pill ghost">
                  Çıkış yap
                </button>
              )}
              <button
                id="closeProfile"
                className="icon-btn hide-close"
                onClick={onClose}
                aria-label="Profili kapat"
              >
                &times;
              </button>
            </div>
          </div>
          <div className="profile-stats">
            <button type="button" id="btnFollowing" className="stat linkish">
              <strong id="followingCount">0</strong>
              <span>Gurmelerim</span>
            </button>
            <button type="button" id="btnFollowers" className="stat linkish">
              <strong id="followerCount">0</strong>
              <span>Müdavimlerim</span>
            </button>
            <div className="stat review-centered">
              <strong id="reviewCount">0</strong>
              <span>Gurmenin yorumları</span>
            </div>
          </div>
          <p id="authState" className="muted-text bio-line">
            {isMounted && isConnected
              ? "Base Wallet ile bağlısınız"
              : "Giriş yapmadınız."}
          </p>
        </div>
      </div>

      <div id="settingsPanel" className="settings-panel hidden">
        <div className="settings-row">
          <div>
            <p className="eyebrow">Hesap durumu</p>
            <p className="muted-text tiny">
              Açık: herkes ekleyebilir. Kapalı: izin gerekir.
            </p>
          </div>
          <label className="switch">
            <input type="checkbox" id="accountPrivacy" />
            <span className="slider"></span>
            <span className="switch-label" data-on="Açık" data-off="Kapalı"></span>
          </label>
        </div>
      </div>

      <div className="friends">
        <div className="friends-header">
          <div>
            <h3>Gurme ekle</h3>
            <p className="muted-text tiny friends-subtext">
              Kullanıcı adı veya e-posta ile ekle.
            </p>
          </div>
        </div>
        <form id="addFriendForm" className="friend-form">
          <input
            type="text"
            id="friendIdentifier"
            placeholder="Kullanıcı veya mail ara"
            required
          />
          <div id="friendSuggestions" className="connection-suggestions hidden"></div>
          <button type="submit" className="pill secondary full">
            Gurme ekle
          </button>
        </form>
      </div>

      <div id="connectionsSection" className="connections hidden">
        <div className="connections-header">
          <div>
            <h4 id="connectionsTitle">Bağlantılar</h4>
            <p className="muted-text tiny" id="connectionsSubtitle">
              Gurme listesi
            </p>
          </div>
          <div className="connections-actions">
            <button
              id="openConnectionSearch"
              className="icon-btn search-icon"
              aria-label="Kullanıcı ara"
            >
              🔍
            </button>
            <button
              id="closeConnections"
              className="icon-btn"
              aria-label="Kapat"
            >
              &times;
            </button>
          </div>
        </div>
        <div id="connectionSearchBox" className="connection-search hidden">
          <input
            id="connectionSearchInput"
            type="text"
            placeholder="kullanıcı adı ara"
          />
          <div
            id="connectionSuggestions"
            className="connection-suggestions hidden"
          ></div>
        </div>
        <div id="connectionsList" className="chip-list empty">
          Boş.
        </div>
      </div>

      <div className="profile-reviews">
        <div className="reviews-header">
          <h3>Gurmenin yorumları</h3>
          <p className="muted-text tiny">En yeni yorumların altta.</p>
        </div>
        <div id="myReviews" className="review-gallery empty">
          Yorum yok.
        </div>
      </div>
    </section>
  );
}


