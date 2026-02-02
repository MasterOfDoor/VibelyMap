"use client";

import { useAccount } from "wagmi";
import { useEffect, useRef, useState } from "react";
import { useProfileAvatar } from "../hooks/useProfileAvatar";
import { useUserProfile } from "../hooks/useUserProfile";
import { useUserReviews } from "../hooks/useUserReviews";
import { useTheme } from "../contexts/ThemeContext";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarUploadBtnRef = useRef<HTMLButtonElement>(null);
  
  // Cloudinary avatar hook
  const { avatarUrl, isLoading: isAvatarLoading, uploadAvatar } = useProfileAvatar(address);
  
  // User profile hook (username)
  const { profile, isLoading: isProfileLoading } = useUserProfile(address);
  
  // User reviews hook
  const { reviews: userReviews, reviewCount, isLoading: isReviewsLoading } = useUserReviews(address);
  
  // Theme hook
  const { theme, toggleTheme, isDark } = useTheme();

  const isLoading = isAvatarLoading || isProfileLoading;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Arama fonksiyonu
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/profile/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("Arama hatası:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Arkadaş ekleme (şimdilik sadece UI/Log)
  const handleAddFriend = async (friendAddress: string) => {
    console.log("Adding friend:", friendAddress);
    alert(`Friend added (coming soon): ${friendAddress}`);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Client-side hydration için
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleAvatarUpload = () => {
      avatarInputRef.current?.click();
    };

    const handleFileChange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && address) {
        setUploadError(null);
        setUploadProgress(0);

        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const avatarElement = document.getElementById("profileAvatarLarge");
          if (avatarElement) {
            avatarElement.style.backgroundImage = `url(${result})`;
            avatarElement.style.backgroundSize = "cover";
            avatarElement.style.backgroundPosition = "center";
            avatarElement.textContent = "";
            avatarElement.classList.add("with-photo");
          }
        };
        reader.readAsDataURL(file);

        // Upload to Cloudinary
        setUploadProgress(30);
        try {
          const result = await uploadAvatar(file);
          setUploadProgress(100);
          
          if (result.success && result.url) {
            // Avatar will be updated automatically via hook
            // Reset input
            if (target) {
              target.value = "";
            }
            // Show success briefly
            setTimeout(() => setUploadProgress(0), 2000);
          } else {
            setUploadError(result.error || "Upload failed");
            setUploadProgress(0);
          }
        } catch (error: any) {
          setUploadError(error.message || "Upload failed");
          setUploadProgress(0);
        }
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
          <div 
            className="hero-avatar" 
            id="profileAvatarLarge" 
            tabIndex={0}
            style={{
              backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
              backgroundSize: avatarUrl ? "cover" : undefined,
              backgroundPosition: avatarUrl ? "center" : undefined,
            }}
          >
            {!avatarUrl && (isMounted && isConnected && profile?.username
              ? profile.username.slice(0, 2).toUpperCase()
              : isMounted && isConnected && address
              ? address.slice(2, 4).toUpperCase()
              : "P")}
            {isLoading && !avatarUrl && (
              <span className="avatar-loading">⏳</span>
            )}
          </div>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              <span className="progress-text">{uploadProgress}%</span>
            </div>
          )}
          {uploadError && (
            <div className="upload-error" role="alert">
              {uploadError}
            </div>
          )}
          <button 
            type="button" 
            id="avatarUploadBtn" 
            ref={avatarUploadBtnRef}
            className="avatar-upload-btn"
            disabled={isLoading || uploadProgress > 0}
          >
            {uploadProgress > 0 ? "Uploading..." : "Add photo"}
          </button>
          <input
            type="file"
            id="avatarInput"
            ref={avatarInputRef}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
        </div>
        <div className="hero-main">
          <div className="hero-top">
            <div>
              <p className="eyebrow">My Account</p>
              <h2 id="profileUsername">
                {isMounted && isConnected && profile?.username
                  ? `@${profile.username}`
                  : isMounted && isConnected && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "Sign in"}
              </h2>
              <p id="profileEmail" className="muted-text tiny">
                {isMounted && isConnected && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "@username"}
              </p>
            </div>
            <div className="hero-actions">
              <button id="openSettings" className="pill secondary">
                Settings
              </button>
              {isMounted && isConnected && (
                <>
                  <button
                    id="darkModeToggle"
                    className="pill ghost dark-mode-toggle"
                    onClick={toggleTheme}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    title={isDark ? "Light mode" : "Dark mode"}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="dark-mode-icon"
                    >
                      {isDark ? (
                        // Sun icon (light mode) - Google Maps style
                        <>
                          <circle
                            cx="12"
                            cy="12"
                            r="5"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                          />
                          <path
                            d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </>
                      ) : (
                        // Moon icon (dark mode) - Google Maps style
                        <path
                          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      )}
                    </svg>
                  </button>
                  <button id="signOut" className="pill ghost">
                    Sign out
                  </button>
                </>
              )}
              <button
                id="closeProfile"
                className="icon-btn hide-close"
                onClick={onClose}
                aria-label="Close profile"
              >
                &times;
              </button>
            </div>
          </div>
          <div className="profile-stats">
            <button type="button" id="btnFollowing" className="stat linkish">
              <strong id="followingCount">0</strong>
              <span>Following</span>
            </button>
            <button type="button" id="btnFollowers" className="stat linkish">
              <strong id="followerCount">0</strong>
              <span>Followers</span>
            </button>
            <div className="stat review-centered">
              <strong id="reviewCount">{reviewCount}</strong>
              <span>Reviews</span>
            </div>
          </div>
          <p id="authState" className="muted-text bio-line">
            {isMounted && isConnected
              ? "Connected with Base Wallet"
              : "Not signed in."}
          </p>
        </div>
      </div>

      <div id="settingsPanel" className="settings-panel hidden">
        <div className="settings-row">
          <div>
            <p className="eyebrow">Account status</p>
            <p className="muted-text tiny">
              Public: anyone can add. Private: permission required.
            </p>
          </div>
          <label className="switch">
            <input type="checkbox" id="accountPrivacy" />
            <span className="slider"></span>
            <span className="switch-label" data-on="Public" data-off="Private"></span>
          </label>
        </div>
      </div>

      <div className="friends">
        <div className="friends-header">
          <div>
            <h3>Add Friend</h3>
            <p className="muted-text tiny friends-subtext">
              Add by username or wallet address.
            </p>
          </div>
        </div>
        <div className="friend-form">
          <div className="relative">
          <input
            type="text"
            id="friendIdentifier"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Arama tetikleyici (debounced olmalı ama şimdilik her değişimde)
                if (e.target.value.length >= 2) {
                  handleSearch(e.target.value);
                } else {
                  setSearchResults([]);
                }
              }}
              placeholder="Username or 0x..."
              className="w-full"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-xs">⏳</span>
            )}
          </div>
          
          {searchResults.length > 0 && (
            <div id="friendSuggestions" className="connection-suggestions visible">
              {searchResults.map((result: any) => (
                <div key={result.address} className="suggestion-item">
                  <div className="suggestion-info">
                    <span className="suggestion-name">@{result.username}</span>
                    <span className="suggestion-address">{result.address.slice(0, 6)}...{result.address.slice(-4)}</span>
                  </div>
                  <button 
                    type="button" 
                    className="pill secondary tiny"
                    onClick={() => handleAddFriend(result.address)}
                  >
                    Add
          </button>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="muted-text tiny mt-2 ml-1">User not found.</p>
          )}
        </div>
      </div>

      <div id="connectionsSection" className="connections hidden">
        <div className="connections-header">
          <div>
            <h4 id="connectionsTitle">Connections</h4>
            <p className="muted-text tiny" id="connectionsSubtitle">
              Friend list
            </p>
          </div>
          <div className="connections-actions">
            <button
              id="openConnectionSearch"
              className="icon-btn search-icon"
              aria-label="Search users"
            >
              🔍
            </button>
            <button
              id="closeConnections"
              className="icon-btn"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
        <div id="connectionSearchBox" className="connection-search hidden">
          <input
            id="connectionSearchInput"
            type="text"
            placeholder="search username"
          />
          <div
            id="connectionSuggestions"
            className="connection-suggestions hidden"
          ></div>
        </div>
        <div id="connectionsList" className="chip-list empty">
          Empty.
        </div>
      </div>

      <div className="profile-reviews">
        <div className="reviews-header">
          <h3>User Reviews</h3>
          <p className="muted-text tiny">
            {isReviewsLoading ? "Loading..." : `${reviewCount} review${reviewCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div id="myReviews" className={`review-gallery ${userReviews.length === 0 ? "empty" : ""}`}>
          {isReviewsLoading ? (
            <div className="review-loading">Loading reviews...</div>
          ) : userReviews.length === 0 ? (
            "No reviews yet."
          ) : (
            userReviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="review-rating">
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </div>
                  <span className="review-date">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="review-comment">{review.comment}</p>
                <p className="review-place-id muted-text tiny">
                  Place: {review.place_id.slice(0, 20)}...
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}


