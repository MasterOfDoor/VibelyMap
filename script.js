console.log("script.js yuklendi");

// Kriterler ve alt secenekler
const baseCriteria = ["Isiklandirma", "Yemek", "Priz", "Fiyat", "Ambiyans", "Oturma", "Deniz", "Sigara"];
const criterionOptions = {
    Isiklandirma: ["Los", "Dogal", "Canli"],
    Yemek: ["Tatli", "Kahvalti", "Vegan", "Atistirmalik"],
    Priz: ["Masada priz"],
    Fiyat: ["Uygun", "Orta", "Pahali"],
    Ambiyans: ["Retro", "Modern"],
    Oturma: ["Koltuk var", "Koltuk yok"],
    Deniz: ["Deniz goruyor", "Deniz gormuyor"],
    Sigara: ["Sigara icilebilir", "Kapali alanda sigara icilebilir"]
};
const optionCategory = Object.fromEntries(
    Object.entries(criterionOptions).flatMap(([crit, opts]) => opts.map((o) => [o, crit]))
);

const CATEGORY_KEYWORDS = {
    Kafe: ["cafe", "coffee", "kahve", "espresso", "coffeeshop", "coffee shop"],
    Restoran: ["restaurant", "restoran", "diner", "bistro", "lokanta", "kebap", "kebab", "ocakbasi", "canteen"],
    Bar: ["bar", "pub", "bistro bar", "cocktail", "wine"]
};

const CATEGORY_SEARCH_TERMS = {
    Kafe: "cafe coffee espresso kahve",
    Restoran: "restaurant lokanta kebap kebab",
    Bar: "bar pub cocktail wine"
};

const GOOGLE_TYPE_MAP = {
    Kafe: "cafe",
    Restoran: "restaurant",
    Bar: "bar"
};

function mapCategoryToOptions(category) {
    const labels = [category];
    const low = (category || "").toLowerCase();
    Object.entries(CATEGORY_KEYWORDS).forEach(([label, keywords]) => {
        if (keywords.some((k) => low.includes(k))) {
            labels.push(label);
        }
    });
    return Array.from(new Set(labels));
}

function pickRandom(source, count = 1) {
    const copy = [...source];
    const result = [];
    for (let i = 0; i < count && copy.length; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        result.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return result;
}

function enrichPlace(p) {
    const providedTags = Array.isArray(p.tags) ? [...p.tags] : [];
    const providedFeatures = Array.isArray(p.features) ? [...p.features] : [];
    
    // Initialize subOptions with existing ones from 'p'
    const subOptions = { ...(p.subOptions || {}) }; 
    const features = [...providedFeatures];

    // Add features from existing subOptions
    Object.values(subOptions).forEach(opts => opts.forEach(o => features.push(o)));

    // Fill in missing criteria with random options
    Object.entries(criterionOptions).forEach(([crit, options]) => {
        if (!subOptions[crit]) { // Only add if not already present
            const picked = pickRandom(options, Math.min(2, options.length));
            subOptions[crit] = picked;
            picked.forEach((o) => features.push(o));
        }
    });

    const combinedTags = providedTags.length ? providedTags : pickRandom(baseCriteria, 2);

    return {
        ...p,
        tags: Array.from(new Set(combinedTags)),
        subOptions: subOptions,
        features: Array.from(new Set(features))
    };
}

function formatFeatureLabel(feat) {
    const cat = optionCategory[feat];
    if (cat) return `${cat}: ${feat}`;
    return feat;
}

async function fetchPhotoDataUrl(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("photo fetch failed");
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

async function cachePhoto(id, url) {
    if (!id || !url || photoCache[id]) return;
    const dataUrl = await fetchPhotoDataUrl(url);
    if (dataUrl) {
        photoCache[id] = dataUrl;
    }
}

const PROXY_URL = "http://localhost:3001";
const ISTANBUL_CENTER = { lat: 41.015137, lng: 28.979530 };
const ISTANBUL_RADIUS = 30000; // 30 km

const PHOTO_PLACEHOLDERS = [
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='%23f6e8c9' offset='0%'/><stop stop-color='%23e2c999' offset='100%'/></linearGradient></defs><rect fill='url(%23g)' width='800' height='500'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' fill='%23806b46' font-family='Inter,Arial' font-size='32' font-weight='700'>Foto%c4%9fraf yok</text></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='1' y1='0' x2='0' y2='1'><stop stop-color='%23f1d9a3' offset='0%'/><stop stop-color='%23f8f1dd' offset='100%'/></linearGradient></defs><rect fill='url(%23g)' width='800' height='500'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23806b46' font-family='Inter,Arial' font-size='30' font-weight='700'>G%c3%b6rsel bulunamad%c4%b1</text></svg>"
];
const hereDetailCache = {};
let photoCache = {};

function normalizeHereDetail(d) {
    // Google Place Details uyarlamasi
    const result = d?.result || d;
    if (!result) return null;
    const address = result.formatted_address || "";
    const tel = result.formatted_phone_number || "";
    const website = result.website || "";
    const hours = Array.isArray(result.opening_hours?.weekday_text)
        ? result.opening_hours.weekday_text.join(" | ")
        : "";
    let photo = "";
    const ref = result.photos?.[0]?.photo_reference;
    if (ref) {
        photo = `${PROXY_URL}/google/photo?ref=${encodeURIComponent(ref)}&maxwidth=800`;
    }
    const reviews = Array.isArray(result.reviews)
        ? result.reviews.map((r) => ({
              author: r.author_name || "Ziyaretci",
              text: r.text || "",
              rating: r.rating || null,
              relativeTime: r.relative_time_description || "",
              time: r.time || null,
              profile: r.author_url || ""
          }))
        : [];
    return { address, tel, website, hours, photo, reviews };
}

function normalizeHereItem(item) {
    // Google Text Search sonucunu varolan yapıya cevir
    if (!item) return null;
    const pos = item.geometry?.location;
    if (!pos?.lat || !pos?.lng) return null;
    const googleTypes = (item.types || []).map((t) => t.replace(/_/g, " "));
    const primaryType = googleTypes[0] || "Mekan";
    const category = primaryType;
    const mappedCategories = mapCategoryToOptions(category);
    const tagSet = new Set(googleTypes);
    mappedCategories.forEach((c) => tagSet.add(c));
    let photo = "";
    const ref = item.photos?.[0]?.photo_reference;
    if (ref) {
        photo = `${PROXY_URL}/google/photo?ref=${encodeURIComponent(ref)}&maxwidth=800`;
    }
    return {
        id: item.place_id || item.id,
        name: item.name || "Mekan",
        type: category,
        coords: [pos.lat, pos.lng],
        address: item.formatted_address || "",
        website: "",
        hours: "",
        rating: item.rating || null,
        priceLabel: item.price_level ? "$".repeat(item.price_level) : "",
        tel: "",
        photo,
        tags: Array.from(tagSet).slice(0, 5),
        features: [],
        subOptions: { Kategori: mappedCategories }
    };
}

async function fetchAllDiscover(query, { lat, lng, radius = 3000, limit = 1000, type = "", pagetoken = "" } = {}) {
    // Sayfalama ile tüm sonuçları al - optimize edilmiş (hızlı)
    let allItems = [];
    let nextPageToken = pagetoken;
    let pageCount = 0;
    const maxPages = 3; // Maksimum sayfa sayısını azalttık (hız için)

    do {
        const params = new URLSearchParams({
            q: query,
            lat,
            lng,
            radius: radius.toString(),
        });
        if (type) params.set("type", type);
        if (nextPageToken) params.set("pagetoken", nextPageToken);

        const url = `${PROXY_URL}/google/textsearch?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Google Places baglantisi kurulamadi");
        const json = await res.json();

        if (json.status === "OK" || json.status === "ZERO_RESULTS") {
            const items = Array.isArray(json.results) ? json.results : [];
            allItems = [...allItems, ...items];
            nextPageToken = json.next_page_token;
            pageCount++;

            // next_page_token varsa, Google API'nin token'ı hazırlaması için kısa bir bekleme
            // Bekleme süresini azalttık (2s -> 0.5s) hız için
            if (nextPageToken && pageCount < maxPages) {
                await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 saniye bekle (hızlandırıldı)
            } else {
                break; // Daha fazla sayfa yok
            }
        } else {
            // Hata durumu
            if (json.status === "INVALID_REQUEST") {
                throw new Error("Geçersiz arama sorgusu");
            } else if (json.status === "OVER_QUERY_LIMIT") {
                throw new Error("API limiti aşıldı");
            } else {
                break; // Diğer durumlarda dur
            }
        }
    } while (nextPageToken && pageCount < maxPages);

    // Limit uygula (eğer belirtilmişse)
    return limit ? allItems.slice(0, limit) : allItems;
}

async function fetchPlaceDetailsViaProxy(place) {
    const params = new URLSearchParams();
    if (place?.id) params.set("place_id", place.id);
    const url = `${PROXY_URL}/google/details?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google lookup failed: ${res.status}`);
    return res.json();
}

function extractPhotosFromHereDetail(data) {
    const result = data?.result || data;
    const photos = (result?.photos || []).map((p) =>
        `${PROXY_URL}/google/photo?ref=${encodeURIComponent(p.photo_reference)}&maxwidth=800`
    );
    return { photos, item: result };
}

function focusOnMarkers() {
    if (!markers.length) return;
    const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
    map.fitBounds(bounds, { padding: [50, 50] });
}

async function loadPlaces(queryString, searchOptions = {}) {
    if (!queryString) throw new Error("Sorgu bos olamaz");
    const normalizedQuery = queryString.toLowerCase();
    console.log(`--- loadPlaces started: query="${queryString}", options=`, searchOptions);

    let items = [];
    try {
        const searchCenter = (searchOptions.lat && searchOptions.lng)
            ? { lat: searchOptions.lat, lng: searchOptions.lng }
            : await ensureUserLocation();
        console.log("Using search center:", searchCenter);

        const searchRadius = searchOptions.radius || 3000; // 3km yarıçap
        const limit = searchOptions.limit || 1000; // Yüksek limit, sayfalama ile tüm sonuçları alacağız

        items = await fetchAllDiscover(queryString, {
            lat: searchCenter.lat,
            lng: searchCenter.lng,
            radius: searchRadius,
            limit // Limit kaldırıldı - tüm eşleşen sonuçlar alınacak
        });
        console.log(`Google textsearch returned ${items.length} items.`);
    } catch (err) {
        showToast(err.message || "Google sorgusu basarisiz");
        console.error("loadPlaces error:", err);
        return;
    }

    const rawPlaces = items.map(normalizeHereItem);
    console.log(`Normalized ${rawPlaces.filter(Boolean).length} places out of ${rawPlaces.length} raw items.`);
    
    // Log why some items are filtered out by normalizeHereItem
    items.forEach((item, index) => {
        if (!rawPlaces[index]) {
            console.log("Item failed normalization:", item);
        }
    });

    places = rawPlaces.filter(Boolean).map(enrichPlace);
    console.log(`Total places after enrichment and injection: ${places.length}`);

    applyCachedDetailsToPlaces();
    // Filtre uygulandığında Google Places'ten zaten filtrelenmiş sonuçlar geliyor
    // Bu yüzden client-side filtreleme yapmıyoruz - tüm sonuçları gösteriyoruz
    const visible = addMarkers(true, false); // false = client-side filtreleme yapma
    console.log(`addMarkers returned ${visible.length} visible places.`);

    showToast(`${visible.length} sonuc bulundu`);
    focusOnMarkers();
    if (visible.length) {
        const firstPlace = visible[0];
        currentPlaceId = firstPlace.id;
        await maybeFetchHereDetail(firstPlace);
        renderPlaceDetail(firstPlace);
        try {
            const rec = await ensurePlaceLabels?.(firstPlace);
            if (rec?.labels?.length) {
                applyPlaceLabels(firstPlace, rec.labels, rec.clears);
            } else if (typeof getCachedPlaceLabels === "function") {
                const cached = getCachedPlaceLabels(firstPlace.id);
                if (cached?.labels?.length) applyPlaceLabels(firstPlace, cached.labels, cached.clears);
            }
        } catch (err) {
            console.warn("Initial label fetch skipped:", err);
        }
        detailPanel.classList.remove("hidden");
    } else {
        detailPanel.classList.add("hidden");
    }
    return visible;
}

async function runCategorySearch(categories) {
    const unique = Array.from(new Set(categories)).filter(Boolean);
    if (!unique.length) return;
    const mappedQueries = unique.map((c) => CATEGORY_SEARCH_TERMS[c] || c);
    const query = Array.from(new Set(mappedQueries)).join(" ");
    const visible = await loadPlaces(query);
    showToast(`${unique.join(", ")} icin 3km icinde arama yapildi`);
    return visible;
}

const extraPlaces = [];

let places = [];

const reviews = {};
let currentPlaceId = null;
let markers = [];
let searchMarker = null;
let authMode = "login"; // login | register
let currentUser = null;
let users = {};
let events = [];
let selectedEventLocation = null;
let pickingLocation = false;
let locationPreviewMarker = null;
let eventOptionSelections = new Set();
let selectedEventPlaceId = null;
let friendEventMarkers = [];
let friendEventLayerEnabled = false;
let searchMode = "map"; // map | event
let eventStorageKey = "eventsData_v1";
let friendRequests = {};
let userCoords = null;
const friendRequestStorageKey = "friendRequests_v1";
const reviewsStorageKey = "reviewsData_v1";

// Leaflet haritasi - DOMContentLoaded içinde initialize edilecek
let map = null;

// DOM referanslari
const btnKonum = document.getElementById("btnKonum");
const toast = document.getElementById("toast");
const menuToggle = document.getElementById("menuToggle");
const openSearchBtn = document.getElementById("openSearch");
const searchOverlay = document.getElementById("searchOverlay");
const filterPanel = document.getElementById("filterPanel");
const closeFilter = document.getElementById("closeFilter");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const filterForm = document.getElementById("filterForm");
const detailPanel = document.getElementById("detailPanel");
const closeDetail = document.getElementById("closeDetail");
const placeName = document.getElementById("placeName");
const placeType = document.getElementById("placeType");
const placeHours = document.getElementById("placeHours");
const placeAddress = document.getElementById("placeAddress");
const placeTags = document.getElementById("placeTags");
const placeInfo = document.getElementById("placeInfo");
const placePhoto = document.getElementById("placePhoto");
let photoOverlay = null;
let photoOverlayImg = null;
let photoOverlayPrev = null;
let photoOverlayNext = null;
let currentPhotos = [];
let currentPhotoIndex = 0;
let suggestionTimer = null;
let suggestionSeq = 0;

function ensurePhotoOverlay() {
    if (photoOverlay) return;
    photoOverlay = document.createElement("div");
    photoOverlay.className = "photo-overlay hidden";
    photoOverlay.style.cssText =
        "position:fixed; inset:0; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; z-index:9999; pointer-events:auto;";
    photoOverlay.tabIndex = -1;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "X";
    closeBtn.setAttribute("aria-label", "Kapat");
    closeBtn.style.cssText =
        "position:absolute; top:16px; right:16px; border:none; background:rgba(0,0,0,0.6); color:#fff; font-size:26px; width:42px; height:42px; border-radius:50%; cursor:pointer;";

    const prev = document.createElement("button");
    prev.className = "overlay-prev";
    prev.textContent = "<";
    prev.style.cssText =
        "position:absolute; left:20px; top:50%; transform:translateY(-50%); border:none; background:rgba(0,0,0,0.6); color:#fff; width:48px; height:48px; border-radius:50%; font-size:22px; cursor:pointer;";

    const next = document.createElement("button");
    next.className = "overlay-next";
    next.textContent = ">";
    next.style.cssText =
        "position:absolute; right:20px; top:50%; transform:translateY(-50%); border:none; background:rgba(0,0,0,0.6); color:#fff; width:48px; height:48px; border-radius:50%; font-size:22px; cursor:pointer;";

    const img = document.createElement("img");
    img.className = "overlay-photo";
    img.loading = "lazy";
    img.style.cssText =
        "max-width:90vw; max-height:90vh; width:auto; height:auto; border-radius:12px; object-fit:contain; box-shadow:0 10px 40px rgba(0,0,0,0.6); background:#111;";

    photoOverlay.appendChild(closeBtn);
    photoOverlay.appendChild(prev);
    photoOverlay.appendChild(img);
    photoOverlay.appendChild(next);
    document.body.appendChild(photoOverlay);

    photoOverlayImg = img;
    photoOverlayPrev = prev;
    photoOverlayNext = next;

    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closePhotoOverlay();
    });
    photoOverlay.addEventListener("click", (e) => {
        if (e.target === photoOverlay) closePhotoOverlay();
    });
    prev.addEventListener("click", (e) => {
        e.stopPropagation();
        stepPhoto(-1);
    });
    next.addEventListener("click", (e) => {
        e.stopPropagation();
        stepPhoto(1);
    });
    attachSwipeNavigation(photoOverlay);
}

function preloadCurrentPhotos() {
    currentPhotos.forEach((url) => {
        const img = new Image();
        img.src = url;
    });
}

function updateOverlayImage() {
    const many = currentPhotos.length > 1;
    if (photoOverlayPrev) photoOverlayPrev.style.display = many ? "flex" : "none";
    if (photoOverlayNext) photoOverlayNext.style.display = many ? "flex" : "none";
    if (!photoOverlayImg || !currentPhotos.length) return;
    photoOverlayImg.src = currentPhotos[currentPhotoIndex];
}

function syncInlinePhoto() {
    const img = placePhoto?.querySelector(".photo-main");
    if (img && currentPhotos[currentPhotoIndex]) {
        img.src = currentPhotos[currentPhotoIndex];
    }
}

function updateInlineNavVisibility() {
    const prev = placePhoto?.querySelector(".photo-nav.prev");
    const next = placePhoto?.querySelector(".photo-nav.next");
    const many = currentPhotos.length > 1;
    if (prev) prev.style.display = many ? "flex" : "none";
    if (next) next.style.display = many ? "flex" : "none";
}

function setPhotoIndex(idx) {
    if (!currentPhotos.length) return;
    currentPhotoIndex = (idx + currentPhotos.length) % currentPhotos.length;
    syncInlinePhoto();
    updateOverlayImage();
    updateInlineNavVisibility();
}

function stepPhoto(delta) {
    setPhotoIndex(currentPhotoIndex + delta);
}

function attachSwipeNavigation(el) {
    if (!el) return;
    let startX = null;
    let startY = null;
    el.addEventListener("touchstart", (e) => {
        const t = e.changedTouches?.[0];
        if (!t) return;
        startX = t.clientX;
        startY = t.clientY;
    });
    el.addEventListener("touchend", (e) => {
        if (startX === null || startY === null) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            stepPhoto(dx > 0 ? -1 : 1);
        }
        startX = null;
        startY = null;
    });
}

function openPhotoOverlay(idx = 0) {
    if (!currentPhotos.length) return;
    ensurePhotoOverlay();
    setPhotoIndex(Math.min(Math.max(idx, 0), currentPhotos.length - 1));
    photoOverlay.classList.remove("hidden");
    photoOverlay.focus({ preventScroll: true });
    document.body.classList.add("photo-overlay-open");
}

function closePhotoOverlay() {
    photoOverlay?.classList.add("hidden");
    document.body.classList.remove("photo-overlay-open");
}

document.addEventListener("keydown", (e) => {
    if (!photoOverlay || photoOverlay.classList.contains("hidden")) return;
    if (e.key === "Escape") {
        e.preventDefault();
        closePhotoOverlay();
    } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPhoto(-1);
    } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepPhoto(1);
    }
});
const reviewsList = document.getElementById("reviewsList");
const placeSearchInput = document.getElementById("placeSearchInput");
const placeSearchBtn = document.getElementById("placeSearchBtn");
const searchSuggestions = document.getElementById("searchSuggestions");
const reviewForm = document.getElementById("reviewForm");
const criteriaInputs = document.getElementById("criteriaInputs");
const addCriterionBtn = document.getElementById("addCriterion");
const customCriteria = document.getElementById("customCriteria");
const profileButton = document.getElementById("profileButton");
const profileAvatar = profileButton.querySelector(".avatar");
const profileLabel = profileButton.querySelector(".profile-label");
const profilePanel = document.getElementById("profilePanel");
const closeProfile = document.getElementById("closeProfile");
const profileEmail = document.getElementById("profileEmail");
const profileUsernameEl = document.getElementById("profileUsername");
const profileAvatarLarge = document.getElementById("profileAvatarLarge");
const avatarUploadBtn = document.getElementById("avatarUploadBtn");
const avatarInput = document.getElementById("avatarInput");
const authState = document.getElementById("authState");
const signOutBtn = document.getElementById("signOut");
const followerCountEl = document.getElementById("followerCount");
const followingCountEl = document.getElementById("followingCount");
const reviewCountEl = document.getElementById("reviewCount");
const btnFollowers = document.getElementById("btnFollowers");
const btnFollowing = document.getElementById("btnFollowing");
const profileStats = document.querySelector(".profile-stats");
const reviewStat = document.querySelector(".review-centered");
const openConnectionSearch = document.getElementById("openConnectionSearch");
const connectionSearchBox = document.getElementById("connectionSearchBox");
const connectionSearchInput = document.getElementById("connectionSearchInput");
const connectionSuggestions = document.getElementById("connectionSuggestions");
const connectionsSection = document.getElementById("connectionsSection");
const connectionsTitle = document.getElementById("connectionsTitle");
const connectionsSubtitle = document.getElementById("connectionsSubtitle");
const connectionsList = document.getElementById("connectionsList");
const closeConnections = document.getElementById("closeConnections");
const myCreatedEvents = document.getElementById("myCreatedEvents");
const myJoinedEvents = document.getElementById("myJoinedEvents");
const myReviewsList = document.getElementById("myReviews");
const resultsPanel = document.getElementById("resultsPanel");
const resultsList = document.getElementById("resultsList");
const closeResults = document.getElementById("closeResults");
const authModal = document.getElementById("authModal");
const authTitle = document.getElementById("authTitle");
const authForm = document.getElementById("authForm");
const authSubmit = document.getElementById("authSubmit");
const toggleAuthMode = document.getElementById("toggleAuthMode");
const closeAuth = document.getElementById("closeAuth");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const addFriendForm = document.getElementById("addFriendForm");
const friendIdentifierInput = document.getElementById("friendIdentifier");
const friendSuggestions = document.getElementById("friendSuggestions");
const friendPanel = document.getElementById("friendPanel");
const friendTitle = document.getElementById("friendTitle");
const friendReviewsList = document.getElementById("friendReviewsList");
const friendAvatarEl = document.getElementById("friendAvatar");
const friendUsernameEl = document.getElementById("friendUsername");
const friendHandleEl = document.getElementById("friendHandle");
const friendBioEl = document.getElementById("friendBio");
const friendFollowingList = document.getElementById("friendFollowingList");
const friendFollowersList = document.getElementById("friendFollowersList");
const friendFollowingCountEl = document.getElementById("friendFollowingCount");
const friendFollowerCountEl = document.getElementById("friendFollowerCount");
const closeFriend = document.getElementById("closeFriend");
const eventPanel = document.getElementById("eventPanel");
const eventForm = document.getElementById("eventForm");
const eventTitleInput = document.getElementById("eventTitle");
const eventDateInput = document.getElementById("eventDate");
const eventDescriptionInput = document.getElementById("eventDescription");
const pickLocationBtn = document.getElementById("pickLocation");
const openEventPanelBtn = document.getElementById("openEventPanel");
const eventLocationLabel = document.getElementById("eventLocationLabel");
const eventSearchBtn = document.getElementById("eventSearchBtn");
const eventList = document.getElementById("eventList");
const eventOptionsBox = document.getElementById("eventOptions");
const modeCreateBtn = document.getElementById("modeCreate");
const modeBrowseBtn = document.getElementById("modeBrowse");
const eventBrowseSection = document.getElementById("eventBrowse");
const closeEventPanelBtn = document.getElementById("closeEventPanel");
const visibilityInputs = document.getElementsByName("visibility");
const allowedEmailsInput = document.getElementById("allowedEmails");
const toggleFriendEventsBtn = document.getElementById("toggleFriendEvents");
const notificationButton = document.getElementById("notificationButton");
const notificationDot = document.getElementById("notificationDot");
const notificationPanel = document.getElementById("notificationPanel");
const notificationList = document.getElementById("notificationList");
const closeNotification = document.getElementById("closeNotification");
const openSettingsBtn = document.getElementById("openSettings");
const settingsPanel = document.getElementById("settingsPanel");
const accountPrivacyToggle = document.getElementById("accountPrivacy");
const addFriendGateBtnClass = "add-friend-from-gate";

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2600);
}

function canSeeUserContent(email) {
    if (!email) return true;
    const target = users[email];
    if (!target) return true;
    if (!target.isPrivate) return true;
    if (!currentUser) return false;
    if (currentUser === email) return true;
    return (target.followers || []).includes(currentUser);
}

function loadUsers() {
    try {
        const raw = JSON.parse(localStorage.getItem("users") || "{}");
        const taken = new Set();
        users = Object.fromEntries(
            Object.entries(raw).map(([email, val]) => {
                const safeEmail = email.toLowerCase();
                let username =
                    (val && typeof val === "object" && val.username) || safeEmail.split("@")[0] || "kullanici";
                username = ensureUniqueUsername(username, taken);
                taken.add(username.toLowerCase());
                if (typeof val === "string") {
                    return [
                        safeEmail,
                        { password: val, following: [], followers: [], isPrivate: false, username, avatar: "" }
                    ];
                }
                return [
                    safeEmail,
                    {
                        password: val.password || "",
                        following: val.following || val.friends || [],
                        followers: val.followers || [],
                        isPrivate: Boolean(val.isPrivate),
                        username,
                        avatar: val.avatar || ""
                    }
                ];
            })
        );
    } catch {
        users = {};
    }
}

function ensureUniqueUsername(base, takenSet = new Set()) {
    const clean = (base || "kullanici").trim().replace(/\s+/g, "_").toLowerCase();
    let candidate = clean || "kullanici";
    let suffix = 1;
    while (takenSet.has(candidate)) {
        candidate = `${clean}${suffix}`;
        suffix += 1;
    }
    return candidate;
}

function saveUsers() {
    localStorage.setItem("users", JSON.stringify(users));
}

function getUserUsername(email) {
    if (!email) return "anonim";
    const user = users[email];
    return user?.username || (email.includes("@") ? email.split("@")[0] : email);
}

function formatHandle(email) {
    return `@${getUserUsername(email)}`;
}

function resolveEmailFromIdentifier(identifier) {
    const value = (identifier || "").trim().toLowerCase();
    if (!value) return null;
    if (value.includes("@")) {
        return users[value] ? value : null;
    }
    const match = Object.entries(users).find(
        ([, data]) => (data.username || "").toLowerCase() === value
    );
    return match ? match[0] : null;
}

function applyAvatar(el, data) {
    if (!el) return;
    if (data) {
        el.style.backgroundImage = `url(${data})`;
        el.classList.add("with-photo");
        el.textContent = "";
    } else {
        el.style.backgroundImage = "";
        el.classList.remove("with-photo");
    }
}

async function handleAvatarFile(file) {
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        if (!users[currentUser]) return;
        users[currentUser].avatar = dataUrl;
        saveUsers();
        applyAvatar(profileAvatar, dataUrl);
        applyAvatar(profileAvatarLarge, dataUrl);
        showToast("Profil foton guncellendi");
    };
    reader.readAsDataURL(file);
}

function forceUsernameSelection(email) {
    let username = "";
    const tries = new Set();
    while (true) {
        username = (window.prompt("Kullanici adi sec (bos olamaz, benzersiz olmali):") || "").trim().toLowerCase();
        if (!username) {
            showToast("Kullanici adi zorunlu.");
            continue;
        }
        if (tries.has(username)) {
            showToast("Bu adi zaten denedin, baska bir sey yaz.");
            continue;
        }
        tries.add(username);
        const taken = Object.entries(users).some(
            ([mail, data]) => mail !== email && (data.username || "").toLowerCase() === username
        );
        if (taken) {
            showToast("Bu kullanici adi alinmis.");
            continue;
        }
        if (!users[email]) users[email] = { password: "", following: [], followers: [], isPrivate: false };
        users[email].username = username;
        saveUsers();
        showToast("Kullanici adin ayarlandi.");
        updateAuthUI();
        break;
    }
}

function loadReviews() {
    try {
        const raw = localStorage.getItem(reviewsStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            Object.assign(reviews, parsed);
        }
    } catch {
        // ignore
    }
}

function saveReviews() {
    try {
        localStorage.setItem(reviewsStorageKey, JSON.stringify(reviews));
    } catch {
        // ignore
    }
}

function loadFriendRequests() {
    try {
        const raw = localStorage.getItem(friendRequestStorageKey);
        friendRequests = raw ? JSON.parse(raw) : {};
    } catch {
        friendRequests = {};
    }
}

function saveFriendRequests() {
    localStorage.setItem(friendRequestStorageKey, JSON.stringify(friendRequests));
}

function loadSession() {
    const saved = sessionStorage.getItem("currentUser") ?? localStorage.getItem("currentUser");
    currentUser = saved || null;
    // Eski localStorage oturumunu temizle ki sekmeler arasi paylasim olmasin
    if (localStorage.getItem("currentUser")) {
        localStorage.removeItem("currentUser");
        if (currentUser) sessionStorage.setItem("currentUser", currentUser);
    }
}

function saveSession() {
    if (currentUser) {
        sessionStorage.setItem("currentUser", currentUser);
        localStorage.removeItem("currentUser");
    } else {
        sessionStorage.removeItem("currentUser");
        localStorage.removeItem("currentUser");
    }
}

function updateAuthUI() {
    if (currentUser) {
        const username = getUserUsername(currentUser);
        const initial = username.charAt(0).toUpperCase();
        profileAvatar.textContent = initial;
        profileAvatarLarge.textContent = initial;
        const avatarData = users[currentUser]?.avatar || "";
        applyAvatar(profileAvatar, avatarData);
        applyAvatar(profileAvatarLarge, avatarData);
        profileLabel.textContent = "Hesabim";
        profileUsernameEl.textContent = username;
        profileEmail.textContent = formatHandle(currentUser);
        authState.textContent = "";
        signOutBtn.classList.remove("hidden");
    } else {
        profileAvatar.textContent = "P";
        profileAvatarLarge.textContent = "P";
        applyAvatar(profileAvatar, "");
        applyAvatar(profileAvatarLarge, "");
        profileLabel.textContent = "Profil";
        profileUsernameEl.textContent = "Giris yap";
        profileEmail.textContent = "@kullanici";
        authState.textContent = "Giris yapmadin.";
        signOutBtn.classList.add("hidden");
    }
    updatePrivacyUI();
    updateMyReviews();
    updateConnectionCounts();
    renderEventList();
    renderEventMarkers();
    updateMyEvents();
    renderNotifications();
    updateNotificationBadge();
}

function updatePrivacyUI() {
    if (!settingsPanel || !accountPrivacyToggle) return;
    if (!currentUser) {
        settingsPanel.classList.add("hidden");
        accountPrivacyToggle.checked = true;
        return;
    }
    settingsPanel.classList.remove("hidden");
    const isPrivate = Boolean(users[currentUser]?.isPrivate);
    accountPrivacyToggle.checked = !isPrivate;
}

function getMyReviewCount() {
    if (!currentUser) return 0;
    let count = 0;
    Object.values(reviews).forEach((revs) => {
        revs.forEach((rev) => {
            if (rev.userEmail === currentUser) count += 1;
        });
    });
    return count;
}

function updateConnectionCounts() {
    if (!followerCountEl || !followingCountEl) return;
    const followers = currentUser ? users[currentUser]?.followers || [] : [];
    const following = currentUser ? users[currentUser]?.following || [] : [];
    followerCountEl.textContent = followers.length;
    followingCountEl.textContent = following.length;
    reviewCountEl.textContent = getMyReviewCount();
}

function showConnections(type = "followers") {
    if (!connectionsSection || !connectionsList) return;
    connectionSearchInput && (connectionSearchInput.value = "");
    connectionSuggestions && connectionSuggestions.classList.add("hidden");
    if (!currentUser) {
        connectionsList.textContent = "Giris yapmadin.";
        connectionsList.classList.add("empty");
        connectionsSection.classList.remove("hidden");
        return;
    }
    const isFollowers = type === "followers";
    const list = isFollowers ? users[currentUser]?.followers || [] : users[currentUser]?.following || [];
    connectionsTitle.textContent = isFollowers ? "Mudavimlerim" : "Gurmelerim";
    connectionsSubtitle.textContent = isFollowers
        ? "Seni takip edenler"
        : "Senin eklediklerin";
    connectionsList.innerHTML = "";
    if (!list.length) {
        connectionsList.classList.add("empty");
        connectionsList.textContent = isFollowers ? "Mudavim yok." : "Gurme yok.";
    } else {
        connectionsList.classList.remove("empty");
        list.forEach((email) => {
            const chip = document.createElement("div");
            chip.className = "friend-chip";
            const avatar = document.createElement("div");
            avatar.className = "friend-avatar";
            avatar.textContent = getUserUsername(email).charAt(0).toUpperCase();
            const meta = document.createElement("div");
            meta.className = "friend-meta";
            const nameBtn = document.createElement("button");
            nameBtn.type = "button";
            nameBtn.className = "friend-name";
            nameBtn.dataset.email = email;
            nameBtn.textContent = getUserUsername(email);
            const note = document.createElement("span");
            note.className = "friend-note";
            note.textContent = formatHandle(email);
            meta.appendChild(nameBtn);
            meta.appendChild(note);
            chip.appendChild(avatar);
            chip.appendChild(meta);
            connectionsList.appendChild(chip);
        });
    }
    connectionsSection.classList.remove("hidden");
}

function openAuthModal(mode = "login") {
    authMode = mode;
    const isLogin = mode === "login";
    authTitle.textContent = isLogin ? "Giris yap" : "Kayit ol";
    authSubmit.textContent = isLogin ? "Giris yap" : "Kayit ol";
    toggleAuthMode.textContent = isLogin ? "Kayit ol" : "Giris yap";
    usernameInput.required = !isLogin;
    authModal.classList.remove("hidden");
    usernameInput.focus();
}

function closeAuthModal() {
    authModal.classList.add("hidden");
    authForm.reset();
}


function ensureUserLocation() {
    return new Promise((resolve) => {
        if (userCoords) {
            resolve(userCoords);
            return;
        }
        const fallbackCenter = () => {
            const center = map.getCenter();
            const fb = { lat: center.lat, lng: center.lng };
            userCoords = fb;
            showToast("Konum alinamadi, harita merkezini kullaniyorum.");
            resolve(fb);
        };
        if (!navigator.geolocation) {
            showToast("Tarayici konum destegi yok, harita merkezini kullaniyorum.");
            fallbackCenter();
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                resolve(userCoords);
            },
            () => fallbackCenter()
        );
    });
}

function showResultsPanel(items) {
    if (!resultsPanel || !resultsList) return;
    resultsList.innerHTML = "";
    if (!items.length) {
        resultsList.classList.add("empty");
        resultsList.textContent = "Sonuc yok.";
    } else {
        resultsList.classList.remove("empty");
        items.forEach((place) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "result-row";
            btn.innerHTML = `<strong>${place.name}</strong><span class="muted-text tiny">${place.type}</span>`;
            btn.addEventListener("click", async () => {
                map.setView(place.coords, 15);
                currentPlaceId = place.id;

                // Show a loading state in the panel first
                placeName.textContent = place.name;
                placeType.textContent = "Detaylar yükleniyor...";
                placeInfo.innerHTML = "";
                placeTags.innerHTML = "";
                placePhoto.innerHTML = `<div class="photo-placeholder"><span>Yükleniyor...</span></div>`;
                placePhoto.classList.remove("hidden");
                detailPanel.classList.add("visible");
                detailPanel.classList.remove("hidden");

                await maybeFetchHereDetail(place);
                renderPlaceDetail(place);
                try {
                    const rec = await ensurePlaceLabels?.(place);
                    if (rec?.labels?.length) {
                        applyPlaceLabels(place, rec.labels, rec.clears);
                    } else if (typeof getCachedPlaceLabels === "function") {
                        const cached = getCachedPlaceLabels(place.id);
                        if (cached?.labels?.length) applyPlaceLabels(place, cached.labels, cached.clears);
                    }
                } catch (err) {
                    console.warn("Label fetch skipped:", err);
                }
            });
            resultsList.appendChild(btn);
        });
    }
    resultsPanel.classList.remove("hidden");
    resultsPanel.classList.add("visible");
}

function hideResultsPanel() {
    if (!resultsPanel) return;
    resultsPanel.classList.add("hidden");
    resultsPanel.classList.remove("visible");
}

function resetMarkers() {
    markers.forEach((m) => m.remove());
    markers = [];
}

function clearSearchMarker() {
    if (searchMarker) {
        searchMarker.remove();
        searchMarker = null;
    }
}

function showSearchMarker(place) {
    clearSearchMarker();
    if (!place?.coords) return;
    searchMarker = L.marker(place.coords).addTo(map);
    searchMarker.bindPopup(`<strong>${place.name}</strong><br>${place.type}`);
    searchMarker.openPopup();
}

function ensureExtraPlaces() {
    // local seed kullanilmiyor
}

function mergePlaceLists(base, incoming) {
    const map = new Map();
    base.forEach((p) => {
        const key = p.id || p.name;
        if (key) map.set(key, p);
    });
    incoming.forEach((p) => {
        const key = p.id || p.name;
        if (!key) return;
        if (!map.has(key)) map.set(key, p);
    });
    return Array.from(map.values());
}

function addMarkers(showList = false, applyClientSideFilters = true) {
    const { main, sub } = getSelectedFilters();
    const hasFilters = main.length || Object.keys(sub).length;
    resetMarkers();

    // Filtre uygulandığında Google Places'ten zaten filtrelenmiş sonuçlar geliyor
    // Bu yüzden client-side filtreleme yapmıyoruz - tüm sonuçları gösteriyoruz
    const visible = applyClientSideFilters && hasFilters
        ? places.filter((place) => matchesFilters(place, main, sub))
        : places; // Tüm sonuçları göster

    visible
        .forEach((place) => {
            const marker = L.marker(place.coords).addTo(map);
            marker.bindPopup(`<strong>${place.name}</strong><br>${place.type}`);
            marker.on("click", async () => {
                if (pickingLocation) {
                    setEventLocation({ lat: place.coords[0], lng: place.coords[1] }, place);
                    pickingLocation = false;
                    showToast(`${place.name} etkinlik konumu olarak secildi`);
                    return;
                }
                
                setEventPanel(false);
                toggleProfilePanel(false);
                currentPlaceId = place.id;

                // Show a loading state in the panel first
                placeName.textContent = place.name;
                placeType.textContent = "Detaylar yükleniyor...";
                placeInfo.innerHTML = "";
                placeTags.innerHTML = "";
                placePhoto.innerHTML = `<div class="photo-placeholder"><span>Yükleniyor...</span></div>`;
                placePhoto.classList.remove("hidden");
                detailPanel.classList.add("visible");
                detailPanel.classList.remove("hidden");
                
                await maybeFetchHereDetail(place);
                renderPlaceDetail(place);
                try {
                    const rec = await ensurePlaceLabels?.(place);
                    if (rec?.labels?.length) {
                        applyPlaceLabels(place, rec.labels, rec.clears);
                    } else if (typeof getCachedPlaceLabels === "function") {
                        const cached = getCachedPlaceLabels(place.id);
                        if (cached?.labels?.length) applyPlaceLabels(place, cached.labels, cached.clears);
                    }
                } catch (err) {
                    console.warn("Label fetch skipped:", err);
                }
            });
            markers.push(marker);
        });

    if (showList && resultsPanel && resultsList) {
        showResultsPanel(visible);
    }
    return visible;
}


function applyHereDetail(place, detail) {
    if (!place) return;
    const data = detail && typeof detail === "object" && !detail.error ? detail : {};
    let changed = false;
    if (Array.isArray(data.photos) && data.photos.length) {
        place.photos = data.photos;
        changed = true;
    }
    if (data.photo && !place.photo) {
        place.photo = data.photo;
        cachePhoto(place.id, data.photo);
        changed = true;
    } else if (!place.photo && photoCache[place.id]) {
        place.photo = photoCache[place.id];
        changed = true;
    }
    if (data.address && !place.address) {
        place.address = data.address;
        changed = true;
    }
    if (data.tel && !place.tel) {
        place.tel = data.tel;
        changed = true;
    }
    if (data.website && !place.website) {
        place.website = data.website;
        changed = true;
    }
    if (data.hours && !place.hours) {
        place.hours = data.hours;
        changed = true;
    }
    if (Array.isArray(data.reviews) && data.reviews.length) {
        place.externalReviews = data.reviews;
        changed = true;
    }
    if (changed && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function findOptionCategory(label) {
    if (!label) return null;
    if (optionCategory[label]) return optionCategory[label];
    const lower = label.toLowerCase();
    const hit = Object.entries(optionCategory).find(([opt]) => opt.toLowerCase() === lower);
    return hit ? hit[1] : null;
}

function normalizeLabel(label) {
    if (!label) return label;
    if (typeof label === "string" && /ye(s|\u015f)illik/i.test(label)) {
        return "Dekoratif bitkiler";
    }
    return label;
}

function applyPlaceLabels(place, labels = [], clears = []) {
    if (!place || !Array.isArray(labels) || !labels.length) return;
    let tags = Array.isArray(place.tags) ? [...place.tags] : [];
    let feats = Array.isArray(place.features) ? [...place.features] : [];

    // Remove categories explicitly cleared by GPT JSON (e.g., masada_priz_var_mi: false)
    if (Array.isArray(clears) && clears.length) {
        clears.forEach((cat) => {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        });
    }

    labels.forEach((raw) => {
        const l = normalizeLabel(raw);
        if (!l) return;
        const cat = findOptionCategory(l);
        if (cat) {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        }
        if (!tags.includes(l)) tags.push(l);
        if (!feats.includes(l)) feats.push(l);
    });

    const tagsChanged = JSON.stringify(place.tags) !== JSON.stringify(tags);
    place.tags = tags;
    place.features = feats;
    if (tagsChanged && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function applyCachedDetailsToPlaces() {
    places.forEach((p) => applyHereDetail(p, hereDetailCache[p.id]));
}

function persistHereDetailCache() {
    // caching disabled
}

async function maybeFetchHereDetail(place) {
    if (!place) return null;
    const cached = hereDetailCache[place.id];
    if (cached && cached !== "pending") {
        applyHereDetail(place, cached);
        return cached;
    }
    if (cached === "pending") return null; // Or some other promise-based mechanism
    hereDetailCache[place.id] = "pending";
    try {
        const data = await fetchPlaceDetailsViaProxy(place);
        const detail = normalizeHereDetail(data);
        const { photos } = extractPhotosFromHereDetail(data);
        hereDetailCache[place.id] = detail || {};
        if (photos.length) {
            hereDetailCache[place.id].photo = hereDetailCache[place.id].photo || photos[0];
            hereDetailCache[place.id].photos = photos;
        }
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    } catch (err) {
        hereDetailCache[place.id] = { error: err.message };
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    }
}

function renderPlaceDetail(place) {
    if (!place) return;

    placeName.textContent = place.name;
    placeType.textContent = place.type;
    const addrText = place.address?.label || place.address || (place.coords ? `${place.coords[0].toFixed(4)}, ${place.coords[1].toFixed(4)}` : "");
    if (placeHours) placeHours.textContent = place.openingHours?.[0]?.text?.join(" | ") || place.hours || "";
    if (placeAddress) placeAddress.textContent = addrText ? `Adres: ${addrText}` : "";

    const parts = [];
    if (place.type) parts.push(place.type);
    if (place.tags) parts.push(...place.tags);
    if (place.rating) parts.push(`Puan: ${place.rating}`);
    if (place.priceLabel) parts.push(`Fiyat: ${place.priceLabel}`);
    if (place.contacts?.[0]?.phone?.[0]?.value) parts.push(`Tel: ${place.contacts[0].phone[0].value}`);
    else if (place.tel) parts.push(`Tel: ${place.tel}`);
    if (place.website) parts.push(`<a href="${place.website}" target="_blank" rel="noopener">Web</a>`);
    placeInfo.innerHTML = parts.filter(Boolean).join(" | ");

    if (placePhoto) {
        const photos = Array.isArray(place.photos) ? place.photos.filter(Boolean) : [];
        if (place.photo) photos.unshift(place.photo);
        currentPhotos = photos.length ? Array.from(new Set(photos)) : [];
        currentPhotoIndex = 0;
        preloadCurrentPhotos();

        if (currentPhotos.length) {
            const first = currentPhotos[0];
            placePhoto.innerHTML = `
                <div class="photo-gallery" style="position:relative; display:flex; align-items:center; justify-content:center; gap:8px; width:100%; background:#f7f2e8; border-radius:12px; padding:8px; min-height:260px; max-height:520px; aspect-ratio: 3 / 4; overflow:hidden;">
                    <button class="photo-fullscreen-btn" aria-label="Tam ekran" title="Tam ekran" style="position:absolute; right:10px; top:10px; border:none; width:38px; height:38px; border-radius:12px; background:rgba(0,0,0,0.45); color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:2;">⤢</button>
                    <button class="photo-nav prev" aria-label="Onceki foto" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); width:40px; height:40px; border:none; border-radius:999px; background:rgba(0,0,0,0.4); color:#fff; font-size:18px; cursor:pointer; display:${currentPhotos.length>1?"flex":"none"}; align-items:center; justify-content:center;">&lt;</button>
                    <img class="photo-main" src="${first}" alt="${place.name}" loading="lazy" style="width:100%; height:100%; max-height:500px; border-radius:12px; object-fit:cover; cursor:pointer; background:#111; transition:opacity 0.15s ease;">
                    <button class="photo-nav next" aria-label="Sonraki foto" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); width:40px; height:40px; border:none; border-radius:999px; background:rgba(0,0,0,0.4); color:#fff; font-size:18px; cursor:pointer; display:${currentPhotos.length>1?"flex":"none"}; align-items:center; justify-content:center;">&gt;</button>
                </div>
            `;
            placePhoto.classList.remove("hidden");

            const mainImg = placePhoto.querySelector(".photo-main");
            const prevBtn = placePhoto.querySelector(".photo-nav.prev");
            const nextBtn = placePhoto.querySelector(".photo-nav.next");
            const fullscreenBtn = placePhoto.querySelector(".photo-fullscreen-btn");
            prevBtn?.addEventListener("click", (e) => {
                e.stopPropagation();
                stepPhoto(-1);
            });
            nextBtn?.addEventListener("click", (e) => {
                e.stopPropagation();
                stepPhoto(1);
            });
            mainImg?.addEventListener("click", () => openPhotoOverlay(currentPhotoIndex));
            fullscreenBtn?.addEventListener("click", (e) => {
                e.stopPropagation();
                openPhotoOverlay(currentPhotoIndex);
            });
            attachSwipeNavigation(mainImg);
            setPhotoIndex(0);
        } else {
            const ph = PHOTO_PLACEHOLDERS[Math.floor(Math.random() * PHOTO_PLACEHOLDERS.length)];
            placePhoto.innerHTML = `<div class="photo-placeholder"><span>Fotograf yok</span></div>`;
            placePhoto.style.backgroundImage = `url(${ph})`;
            placePhoto.classList.remove("hidden");
        }
    }

    placeTags.innerHTML = "";
    const hiddenTags = new Set(["servis", "atmosfer"]);
    const combined = [];
    (place.tags || []).forEach((t) => combined.push({ value: t, kind: "tag" }));
    (place.features || []).forEach((f) => combined.push({ value: f, kind: "feat" }));

    const seenCat = new Set();
    const seenVal = new Set();
    combined.forEach((item) => {
        const val = item.value;
        if (!val || hiddenTags.has((val || "").toLowerCase())) return;
        const cat = findOptionCategory(val);
        const lowerVal = val.toLowerCase();
        if (cat && seenCat.has(cat)) return;
        if (seenVal.has(lowerVal)) return;
        seenVal.add(lowerVal);
        if (cat) seenCat.add(cat);

        const chip = document.createElement("span");
        chip.className = item.kind === "feat" ? "tag subtag" : "tag";
        chip.textContent = item.kind === "feat" ? formatFeatureLabel(val) : val;
        placeTags.appendChild(chip);
    });

    detailPanel.classList.add("visible");
    detailPanel.classList.remove("hidden");
    hideProfilePanel();
    friendPanel.classList.remove("visible");
    friendPanel.classList.add("hidden");

    updateReviewsList(place.id);
    reviewForm.dataset.placeId = place.id;
    map.panTo(place.coords);
}
function applyHereDetail(place, detail) {
    if (!place) return;
    const data = detail && typeof detail === "object" && !detail.error ? detail : {};
    let changed = false;
    if (Array.isArray(data.photos) && data.photos.length) {
        place.photos = data.photos;
        changed = true;
    }
    if (data.photo && !place.photo) {
        place.photo = data.photo;
        cachePhoto(place.id, data.photo);
        changed = true;
    } else if (!place.photo && photoCache[place.id]) {
        place.photo = photoCache[place.id];
        changed = true;
    }
    if (data.address && !place.address) {
        place.address = data.address;
        changed = true;
    }
    if (data.tel && !place.tel) {
        place.tel = data.tel;
        changed = true;
    }
    if (data.website && !place.website) {
        place.website = data.website;
        changed = true;
    }
    if (data.hours && !place.hours) {
        place.hours = data.hours;
        changed = true;
    }
    if (Array.isArray(data.reviews) && data.reviews.length) {
        place.externalReviews = data.reviews;
        changed = true;
    }
    if (changed && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function findOptionCategory(label) {
    if (!label) return null;
    if (optionCategory[label]) return optionCategory[label];
    const lower = label.toLowerCase();
    const hit = Object.entries(optionCategory).find(([opt]) => opt.toLowerCase() === lower);
    return hit ? hit[1] : null;
}

function normalizeLabel(label) {
    if (!label) return label;
    if (typeof label === "string" && /ye(s|\u015f)illik/i.test(label)) {
        return "Dekoratif bitkiler";
    }
    return label;
}

function applyPlaceLabels(place, labels = [], clears = []) {
    if (!place || !Array.isArray(labels) || !labels.length) return;
    let tags = Array.isArray(place.tags) ? [...place.tags] : [];
    let feats = Array.isArray(place.features) ? [...place.features] : [];

    // Remove categories explicitly cleared by GPT JSON (e.g., masada_priz_var_mi: false)
    if (Array.isArray(clears) && clears.length) {
        clears.forEach((cat) => {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        });
    }

    labels.forEach((raw) => {
        const l = normalizeLabel(raw);
        if (!l) return;
        const cat = findOptionCategory(l);
        if (cat) {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        }
        if (!tags.includes(l)) tags.push(l);
        if (!feats.includes(l)) feats.push(l);
    });

    const tagsChanged = JSON.stringify(place.tags) !== JSON.stringify(tags);
    place.tags = tags;
    place.features = feats;
    if (tagsChanged && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function applyCachedDetailsToPlaces() {
    places.forEach((p) => applyHereDetail(p, hereDetailCache[p.id]));
}

function persistHereDetailCache() {
    // caching disabled
}

async function maybeFetchHereDetail(place) {
    if (!place) return null;
    const cached = hereDetailCache[place.id];
    if (cached && cached !== "pending") {
        applyHereDetail(place, cached);
        return cached;
    }
    if (cached === "pending") return null; // Or some other promise-based mechanism
    hereDetailCache[place.id] = "pending";
    try {
        const data = await fetchPlaceDetailsViaProxy(place);
        const detail = normalizeHereDetail(data);
        const { photos } = extractPhotosFromHereDetail(data);
        hereDetailCache[place.id] = detail || {};
        if (photos.length) {
            hereDetailCache[place.id].photo = hereDetailCache[place.id].photo || photos[0];
            hereDetailCache[place.id].photos = photos;
        }
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    } catch (err) {
        hereDetailCache[place.id] = { error: err.message };
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    }
}

function applyHereDetail(place, detail) {
    if (!place) return;
    const data = detail && typeof detail === "object" && !detail.error ? detail : {};
    let changed = false;
    if (Array.isArray(data.photos) && data.photos.length) {
        place.photos = data.photos;
        changed = true;
    }
    if (data.photo && !place.photo) {
        place.photo = data.photo;
        cachePhoto(place.id, data.photo);
        changed = true;
    } else if (!place.photo && photoCache[place.id]) {
        place.photo = photoCache[place.id];
        changed = true;
    }
    if (data.address && !place.address) {
        place.address = data.address;
        changed = true;
    }
    if (data.tel && !place.tel) {
        place.tel = data.tel;
        changed = true;
    }
    if (data.website && !place.website) {
        place.website = data.website;
        changed = true;
    }
    if (data.hours && !place.hours) {
        place.hours = data.hours;
        changed = true;
    }
    if (Array.isArray(data.reviews) && data.reviews.length) {
        place.externalReviews = data.reviews;
        changed = true;
    }
    if (changed && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function findOptionCategory(label) {
    if (!label) return null;
    if (optionCategory[label]) return optionCategory[label];
    const lower = label.toLowerCase();
    const hit = Object.entries(optionCategory).find(([opt]) => opt.toLowerCase() === lower);
    return hit ? hit[1] : null;
}

function normalizeLabel(label) {
    if (!label) return label;
    if (typeof label === "string" && /ye(s|\u015f)illik/i.test(label)) {
        return "Dekoratif bitkiler";
    }
    return label;
}

function applyPlaceLabels(place, labels = [], clears = []) {
    if (!place || !Array.isArray(labels) || !labels.length) return;
    let tags = Array.isArray(place.tags) ? [...place.tags] : [];
    let feats = Array.isArray(place.features) ? [...place.features] : [];

    // Remove categories explicitly cleared by GPT JSON (e.g., masada_priz_var_mi: false)
    if (Array.isArray(clears) && clears.length) {
        clears.forEach((cat) => {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        });
    }

    labels.forEach((raw) => {
        const l = normalizeLabel(raw);
        if (!l) return;
        const cat = findOptionCategory(l);
        if (cat) {
            tags = tags.filter((t) => findOptionCategory(t) !== cat);
            feats = feats.filter((t) => findOptionCategory(t) !== cat);
        }
        if (!tags.includes(l)) tags.push(l);
        if (!feats.includes(l)) feats.push(l);
    });

    const tagsChanged = JSON.stringify(place.tags) !== JSON.stringify(tags);
    place.tags = tags;
    place.features = feats;
    if (tagsChanged && currentPlaceId === place.id) {
        renderPlaceDetail(place);
    }
}

function applyCachedDetailsToPlaces() {
    places.forEach((p) => applyHereDetail(p, hereDetailCache[p.id]));
}

function persistHereDetailCache() {
    // caching disabled
}

async function maybeFetchHereDetail(place) {
    if (!place) return null;
    const cached = hereDetailCache[place.id];
    if (cached && cached !== "pending") {
        applyHereDetail(place, cached);
        return cached;
    }
    if (cached === "pending") return null; // Or some other promise-based mechanism
    hereDetailCache[place.id] = "pending";
    try {
        const data = await fetchPlaceDetailsViaProxy(place);
        const detail = normalizeHereDetail(data);
        const { photos } = extractPhotosFromHereDetail(data);
        hereDetailCache[place.id] = detail || {};
        if (photos.length) {
            hereDetailCache[place.id].photo = hereDetailCache[place.id].photo || photos[0];
            hereDetailCache[place.id].photos = photos;
        }
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    } catch (err) {
        hereDetailCache[place.id] = { error: err.message };
        persistHereDetailCache();
        applyHereDetail(place, hereDetailCache[place.id]);
        return hereDetailCache[place.id];
    }
}

function updateReviewsList(placeId) {
    const place = places.find((p) => p.id === placeId);
    const external = place?.externalReviews || [];
    const list = reviews[placeId] || [];
    reviewsList.innerHTML = "";

    if (!list.length && !external.length) {
        reviewsList.classList.add("empty");
        reviewsList.textContent = "Henuz yorum yok.";
        return;
    }

    reviewsList.classList.remove("empty");
    external.forEach((rev, idx) => {
        const item = document.createElement("div");
        item.className = "review-item external-review";
        item.dataset.placeId = placeId;
        item.dataset.reviewId = `ext-${idx}`;
        const author = rev.author || "Ziyaretci";
        const ratingText = rev.rating ? `<span class="tag">Puan: ${rev.rating}/5</span>` : "";
        const timeText = rev.relativeTime ? `<span class="tag">${rev.relativeTime}</span>` : "";
        const profileLink = rev.profile ? `<a href="${rev.profile}" target="_blank" rel="noopener">${author}</a>` : author;
        item.innerHTML = `
            <p>${rev.text || "Yorum yok"}</p>
            <div class="review-meta">
                <span class="tag review-user">${profileLink}</span>
                ${ratingText}
                ${timeText}
            </div>
        `;
        reviewsList.appendChild(item);
    });

    list.forEach((rev) => {
        const item = document.createElement("div");
        item.className = "review-item";
        item.dataset.placeId = placeId;
        item.dataset.reviewId = rev.id || rev.createdAt || "";
        if (rev.userEmail === currentUser) item.classList.add("owned-review");
        const ratings = [...rev.ratings, ...rev.customRatings];
        item.innerHTML = `
            <p>${rev.comment || "Yorum yok"}</p>
            <div class="review-meta">
                <button type="button" class="tag review-user" data-email="${rev.userEmail || ""}">
                    ${formatHandle(rev.userEmail) || "Anonim"}
                </button>
                ${ratings.map((r) => `<span class="tag">${r.label}: ${r.value}/5</span>`).join("")}
            </div>
        `;
        reviewsList.appendChild(item);
    });
}

function updateMyReviews() {
    myReviewsList.innerHTML = "";
    if (!currentUser) {
        myReviewsList.classList.add("empty");
        myReviewsList.textContent = "Giris yapmadin.";
        return;
    }
    const mine = [];
    Object.entries(reviews).forEach(([placeId, revs]) => {
        revs.forEach((rev) => {
            if (rev.userEmail === currentUser) {
                const place = places.find((p) => p.id === placeId);
                mine.push({ ...rev, placeName: place?.name || placeId });
            }
        });
    });
    if (!mine.length) {
        myReviewsList.classList.add("empty");
        myReviewsList.textContent = "Yorum yok.";
        return;
    }
    myReviewsList.classList.remove("empty");
    mine.forEach((rev) => {
        const item = document.createElement("div");
        item.className = "review-card";
        item.dataset.placeId = rev.placeId || "";
        item.dataset.reviewId = rev.id || rev.createdAt || "";
        item.classList.add("owned-review");
        const ratings = [...rev.ratings, ...rev.customRatings];
        item.innerHTML = `
            <strong>${rev.placeName}</strong>
            <p>${rev.comment || "Yorum yok"}</p>
            <div class="meta">
                <span>${new Date(rev.createdAt || Date.now()).toLocaleDateString("tr-TR")}</span>
                ${ratings.map((r) => `<span class="tag">${r.label}: ${r.value}/5</span>`).join("")}
            </div>
        `;
        myReviewsList.appendChild(item);
    });
    updateConnectionCounts();
}

function removeFriend(email) {
    if (!currentUser) return;
    const me = users[currentUser];
    me.following = (me.following || []).filter((f) => f !== email);
    users[currentUser] = me;
    if (users[email]) {
        users[email].followers = (users[email].followers || []).filter((f) => f !== currentUser);
    }
    saveUsers();
    updateConnectionCounts();
    if (connectionsSection && !connectionsSection.classList.contains("hidden")) {
        const isFollowers = connectionsTitle.textContent.includes("Mudavim");
        showConnections(isFollowers ? "followers" : "following");
    }
    showToast("Gurmelerinden cikarildi");
}

function attemptAddFriend(friendEmail) {
    if (!currentUser) {
        showToast("Once giris yapmalisin.");
        openAuthModal("login");
        return;
    }
    const email = resolveEmailFromIdentifier(friendEmail);
    if (!email) {
        showToast("Kullanici bulunamadi.");
        return;
    }
    if (email === currentUser) {
        showToast("Kendini ekleyemezsin.");
        return;
    }
    const targetUser = users[email];
    if (!targetUser) {
        showToast("Kullanici bulunamadi.");
        return;
    }
    const me = users[currentUser];
    me.following = me.following || [];
    targetUser.followers = targetUser.followers || [];
    if (me.following.includes(email)) {
        showToast("Zaten gurmen.");
        return;
    }
    if (targetUser.isPrivate) {
        const pending = friendRequests[email] || [];
        if (pending.includes(currentUser)) {
            showToast("Onay bekleniyor.");
            return;
        }
        friendRequests[email] = [...pending, currentUser];
        saveFriendRequests();
        updateNotificationBadge();
        showToast("Izin istegi gonderildi.");
    } else {
        me.following.push(email);
        if (!targetUser.followers.includes(currentUser)) targetUser.followers.push(currentUser);
        users[currentUser] = me;
        users[email] = targetUser;
        saveUsers();
        updateConnectionCounts();
        showToast("Gurme eklendi.");
    }
}

function renderFriendPanel(email) {
    friendFollowingList && (friendFollowingList.innerHTML = "");
    friendFollowersList && (friendFollowersList.innerHTML = "");
    friendReviewsList.innerHTML = "";
    if (!email) {
        friendReviewsList.classList.add("empty");
        friendReviewsList.textContent = "Gurme bulunamadi.";
        friendTitle.textContent = "Gurme profili";
        return;
    }
    const targetUser = users[email];
    const username = getUserUsername(email);
    const handle = formatHandle(email);
    const isPrivate = Boolean(targetUser?.isPrivate);
    const followsMe = (targetUser?.followers || []).includes(currentUser || "");
    const canViewContent = !isPrivate || currentUser === email || followsMe;
    if (friendAvatarEl) {
        friendAvatarEl.textContent = username.charAt(0).toUpperCase();
        const avatarData = targetUser?.avatar || "";
        applyAvatar(friendAvatarEl, avatarData);
    }
    friendUsernameEl && (friendUsernameEl.textContent = username);
    friendHandleEl && (friendHandleEl.textContent = handle);
    const followerCount = targetUser?.followers?.length || 0;
    const followingCount = targetUser?.following?.length || 0;
    friendFollowerCountEl && (friendFollowerCountEl.textContent = followerCount);
    friendFollowingCountEl && (friendFollowingCountEl.textContent = followingCount);

    if (!canSeeUserContent(email)) {
        friendTitle.textContent = getUserUsername(email);
        friendReviewsList.classList.remove("empty");
        const gateMsg = targetUser?.isPrivate
            ? "Bu hesap kapali ve gurmeniz degil. Yorumlarini goremezsin."
            : "Bu kisi gurmeniz degil. Yorumlarini goremezsin.";
        friendReviewsList.innerHTML = `
            <p class="muted-text">${gateMsg}</p>
            ${ 
                currentUser
                    ? `<button class="pill secondary ${addFriendGateBtnClass}" data-email="${email}">Gurme ekle</button>`
                : `<p class="muted-text tiny">Gormek icin once giris yap ve gurme ekle.</p>`
            }
        `;
        if (friendFollowingList) {
            friendFollowingList.classList.add("empty");
            friendFollowingList.textContent = "Bu hesap kapali.";
        }
        friendBioEl && (friendBioEl.textContent = "Kapali hesap");
        if (friendFollowersList) {
            friendFollowersList.classList.add("empty");
            friendFollowersList.textContent = "Bu hesap kapali.";
        }
        friendPanel.classList.remove("hidden");
        friendPanel.classList.add("visible");
        detailPanel.classList.remove("visible");
        detailPanel.classList.add("hidden");
        hideProfilePanel();
        return;
    }
    friendBioEl && (friendBioEl.textContent = targetUser?.isPrivate ? "Kapali hesap (gurmelerin gorebilir)" : "Acik hesap");

    // Following list
    if (friendFollowingList) {
        friendFollowingList.innerHTML = "";
        const list = targetUser?.following || [];
        if (!list.length) {
            friendFollowingList.classList.add("empty");
            friendFollowingList.textContent = "Gurme yok.";
        } else {
            friendFollowingList.classList.remove("empty");
            list.forEach((mail) => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "friend-chip friend-follow-chip";
                chip.dataset.email = mail;
                const avatar = document.createElement("div");
                avatar.className = "friend-avatar";
                avatar.textContent = getUserUsername(mail).charAt(0).toUpperCase();
                const meta = document.createElement("div");
                meta.className = "friend-meta";
                const name = document.createElement("span");
                name.className = "friend-name";
                name.textContent = getUserUsername(mail);
                const note = document.createElement("span");
                note.className = "friend-note";
                note.textContent = formatHandle(mail);
                meta.appendChild(name);
                meta.appendChild(note);
                chip.appendChild(avatar);
                chip.appendChild(meta);
                friendFollowingList.appendChild(chip);
            });
        }
    }

    // Followers list
    if (friendFollowersList) {
        friendFollowersList.innerHTML = "";
        const list = targetUser?.followers || [];
        if (!list.length) {
            friendFollowersList.classList.add("empty");
            friendFollowersList.textContent = "Mudavim yok.";
        } else {
            friendFollowersList.classList.remove("empty");
            list.forEach((mail) => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "friend-chip friend-follow-chip";
                chip.dataset.email = mail;
                const avatar = document.createElement("div");
                avatar.className = "friend-avatar";
                avatar.textContent = getUserUsername(mail).charAt(0).toUpperCase();
                const meta = document.createElement("div");
                meta.className = "friend-meta";
                const name = document.createElement("span");
                name.className = "friend-name";
                name.textContent = getUserUsername(mail);
                const note = document.createElement("span");
                note.className = "friend-note";
                note.textContent = formatHandle(mail);
                meta.appendChild(name);
                meta.appendChild(note);
                chip.appendChild(avatar);
                chip.appendChild(meta);
                friendFollowersList.appendChild(chip);
            });
        }
    }

    const collected = [];
    Object.entries(reviews).forEach(([placeId, revs]) => {
        revs.forEach((rev) => {
            if (rev.userEmail === email) {
                const place = places.find((p) => p.id === placeId);
                collected.push({ ...rev, placeName: place?.name || placeId });
            }
        });
    });
    friendTitle.textContent = getUserUsername(email);
    if (!collected.length) {
        friendReviewsList.classList.add("empty");
        friendReviewsList.textContent = "Bu gurmenin yorumu yok.";
        friendPanel.classList.remove("hidden");
        friendPanel.classList.add("visible");
        detailPanel.classList.remove("visible");
        detailPanel.classList.add("hidden");
        hideProfilePanel();
        return;
    }
    friendReviewsList.classList.remove("empty");
    collected.forEach((rev) => {
        const item = document.createElement("div");
        item.className = "review-item";
        const ratings = [...rev.ratings, ...rev.customRatings];
        item.innerHTML = `
            <strong>${rev.placeName}</strong>
            <p>${rev.comment || "Yorum yok"}</p>
            <div class="review-meta">
                ${ratings.map((r) => `<span class="tag">${r.label}: ${r.value}/5</span>`).join("")}
            </div>
        `;
        friendReviewsList.appendChild(item);
    });
    friendPanel.classList.remove("hidden");
    friendPanel.classList.add("visible");
    detailPanel.classList.remove("visible");
    detailPanel.classList.add("hidden");
    hideProfilePanel();
}

function getPendingNotificationCount() {
    if (!currentUser) return 0;
    const pendingEvents = events.filter(
        (evt) =>
            evt.visibility === "private" &&
            (evt.allowedEmails || []).includes(currentUser) &&
            !(evt.participants || []).includes(currentUser)
    );
    const pendingFriend = friendRequests[currentUser] || [];
    return pendingEvents.length + pendingFriend.length;
}

function updateNotificationBadge() {
    if (!notificationDot) return;
    const count = getPendingNotificationCount();
    notificationDot.classList.toggle("hidden", count === 0);
}

function renderNotifications() {
    if (!notificationList) return;
    notificationList.innerHTML = "";
    if (!currentUser) {
        notificationList.classList.add("empty");
        notificationList.textContent = "Giris yapmadin.";
        updateNotificationBadge();
        return;
    }
    const pendingEvents = events.filter(
        (evt) =>
            evt.visibility === "private" &&
            (evt.allowedEmails || []).includes(currentUser) &&
            !(evt.participants || []).includes(currentUser)
    );
    const pendingFriend = friendRequests[currentUser] || [];
    if (!pendingEvents.length && !pendingFriend.length) {
        notificationList.classList.add("empty");
        notificationList.textContent = "Bildirim yok.";
        updateNotificationBadge();
        return;
    }
    notificationList.classList.remove("empty");
    pendingEvents.forEach((evt) => {
        const item = document.createElement("div");
        item.className = "notif-item";
        item.dataset.evtId = evt.id;
        item.innerHTML = `
            <p><strong>${formatHandle(evt.createdBy)}</strong> seni bu etkinlige davet ediyor: <em>${evt.title}</em></p>
            <div class="notif-actions">
                <button class="pill primary accept-invite" data-evt="${evt.id}">Kabul et</button>
                <button class="pill ghost decline-invite" data-evt="${evt.id}">Reddet</button>
            </div>
        `;
        notificationList.appendChild(item);
    });
    pendingFriend.forEach((req) => {
        const item = document.createElement("div");
        item.className = "notif-item";
        item.dataset.friendEmail = req;
        item.innerHTML = `
            <p><strong>${formatHandle(req)}</strong> seni gurmelerine eklemek istiyor.</p>
            <div class="notif-actions">
                <button class="pill primary accept-friend" data-email="${req}">Onayla</button>
                <button class="pill ghost decline-friend" data-email="${req}">Reddet</button>
            </div>
        `;
        notificationList.appendChild(item);
    });
    updateNotificationBadge();
}

function acceptFriendRequest(requesterEmail) {
    if (!currentUser) return;
    friendRequests[currentUser] = (friendRequests[currentUser] || []).filter((r) => r !== requesterEmail);
    saveFriendRequests();
    const requester = users[requesterEmail];
    if (requester) {
        requester.following = requester.following || [];
        requester.followers = requester.followers || [];
        if (!requester.following.includes(currentUser)) requester.following.push(currentUser);
        const me = users[currentUser];
        me.followers = me.followers || [];
        if (!me.followers.includes(requesterEmail)) me.followers.push(requesterEmail);
        users[currentUser] = me;
        users[requesterEmail] = requester;
        saveUsers();
    }
    renderNotifications();
    updateNotificationBadge();
    updateConnectionCounts();
    showToast("Gurme istegi onaylandi");
}

function declineFriendRequest(requesterEmail) {
    if (!currentUser) return;
    friendRequests[currentUser] = (friendRequests[currentUser] || []).filter((r) => r !== requesterEmail);
    saveFriendRequests();
    renderNotifications();
    updateNotificationBadge();
    showToast("Gurme istegi reddedildi");
}

function positionNotificationPanel() {
    if (!notificationPanel || !notificationButton) return;
    const rect = notificationButton.getBoundingClientRect();
    const width = 280;
    let left = rect.left;
    if (left + width + 12 > window.innerWidth) {
        left = window.innerWidth - width - 12;
    }
    notificationPanel.style.left = `${left}px`;
    notificationPanel.style.top = `${rect.bottom + 8}px`;
}

function hideNotificationPanel() {
    if (!notificationPanel) return;
    notificationPanel.classList.add("hidden");
}

function createCriteriaInputs() {
    criteriaInputs.innerHTML = "";
    baseCriteria.forEach((label) => {
        const row = document.createElement("div");
        row.className = "criteria-row";
        row.innerHTML = `
            <span>${label}</span>
            <input type="range" min="1" max="5" value="3" data-criterion="${label}">
            <span class="value">3</span>
        `;
        const range = row.querySelector("input");
        const value = row.querySelector(".value");
        range.addEventListener("input", () => (value.textContent = range.value));
        criteriaInputs.appendChild(row);
    });
}

function addCustomCriterionRow() {
    const row = document.createElement("div");
    row.className = "custom-row";
    row.innerHTML = `
        <input type="text" placeholder="Orn: Wi-Fi" class="custom-label">
        <input type="range" min="1" max="5" value="3" class="custom-range">
        <span class="value">3</span>
    `;
    const range = row.querySelector(".custom-range");
    const value = row.querySelector(".value");
    range.addEventListener("input", () => (value.textContent = range.value));
    customCriteria.appendChild(row);
}

function clearCustomCriteria() {
    customCriteria.innerHTML = "";
}


async function centerOnUser() {
    showToast("Konum aliniyor...");
    try {
        const coords = await ensureUserLocation();
        map.setView([coords.lat, coords.lng], 15);
        L.marker([coords.lat, coords.lng]).addTo(map).bindPopup("Buradasin").openPopup();
        showToast("Konum bulundu.");
    } catch (err) {
        showToast("Konum alinamadi: " + err.message);
    }
}

btnKonum.addEventListener("click", () => centerOnUser());


document.addEventListener("DOMContentLoaded", () => {
    // Leaflet haritasi initialize et
    if (typeof L !== "undefined") {
        map = L.map("map", { zoomControl: false }).setView([41.015137, 28.97953], 13);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);
        L.control.zoom({ position: "topright" }).addTo(map);
    } else {
        console.error("Leaflet (L) is not defined. Make sure Leaflet script is loaded before script.js");
    }
    
    loadUsers();
    loadReviews();
    loadSession();
    loadEvents();
    loadFriendRequests();
    updateAuthUI();
    createCriteriaInputs();
    renderEventOptions();
    renderNotifications();
    
    // Sayfa yuklenince sadece konumu al (arama tetiklemeden)
    centerOnUser();
});



closeDetail.addEventListener("click", () => {
    detailPanel.classList.remove("visible");
    detailPanel.classList.add("hidden");
    hideNotificationPanel();
});
closeResults?.addEventListener("click", hideResultsPanel);

function hideProfilePanel() {
    profilePanel.classList.remove("visible");
    profilePanel.classList.add("hidden");
    connectionsSection?.classList.add("hidden");
}

function toggleProfilePanel(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : profilePanel.classList.contains("hidden");
    if (shouldOpen) {
        detailPanel.classList.remove("visible");
        detailPanel.classList.add("hidden");
        friendPanel.classList.remove("visible");
        friendPanel.classList.add("hidden");
        profilePanel.classList.remove("hidden");
        profilePanel.classList.add("visible");
        setEventPanel(false);
        hideNotificationPanel();
    } else {
        hideProfilePanel();
    }
}

function setEventPanel(open = true) {
    if (!eventPanel) return;
    if (open) {
        eventPanel.classList.remove("collapsed");
        hideProfilePanel();
        detailPanel.classList.add("hidden");
        detailPanel.classList.remove("visible");
        friendPanel.classList.add("hidden");
        friendPanel.classList.remove("visible");
        hideNotificationPanel();
    } else {
        eventPanel.classList.add("collapsed");
    }
}

function openSearch(mode = "map") {
    searchMode = mode;
    if (!searchOverlay) return;
    searchOverlay.classList.remove("collapsed");
    const placeholder = mode === "event" ? "Etkinlik icin mekan ara" : "Mekan ara";
    placeSearchInput.placeholder = placeholder;
    placeSearchInput.value = "";
    placeSearchInput.focus();
    clearSuggestions();
}

function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add("collapsed");
    clearSuggestions();
}

function isSearchOpen() {
    return searchOverlay && !searchOverlay.classList.contains("collapsed");
}

function clearSuggestions() {
    if (!searchSuggestions) return;
    if (suggestionTimer) {
        clearTimeout(suggestionTimer);
        suggestionTimer = null;
    }
    suggestionSeq++;
    searchSuggestions.innerHTML = "";
    searchSuggestions.classList.add("hidden");
}

function requestLiveSuggestions(query) {
    if (!searchSuggestions) return;
    const q = (query || "").trim();
    if (!q) {
        clearSuggestions();
        return;
    }
    if (suggestionTimer) clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(async () => {
        const seq = ++suggestionSeq;
        try {
            const center = map.getCenter();
            const items = await fetchAllDiscover(q, {
                lat: center.lat,
                lng: center.lng,
                radius: 2000,
                limit: 6
            });
            if (seq !== suggestionSeq) return;
            const normalized = items.map(normalizeHereItem).filter(Boolean).slice(0, 5);
            renderSuggestions(normalized);
        } catch (err) {
            if (seq !== suggestionSeq) return;
            console.warn("Live suggestion failed:", err);
            clearSuggestions();
        }
    }, 200);
}

function renderSuggestions(list) {
    if (!searchSuggestions) return;
    clearSuggestions();
    if (!list.length) return;
    list.forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggest-item";
        btn.textContent = p.name;
        btn.addEventListener("click", () => {
            placeSearchInput.value = p.name;
            if (searchMode === "event") {
                setEventLocation({ lat: p.coords[0], lng: p.coords[1] }, p);
                pickingLocation = false;
                showToast(`${p.name} etkinlik konumu olarak secildi`);
            } else {
                map.setView(p.coords, 16);
                renderPlaceDetail(p);
                currentPlaceId = p.id;
            }
            closeSearch();
            clearSuggestions();
        });
        searchSuggestions.appendChild(btn);
    });
    searchSuggestions.classList.remove("hidden");
}

reviewForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) {
        showToast("Yorum icin giris yapmalisin.");
        openAuthModal("login");
        return;
    }

    const placeId = reviewForm.dataset.placeId;
    if (!placeId) return;

    const ratings = Array.from(criteriaInputs.querySelectorAll("input[type='range']")).map((input) => ({
        label: input.dataset.criterion,
        value: Number(input.value)
    }));

    const customRatings = Array.from(customCriteria.querySelectorAll(".custom-row"))
        .map((row) => {
            const labelInput = row.querySelector(".custom-label");
            const rangeInput = row.querySelector(".custom-range");
            return { label: labelInput.value.trim(), value: Number(rangeInput.value) };
        })
        .filter((c) => c.label);

    const comment = (document.getElementById("comment").value || "").trim();

    reviews[placeId] = reviews[placeId] || [];
    reviews[placeId].push({
        id: `rev-${Date.now()}`,
        comment,
        ratings,
        customRatings,
        userEmail: currentUser,
        createdAt: Date.now()
    });

    saveReviews();
    document.getElementById("comment").value = "";
    createCriteriaInputs();
    clearCustomCriteria();
    updateReviewsList(placeId);
    updateMyReviews();
    showToast("Yorum eklendi");
});

function removeReview(placeId, reviewId) {
    if (!placeId || !reviewId) return;
    const list = reviews[placeId] || [];
    const filtered = list.filter(
        (rev) =>
            rev.id !== reviewId &&
            String(rev.id || "") !== String(reviewId) &&
            String(rev.createdAt || "") !== String(reviewId)
    );
    reviews[placeId] = filtered;
    saveReviews();
    updateReviewsList(placeId);
    updateMyReviews();
    showToast("Yorum silindi");
}

function attachReviewRemoval(container) {
    container?.addEventListener("click", (e) => {
        const btn = e.target.closest(".remove-confirm");
        if (!btn) return;
        const rid = btn.dataset.reviewId;
        const pid = btn.dataset.placeId;
        removeReview(pid, rid);
    });
    container?.addEventListener("contextmenu", (e) => {
        const item = e.target.closest(".owned-review");
        if (!item) return;
        e.preventDefault();
        container.querySelectorAll(".remove-confirm").forEach((b) => b.remove());
        const rid = item.dataset.reviewId;
        const pid = item.dataset.placeId || item.closest(".review-item")?.dataset.placeId;
        if (!rid || !pid) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "remove-confirm";
        btn.textContent = "Sil";
        btn.dataset.reviewId = rid;
        btn.dataset.placeId = pid;
        item.appendChild(btn);
    });
}

addCriterionBtn.addEventListener("click", addCustomCriterionRow);

avatarUploadBtn?.addEventListener("click", () => {
    if (!currentUser) {
        showToast("Once giris yap.");
        openAuthModal("login");
        return;
    }
    avatarInput?.click();
});

profileAvatarLarge?.addEventListener("click", () => {
    if (!currentUser) {
        showToast("Once giris yap.");
        openAuthModal("login");
        return;
    }
    avatarInput?.click();
});

avatarInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarFile(file);
    avatarInput.value = "";
});

attachReviewRemoval(reviewsList);
attachReviewRemoval(myReviewsList);

// Stats now static; drag interaction removed

profileButton.addEventListener("click", () => {
    if (!currentUser) {
        openAuthModal("login");
    } else {
        const willOpen = profilePanel.classList.contains("hidden");
        if (willOpen) {
            setEventPanel(false);
            detailPanel.classList.remove("visible");
            detailPanel.classList.add("hidden");
            friendPanel.classList.remove("visible");
            friendPanel.classList.add("hidden");
            hideNotificationPanel();
        }
        toggleProfilePanel(willOpen);
    }
});

closeProfile.addEventListener("click", () => toggleProfilePanel(false));

signOutBtn.addEventListener("click", () => {
    currentUser = null;
    saveSession();
    updateAuthUI();
    friendEventLayerEnabled = false;
    if (toggleFriendEventsBtn) {
        toggleFriendEventsBtn.classList.remove("ghost");
        toggleFriendEventsBtn.classList.add("secondary");
    }
    renderEventMarkers();
    renderEventList();
    toggleProfilePanel(false);
    friendPanel.classList.remove("visible");
    friendPanel.classList.add("hidden");
    showToast("Cikis yapildi");
});

authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const usernameVal = usernameInput.value.trim().toLowerCase();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    if (authMode !== "login" && (!email || !password || !usernameVal)) {
        showToast("Kullanici adi, e-posta ve sifre gerekli.");
        return;
    }
    if (authMode === "login" && (!email || !password)) {
        showToast("E-posta ve sifre gerekli.");
        return;
    }
    if (authMode === "login") {
        const user = users[email];
        if (!user || user.password !== password) {
            showToast("E-posta veya sifre hatali.");
            return;
        }
        const storedUsername = (user.username || "").toLowerCase();
        if (storedUsername && usernameVal && storedUsername !== usernameVal) {
            showToast("Kullanici adi eslesmedi.");
            return;
        }
        currentUser = email;
        saveSession();
        if (!storedUsername) {
            forceUsernameSelection(email);
        }
        updateAuthUI();
        closeAuthModal();
        showToast("Hos geldin!");
    } else {
        if (users[email]) {
            showToast("Bu e-posta kayitli.");
            return;
        }
        const takenSame = Object.values(users).some(
            (u) => (u.username || "").toLowerCase() === usernameVal
        );
        if (takenSame) {
            showToast("Bu kullanici adi alinmis.");
            return;
        }
        users[email] = { password, following: [], followers: [], isPrivate: false, username: usernameVal };
        saveUsers();
        currentUser = email;
        saveSession();
        updateAuthUI();
        closeAuthModal();
        showToast("Kayit olundu.");
    }
});

addFriendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) {
        showToast("Once giris yapmalisin.");
        openAuthModal("login");
        return;
    }
    const friendId = friendIdentifierInput.value.trim();
    if (!friendId) return;
    attemptAddFriend(friendId);
    friendIdentifierInput.value = "";
});

connectionsList?.addEventListener("click", (e) => {
    const nameBtn = e.target.closest(".friend-name");
    if (nameBtn) {
        renderFriendPanel(nameBtn.dataset.email);
        return;
    }
    const removeBtn = e.target.closest(".remove-confirm");
    if (removeBtn) {
        const email = removeBtn.dataset.email;
        const view = removeBtn.dataset.view;
        const isFollowersView = view === "followers";
        removeConnection(email, isFollowersView);
        removeBtn.remove();
        return;
    }
});

connectionsList?.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".friend-chip");
    if (!item || !currentUser) return;
    e.preventDefault();
    // temizle
    connectionsList.querySelectorAll(".remove-confirm").forEach((btn) => btn.remove());
    const email = item.querySelector(".friend-name")?.dataset.email;
    if (!email || email === currentUser) return;
    const isFollowersView = connectionsTitle.textContent.includes("Mudavim");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-confirm";
    btn.textContent = "Kaldir";
    btn.dataset.email = email;
    btn.dataset.view = isFollowersView ? "followers" : "following";
    item.appendChild(btn);
});

openConnectionSearch?.addEventListener("click", () => {
    connectionSearchBox?.classList.toggle("hidden");
    if (!connectionSearchBox?.classList.contains("hidden")) {
        connectionSearchInput?.focus();
    } else {
        connectionSuggestions?.classList.add("hidden");
    }
});

connectionSearchInput?.addEventListener("input", () => {
    const query = (connectionSearchInput.value || "").trim().toLowerCase();
    if (!query) {
        connectionSuggestions?.classList.add("hidden");
        connectionSuggestions.innerHTML = "";
        return;
    }
    const matches = Object.entries(users)
        .filter(([email, data]) => (data.username || "").toLowerCase().includes(query))
        .slice(0, 6);
    connectionSuggestions.innerHTML = "";
    if (!matches.length) {
        connectionSuggestions.classList.add("hidden");
        return;
    }
    matches.forEach(([email, data]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${data.username || email}`;
        btn.addEventListener("click", () => {
            renderFriendPanel(email);
            connectionSuggestions.classList.add("hidden");
        });
        connectionSuggestions.appendChild(btn);
    });
    connectionSuggestions.classList.remove("hidden");
});

friendIdentifierInput?.addEventListener("input", () => {
    const query = (friendIdentifierInput.value || "").trim().toLowerCase();
    if (!query) {
        friendSuggestions?.classList.add("hidden");
        friendSuggestions && (friendSuggestions.innerHTML = "");
        return;
    }
    const matches = Object.entries(users)
        .filter(
            ([email, data]) =>
                (data.username || "").toLowerCase().includes(query) || (email || "").toLowerCase().includes(query)
        )
        .slice(0, 6);
    friendSuggestions && (friendSuggestions.innerHTML = "");
    if (!matches.length) {
        friendSuggestions?.classList.add("hidden");
        return;
    }
    matches.forEach(([email, data]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${data.username || email}`;
        btn.addEventListener("click", () => {
            friendIdentifierInput.value = data.username || email;
            attemptAddFriend(email);
            friendSuggestions?.classList.add("hidden");
        });
        friendSuggestions?.appendChild(btn);
    });
    friendSuggestions?.classList.remove("hidden");
});

function removeConnection(email, isFollowersView) {
    if (!currentUser || !email) return;
    if (isFollowersView) {
        users[currentUser].followers = (users[currentUser].followers || []).filter((f) => f !== email);
        if (users[email]) {
            users[email].following = (users[email].following || []).filter((f) => f !== currentUser);
        }
    } else {
        users[currentUser].following = (users[currentUser].following || []).filter((f) => f !== email);
        if (users[email]) {
            users[email].followers = (users[email].followers || []).filter((f) => f !== currentUser);
        }
    }
    saveUsers();
    updateConnectionCounts();
    showConnections(isFollowersView ? "followers" : "following");
    showToast(isFollowersView ? "Müdavim kaldirildi" : "Gurmeden kaldirildi");
}

friendReviewsList?.addEventListener("click", (e) => {
    if (e.target.classList.contains(addFriendGateBtnClass)) {
        attemptAddFriend(e.target.dataset.email);
    }
});

function canSeePrivateLists(targetEmail) {
    const target = users[targetEmail];
    if (!target) return false;
    if (!target.isPrivate) return true;
    if (!currentUser) return false;
    if (currentUser === targetEmail) return true;
    return (target.followers || []).includes(currentUser);
}

friendFollowingList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".friend-follow-chip");
    if (!btn || !btn.dataset.email) return;
    const targetEmail = friendHandleEl?.textContent?.replace("@", "") || "";
    if (!canSeePrivateLists(targetEmail)) return;
    renderFriendPanel(btn.dataset.email);
});

friendFollowersList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".friend-follow-chip");
    if (!btn || !btn.dataset.email) return;
    const targetEmail = friendHandleEl?.textContent?.replace("@", "") || "";
    if (!canSeePrivateLists(targetEmail)) return;
    renderFriendPanel(btn.dataset.email);
});

reviewsList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".review-user");
    if (!btn) return;
    const email = btn.dataset.email;
    if (!email) return;
    renderFriendPanel(email);
});

closeFriend.addEventListener("click", () => {
    friendPanel.classList.remove("visible");
    friendPanel.classList.add("hidden");
});

toggleAuthMode.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    openAuthModal(authMode);
});

closeAuth.addEventListener("click", closeAuthModal);

openSettingsBtn?.addEventListener("click", () => {
    if (!currentUser) {
        showToast("Ayarlar icin giris yap.");
        return;
    }
    settingsPanel?.classList.toggle("hidden");
});

accountPrivacyToggle?.addEventListener("change", () => {
    if (!currentUser) return;
    const me = users[currentUser];
    me.isPrivate = !accountPrivacyToggle.checked;
    users[currentUser] = me;
    saveUsers();
    updatePrivacyUI();
    showToast(me.isPrivate ? "Hesap kapali modda." : "Hesap acik modda.");
});

btnFollowers?.addEventListener("click", () => showConnections("followers"));
btnFollowing?.addEventListener("click", () => showConnections("following"));
closeConnections?.addEventListener("click", () => connectionsSection?.classList.add("hidden"));

notificationButton?.addEventListener("click", () => {
    if (!notificationPanel) return;
    if (notificationPanel.classList.contains("hidden")) {
        positionNotificationPanel();
        notificationPanel.classList.remove("hidden");
        renderNotifications();
        // diger panelleri kapat
        setEventPanel(false);
        toggleProfilePanel(false);
        detailPanel.classList.add("hidden");
        friendPanel.classList.add("hidden");
    } else {
        hideNotificationPanel();
    }
});

closeNotification?.addEventListener("click", () => notificationPanel.classList.add("hidden"));

notificationList?.addEventListener("click", (e) => {
    if (e.target.classList.contains("accept-friend")) {
        const requester = e.target.dataset?.email;
        if (requester) acceptFriendRequest(requester);
        return;
    }
    if (e.target.classList.contains("decline-friend")) {
        const requester = e.target.dataset?.email;
        if (requester) declineFriendRequest(requester);
        return;
    }
    const evtId = e.target.dataset?.evt;
    if (!evtId) return;
    const evt = events.find((x) => x.id === evtId);
    if (!evt || !currentUser) return;
    if (e.target.classList.contains("accept-invite")) {
        evt.participants = evt.participants || [];
        if (!evt.participants.includes(currentUser)) evt.participants.push(currentUser);
        evt.allowedEmails = (evt.allowedEmails || []).filter((m) => m !== currentUser);
        saveEvents();
        renderNotifications();
        renderEventList();
        updateMyEvents();
        showToast("Davet kabul edildi");
    }
    if (e.target.classList.contains("decline-invite")) {
        evt.allowedEmails = (evt.allowedEmails || []).filter((m) => m !== currentUser);
        saveEvents();
        renderNotifications();
        showToast("Davet reddedildi");
    }
});

placeSearchBtn?.addEventListener("click", handlePlaceSearch);
placeSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handlePlaceSearch();
    }
});
placeSearchInput?.addEventListener("input", (e) => {
    requestLiveSuggestions(e.target.value || "");
});

openSearchBtn?.addEventListener("click", () => {
    if (isSearchOpen()) closeSearch();
    else openSearch("map");
});
eventSearchBtn?.addEventListener("click", () => {
    if (isSearchOpen()) closeSearch();
    else openSearch("event");
});


function handlePlaceSearch() {
    const query = (placeSearchInput.value || "").trim().toLowerCase();
    if (!query) return;

    const isEventSearch = searchMode === 'event';
    const searchOptions = isEventSearch 
        ? {} // For events, use default (near user)
        : { lat: ISTANBUL_CENTER.lat, lng: ISTANBUL_CENTER.lng, radius: ISTANBUL_RADIUS };

    if (!isEventSearch) {
        showToast(`'${query}' için İstanbul genelinde aranıyor...`);
    }

    loadPlaces(query, searchOptions)
        .then((visible) => {
            if (!visible || !visible.length) {
                showToast("Eşleşen mekan bulunamadı");
                return;
            }
            if (isEventSearch) {
                const firstPlace = visible[0];
                setEventLocation({ lat: firstPlace.coords[0], lng: firstPlace.coords[1] }, firstPlace);
                pickingLocation = false;
                showToast(`${firstPlace.name} etkinlik konumu olarak seçildi`);
            }
            // For map search, loadPlaces already handles the UI updates.
        })
        .catch((err) => showToast(err.message || "Arama yapılamadı"))
        .finally(() => {
            closeSearch();
            clearSuggestions();
        });
}

// Override handlePlaceSearch to prefetch GPT labels for search button
function handlePlaceSearch() {
    const query = (placeSearchInput.value || "").trim().toLowerCase();
    if (!query) return;

    const isEventSearch = searchMode === "event";
    const searchOptions = isEventSearch
        ? {}
        : { lat: ISTANBUL_CENTER.lat, lng: ISTANBUL_CENTER.lng, radius: ISTANBUL_RADIUS };

    if (!isEventSearch) {
        showToast(`'${query}' için İstanbul genelinde aranıyor...`);
    }

    loadPlaces(query, searchOptions)
        .then((visible) => {
            if (!visible || !visible.length) {
                showToast("Eşleşen mekan bulunamadı");
                return;
            }
            // AI analizi artık page.tsx'de yönetiliyor (handleSearch içinde)
            // prefetchLabelsForPlaces çağrısı devre dışı bırakıldı
            if (!isEventSearch && typeof prefetchLabelsForPlaces === "function") {
                console.log("[script.js] prefetchLabelsForPlaces çağrıldı ama devre dışı - AI analizi page.tsx'de yönetiliyor");
                // prefetchLabelsForPlaces(visible); // Devre dışı
            }
            if (isEventSearch) {
                const firstPlace = visible[0];
                setEventLocation({ lat: firstPlace.coords[0], lng: firstPlace.coords[1] }, firstPlace);
                pickingLocation = false;
                showToast(`${firstPlace.name} etkinlik konumu olarak seçildi`);
            }
        })
        .catch((err) => showToast(err.message || "Arama yapılamadı"))
        .finally(() => {
            closeSearch();
            clearSuggestions();
        });
}

// Export global variables for filtreleme.js and other modules
if (typeof window !== 'undefined') {
    window.CATEGORY_KEYWORDS = CATEGORY_KEYWORDS;
    window.CATEGORY_SEARCH_TERMS = CATEGORY_SEARCH_TERMS;
    window.GOOGLE_TYPE_MAP = GOOGLE_TYPE_MAP;
    window.criterionOptions = criterionOptions;
    // Export functions that might be needed
    if (typeof loadPlaces !== 'undefined') {
        window.loadPlaces = loadPlaces;
    }
    if (typeof showToast !== 'undefined') {
        window.showToast = showToast;
    }
    if (typeof map !== 'undefined') {
        window.map = map;
    }
    if (typeof ensureUserLocation !== 'undefined') {
        window.ensureUserLocation = ensureUserLocation;
    }
}
