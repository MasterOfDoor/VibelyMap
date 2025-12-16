(function () {
    // Filtreleme islemleri: secim alma, sorgu olusturma, filtre UI baglantilari.
    const FILTERING_DISABLED = false; // Aktif mod
    const filterForm = document.getElementById("filterForm");
    const filterPanel = document.getElementById("filterPanel");
    const menuToggle = document.getElementById("menuToggle");
    const closeFilter = document.getElementById("closeFilter");
    const applyFiltersBtn = document.getElementById("applyFilters");
    const resetFiltersBtn = document.getElementById("resetFilters");

    function getSelectedFilters() {
        const main = Array.from(filterForm.querySelectorAll(".filter-main.active"))
            .map((b) => b.dataset.criterion)
            .filter((c) => c !== "Kategori"); // kategori ana kriter sayilmasin
        const sub = {};
        Array.from(filterForm.querySelectorAll(".chip-option.active")).forEach((btn) => {
            const crit = btn.dataset.criterion;
            const opt = btn.dataset.option;
            sub[crit] = sub[crit] || [];
            sub[crit].push(opt);
        });
        
        // Range input'ları oku (Isiklandirma ve Oturma için)
        const ranges = {};
        const isiklandirmaRange = filterForm.querySelector('input[type="range"][data-criterion="Isiklandirma"]') || 
                                  filterForm.querySelector('.filter-group[data-criterion="Isiklandirma"] input[type="range"]');
        if (isiklandirmaRange) {
            ranges.Isiklandirma = Number(isiklandirmaRange.value);
        }
        
        const oturmaRange = filterForm.querySelector('input[type="range"][data-criterion="Oturma"]') || 
                            filterForm.querySelector('.filter-group[data-criterion="Oturma"] input[type="range"]');
        if (oturmaRange) {
            ranges.Oturma = Number(oturmaRange.value);
        }
        
        return { main, sub, ranges };
    }

    function buildQueryFromFilters(main, sub) {
        // Google Places'e sadece kategori sorulacak
        // Diğer filtreler (ışıklandırma, fiyat, ambiyans vb.) AI analiziyle gelecek
        // Bu yüzden query'de sadece kategori kullanıyoruz
        const terms = new Set();
        
        // Sadece kategori filtrelerini ekle
        const kategoriOptions = sub.Kategori || [];
        kategoriOptions.forEach((cat) => {
            terms.add(CATEGORY_SEARCH_TERMS[cat] || cat);
        });
        
        return Array.from(terms)
            .filter(Boolean)
            .join(" ")
            .trim();
    }

    function matchesCategoryOption(place, option) {
        const lowOpt = (option || "").toLowerCase();
        const keywords = (CATEGORY_KEYWORDS[option] || []).map((k) => k.toLowerCase());
        const placeCats = (place.subOptions?.Kategori || []).map((c) => c.toLowerCase());
        const placeTags = (place.tags || []).map((t) => t.toLowerCase());
        const haystack = [
            ...placeCats,
            ...placeTags,
            (place.type || "").toLowerCase(),
            (place.name || "").toLowerCase()
        ].filter(Boolean);
        return haystack.some((val) => {
            if (val === lowOpt) return true;
            if (val.includes(lowOpt)) return true;
            return keywords.some((k) => val.includes(k));
        });
    }

    function expandSigaraOptions(opts) {
        const expanded = new Set();
        opts.forEach((o) => {
            const low = (o || "").toLowerCase();
            expanded.add(low);
            // Kapali alanda sigara icilebilir secimi, genel "sigara icilebilir" secimini de kapsasin
            if (low === "kapali alanda sigara icilebilir") {
                expanded.add("sigara icilebilir");
            }
            // Genel sigara secimi yapildiginda, kapali alanda icilebiliyor etiketini de kabul et
            if (low === "sigara icilebilir") {
                expanded.add("kapali alanda sigara icilebilir");
            }
        });
        return Array.from(expanded);
    }

    function matchesFilters(place, main, sub, ranges) {
        // Range filtreleri kontrol et (Isiklandirma ve Oturma)
        if (ranges) {
            // Işıklandırma filtresi (1-5)
            if (ranges.Isiklandirma !== undefined) {
                const placeIsikTag = (place.tags || []).find((tag) => 
                    tag.toLowerCase().includes("ışıklandırma") || tag.toLowerCase().includes("isiklandirma")
                );
                if (placeIsikTag) {
                    // Etiketten sayıyı çıkar: "Işıklandırma 3" -> 3
                    const match = placeIsikTag.match(/\d+/);
                    if (match) {
                        const placeIsikValue = Number(match[0]);
                        // Kullanıcının seçtiği değerden küçük veya eşit olmalı (daha loş = daha yüksek sayı)
                        // Örnek: Kullanıcı 3 seçtiyse, mekan 3, 4 veya 5 olabilir (daha loş veya eşit)
                        if (placeIsikValue < ranges.Isiklandirma) return false;
                    }
                } else {
                    // Etiket yoksa, filtreleme yapma (veri eksik)
                }
            }
            
            // Koltuk filtresi (0-3)
            if (ranges.Oturma !== undefined) {
                const placeKoltukTag = (place.tags || []).find((tag) => 
                    tag.toLowerCase().includes("koltuk")
                );
                if (placeKoltukTag) {
                    // Etiketten sayıyı çıkar veya metin kontrolü yap
                    let placeKoltukValue = -1;
                    const lowerTag = placeKoltukTag.toLowerCase();
                    if (lowerTag.includes("yok")) placeKoltukValue = 0;
                    else if (lowerTag.includes("az")) placeKoltukValue = 1;
                    else if (lowerTag.includes("orta")) placeKoltukValue = 2;
                    else if (lowerTag.includes("var") && !lowerTag.includes("az") && !lowerTag.includes("orta")) placeKoltukValue = 3;
                    
                    const match = placeKoltukTag.match(/\d+/);
                    if (match) {
                        placeKoltukValue = Number(match[0]);
                    }
                    
                    if (placeKoltukValue >= 0) {
                        // Kullanıcının seçtiği değerden küçük veya eşit olmalı
                        // Örnek: Kullanıcı 2 seçtiyse, mekan 2 veya 3 olabilir (daha fazla veya eşit)
                        if (placeKoltukValue < ranges.Oturma) return false;
                    }
                } else {
                    // Etiket yoksa, filtreleme yapma (veri eksik)
                }
            }
        }
        
        const subEntries = Object.entries(sub);
        if (subEntries.length) {
            for (const [crit, opts] of subEntries) {
                if (crit === "Sigara" && (!opts || !opts.length)) {
                    // Sigara filtresi secilmediyse GPT'den gelen sigara etiketlerine bakma
                    continue;
                }
                // Isiklandirma ve Oturma range ile kontrol edildi, burada atla
                if (crit === "Isiklandirma" || crit === "Oturma") {
                    continue;
                }
                const placeOpts = (place.subOptions && place.subOptions[crit]) || [];
                let match = false;
                if (crit === "Kategori") {
                    match = opts.some((o) => matchesCategoryOption(place, o));
                } else {
                    const effectiveOpts = crit === "Sigara" ? expandSigaraOptions(opts) : opts;
                    const lowerOpts = placeOpts.map((o) => o.toLowerCase());
                    const lowerTags = (place.tags || []).map((t) => t.toLowerCase());
                    const lowerFeats = (place.features || []).map((f) => f.toLowerCase());
                    match = effectiveOpts.some((o) => {
                        const low = (o || "").toLowerCase();
                        return lowerOpts.includes(low) || lowerTags.includes(low) || lowerFeats.includes(low);
                    });
                    // If the place lacks data for this criterion, don't eliminate it.
                    if (!match && !placeOpts.length) match = true;
                }
                if (!match) return false;
            }
        }
        return true;
    }

    function resetFiltersUI() {
        filterPanel.classList.remove("open");
        filterForm.querySelectorAll(".filter-main.active").forEach((btn) => btn.classList.remove("active"));
        filterForm.querySelectorAll(".chip-option.active").forEach((btn) => btn.classList.remove("active"));
        filterForm.querySelectorAll(".filter-group.open").forEach((group) => group.classList.remove("open"));
        // Range input'ları sıfırla
        const isiklandirmaRange = filterForm.querySelector('input[type="range"][data-criterion="Isiklandirma"]') || 
                                  filterForm.querySelector('.filter-group[data-criterion="Isiklandirma"] input[type="range"]');
        if (isiklandirmaRange) {
            isiklandirmaRange.value = "3";
            const valueSpan = isiklandirmaRange.parentElement?.querySelector(".value");
            if (valueSpan) valueSpan.textContent = "3";
        }
        const oturmaRange = filterForm.querySelector('input[type="range"][data-criterion="Oturma"]') || 
                            filterForm.querySelector('.filter-group[data-criterion="Oturma"] input[type="range"]');
        if (oturmaRange) {
            oturmaRange.value = "0";
            const valueSpan = oturmaRange.parentElement?.querySelector(".value");
            if (valueSpan) valueSpan.textContent = "0";
        }
    }

    async function prefetchLabelsForPlaces(list) {
        if (!Array.isArray(list) || !list.length || typeof ensurePlaceLabels !== "function") return;
        const results = await Promise.allSettled(list.map((p) => ensurePlaceLabels(p)));

        if (typeof applyPlaceLabels !== "function") return;

        results.forEach((res, idx) => {
            const place = list[idx];
            if (!place) return;

            if (res.status === "fulfilled" && res.value?.labels?.length) {
                applyPlaceLabels(place, res.value.labels, res.value.clears);
                return;
            }

            if (typeof getCachedPlaceLabels === "function") {
                const cached = getCachedPlaceLabels(place.id);
                if (cached?.labels?.length) {
                    applyPlaceLabels(place, cached.labels, cached.clears);
                }
            }
        });
    }

    function initFilterUI() {
        menuToggle?.addEventListener("click", () => filterPanel.classList.toggle("open"));
        closeFilter?.addEventListener("click", () => filterPanel.classList.remove("open"));

        const singleSelectCriteria = new Set(["Isiklandirma", "Ambiyans", "Oturma"]); // Priz artık range input

        filterForm?.addEventListener("click", (e) => {
            const mainBtn = e.target.closest(".filter-main");
            const chipBtn = e.target.closest(".chip-option");
            if (mainBtn) {
                const group = mainBtn.closest(".filter-group");
                group.classList.toggle("open");
                mainBtn.classList.toggle("active");
            }
            if (chipBtn) {
                const crit = chipBtn.dataset.criterion;
                if (singleSelectCriteria.has(crit)) {
                    const wasActive = chipBtn.classList.contains("active");
                    chipBtn.closest(".sub-options")
                        ?.querySelectorAll(".chip-option.active")
                        .forEach((btn) => btn.classList.remove("active"));
                    if (wasActive) return;
                    chipBtn.classList.add("active");
                    return;
                }
                chipBtn.classList.toggle("active");
            }
        });

        applyFiltersBtn?.addEventListener("click", async () => {
            const { main, sub, ranges } = getSelectedFilters();
            const hasFilters = main.length || Object.keys(sub).length || (ranges && Object.keys(ranges).length > 0);
            const selectedCategories = sub.Kategori || [];
            if (!selectedCategories.length) {
                showToast("Lutfen kategori sec.");
                return;
            }
            if (!hasFilters) {
                showToast("En az bir filtre secmelisin.");
                return;
            }
            const query = buildQueryFromFilters(main, sub);
            if (!query) {
                showToast("Gecerli bir filtre secimi yap.");
                return;
            }
            const googleType = selectedCategories.length === 1 ? (GOOGLE_TYPE_MAP[selectedCategories[0]] || "") : "";
            const isKafe = selectedCategories.includes("Kafe");
            
            // Kullanıcının konumunu al (öncelikle kullanıcı konumu, yoksa harita merkezi)
            // ensureUserLocation fonksiyonu script.js'te tanımlı
            let center;
            if (typeof ensureUserLocation === "function") {
                try {
                    center = await ensureUserLocation();
                } catch (err) {
                    center = map.getCenter();
                }
            } else {
                center = map.getCenter();
            }
            
            const opts = {
                lat: center.lat,
                lng: center.lng,
                radius: 3000, // 3km yarıçap - yakındaki tüm eşleşen sonuçlar
                // type parametresini kaldırdık - sadece query kullanıyoruz
                // Limit kaldırıldı - tüm eşleşen sonuçlar alınacak
            };
            loadPlaces(query, opts)
                .then((visible) => {
                    if (!visible || !visible.length) {
                        showToast("Sonuc bulunamadi.");
                        return;
                    }
                    // Range filtrelerini de uygula
                    if (ranges && Object.keys(ranges).length > 0) {
                        visible = visible.filter((place) => matchesFilters(place, main, sub, ranges));
                    }
                    
                    // Diğer filtreler var mı kontrol et (Kategori dışında)
                    const otherFilters = Object.keys(sub).filter(
                        (key) => key !== "Kategori" && sub[key].length > 0
                    );
                    const hasRangeFilters = ranges && Object.keys(ranges).length > 0;
                    
                    // Sadece kategori seçildiyse analiz yapma (marker tıklamasına ertele)
                    // Diğer filtreler veya range filtreleri varsa analiz yap
                    if (otherFilters.length > 0 || hasRangeFilters) {
                        prefetchLabelsForPlaces(visible);
                    }
                    // Sadece kategori seçildiyse prefetchLabelsForPlaces çağrılmayacak
                    
                    renderEventMarkers?.();
                    renderEventList?.();
                })
                .catch((err) => showToast(err.message || "Filtreli arama basarisiz"))
                .finally(() => {
                    filterPanel.classList.remove("open");
                });
        });

        resetFiltersBtn?.addEventListener("click", () => resetFiltersUI());
    }

    // Globals needed by other moduller
    window.getSelectedFilters = getSelectedFilters;
    window.buildQueryFromFilters = buildQueryFromFilters;
    window.matchesFilters = matchesFilters;
    window.resetFiltersUI = resetFiltersUI;

    document.addEventListener("DOMContentLoaded", initFilterUI);
})();
