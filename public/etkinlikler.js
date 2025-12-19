(function () {
    // Etkinlikler modulu: etkinlik CRUD, liste/marker, mod degisimi, event panel eventleri.
    const EVENTS_DISABLED = true; // Pasif moda al
    const eventOptionsBox = document.getElementById("eventOptions");

    function resetEventLocation() {
        selectedEventLocation = null;
        if (locationPreviewMarker) {
            locationPreviewMarker.remove();
            locationPreviewMarker = null;
        }
        eventLocationLabel.textContent = "Konum secilmedi.";
        selectedEventPlaceId = null;
    }

    function saveEvents() {
        try {
            localStorage.setItem(eventStorageKey, JSON.stringify(events));
        } catch (e) {
            console.warn("Events save failed", e);
        }
    }

    function loadEvents() {
        try {
            const raw = localStorage.getItem(eventStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) events = parsed;
        } catch (e) {
            console.warn("Events load failed", e);
        }
    }

    function setEventLocation(latlng, place = null) {
        selectedEventLocation = [latlng.lat, latlng.lng];
        selectedEventPlaceId = place?.id || null;
        const labelName = place ? ` (${place.name})` : "";
        eventLocationLabel.textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}${labelName}`;
        if (locationPreviewMarker) {
            locationPreviewMarker.remove();
        }
        locationPreviewMarker = L.marker(latlng, { opacity: 0.75 }).addTo(map).bindPopup("Etkinlik konumu");
    }

    function renderEventList() {
        if (EVENTS_DISABLED) {
            if (eventList) {
                eventList.innerHTML = "";
                eventList.textContent = "Etkinlikler su an pasif.";
            }
            return;
        }
        if (!eventList) return;
        eventList.innerHTML = "";
        const visible = events.filter((evt) => canSeeEvent(evt));
        if (!visible.length) {
            eventList.textContent = "Henuz etkinlik yok.";
            return;
        }
        visible.forEach((evt) => {
            const card = document.createElement("div");
            card.className = "event-card";
            card.dataset.eventId = evt.id;
            const when = evt.datetime ? new Date(evt.datetime).toLocaleString("tr-TR") : "Tarih yok";
            const visibilityLabel = evt.visibility === "public" ? "Herkese acik" : "Kisisel";
            const isJoined = currentUser && (evt.participants || []).includes(currentUser);
            const canJoin = evt.visibility === "public" && currentUser && !isJoined;
            card.innerHTML = `
                <strong>${evt.title}</strong>
                <p>${evt.description || "Aciklama yok."}</p>
                <div class="event-meta">
                    <span>${when}</span>
                    <span>${evt.location.lat.toFixed(4)}, ${evt.location.lng.toFixed(4)}</span>
                    <span>${formatHandle(evt.createdBy)}</span>
                    <span>${visibilityLabel}</span>
                    ${evt.placeName ? `<span>${evt.placeName}</span>` : ""}
                    ${evt.options?.length ? `<span>Kriter: ${evt.options.join(", ")}</span>` : ""}
                </div>
                ${
                    canJoin
                        ? `<button class="pill primary join-btn" data-evt="${evt.id}">Katıl</button>`
                        : isJoined
                        ? `<span class="tag">Katıldın</span>`
                        : ""
                }
            `;
            eventList.appendChild(card);
        });
    }

    function renderEventMarkers() {
        if (EVENTS_DISABLED) return;
        friendEventMarkers.forEach((m) => m.remove());
        friendEventMarkers = [];
        if (!friendEventLayerEnabled || !currentUser) return;
        const myFriends = users[currentUser]?.following || [];
        const visiblePrivate = events.filter(
            (evt) =>
                evt.visibility === "private" &&
                myFriends.includes(evt.createdBy) &&
                (evt.allowedEmails || []).includes(currentUser)
        );
        visiblePrivate.forEach((evt) => {
            const marker = L.circleMarker([evt.location.lat, evt.location.lng], {
                color: "green",
                radius: 10,
                fillColor: "#1fa34a",
                fillOpacity: 0.65,
                weight: 2
            });
            const opts = evt.options?.length ? `<br><small>${evt.options.join(", ")}</small>` : "";
            marker.addTo(map).bindPopup(`<strong>${evt.title}</strong><br>${evt.description || ""}${opts}`);
            friendEventMarkers.push(marker);
        });
    }

    function renderEventOptions() {
        if (EVENTS_DISABLED) {
            if (eventOptionsBox) {
                eventOptionsBox.innerHTML = "<p class=\"muted-text\">Etkinlikler pasif.</p>";
            }
            return;
        }
        if (!eventOptionsBox) return;
        eventOptionsBox.innerHTML = "";
        const uniqueOptions = Array.from(new Set(Object.values(criterionOptions).flatMap((arr) => arr)));
        uniqueOptions.forEach((opt) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "option-chip";
            btn.textContent = opt;
            btn.dataset.option = opt;
            if (eventOptionSelections.has(opt)) btn.classList.add("active");
            btn.addEventListener("click", () => {
                if (eventOptionSelections.has(opt)) eventOptionSelections.delete(opt);
                else eventOptionSelections.add(opt);
                btn.classList.toggle("active");
            });
            eventOptionsBox.appendChild(btn);
        });
    }

    function setEventMode(mode = "create") {
        if (EVENTS_DISABLED) return;
        if (mode === "create") {
            eventForm.classList.remove("section-hidden");
            eventBrowseSection.classList.add("section-hidden");
            modeCreateBtn.classList.replace("ghost", "secondary");
            modeBrowseBtn.classList.replace("secondary", "ghost");
            modeCreateBtn.classList.add("active");
            modeBrowseBtn.classList.remove("active");
            if (toggleFriendEventsBtn) {
                toggleFriendEventsBtn.classList.add("hidden");
            }
        } else {
            eventForm.classList.add("section-hidden");
            eventBrowseSection.classList.remove("section-hidden");
            modeCreateBtn.classList.replace("secondary", "ghost");
            modeBrowseBtn.classList.replace("ghost", "secondary");
            modeBrowseBtn.classList.add("active");
            modeCreateBtn.classList.remove("active");
            if (toggleFriendEventsBtn) {
                toggleFriendEventsBtn.classList.remove("hidden");
            }
            renderEventList();
        }
    }

    function canSeeEvent(evt) {
        if (EVENTS_DISABLED) return false;
        if (evt.visibility === "public") return true;
        if (!currentUser) return false;
        if (evt.createdBy === currentUser) return true;
        if ((evt.participants || []).includes(currentUser)) return true;
        return (evt.allowedEmails || []).includes(currentUser);
    }

    function updateMyEvents() {
        if (EVENTS_DISABLED) {
            if (myCreatedEvents) {
                myCreatedEvents.classList.add("empty");
                myCreatedEvents.textContent = "Etkinlikler pasif.";
            }
            if (myJoinedEvents) {
                myJoinedEvents.classList.add("empty");
                myJoinedEvents.textContent = "Etkinlikler pasif.";
            }
            return;
        }
        if (!myCreatedEvents || !myJoinedEvents) return;
        myCreatedEvents.innerHTML = "";
        myJoinedEvents.innerHTML = "";
        if (!currentUser) {
            myCreatedEvents.classList.add("empty");
            myCreatedEvents.textContent = "Giris yapmadin.";
            myJoinedEvents.classList.add("empty");
            myJoinedEvents.textContent = "Giris yapmadin.";
            return;
        }
        const created = events.filter((e) => e.createdBy === currentUser);
        const joined = events.filter(
            (e) => (e.participants || []).includes(currentUser) && e.createdBy !== currentUser
        );
        if (!created.length) {
            myCreatedEvents.classList.add("empty");
            myCreatedEvents.textContent = "Etkinlik yok.";
        } else {
            myCreatedEvents.classList.remove("empty");
            created.forEach((evt) => {
                const div = document.createElement("div");
                div.className = "event-card";
                const when = evt.datetime ? new Date(evt.datetime).toLocaleString("tr-TR") : "Tarih yok";
                const participants = evt.participants?.length
                    ? evt.participants.map((p) => `<span class="tag">${formatHandle(p)}</span>`).join("")
                    : '<span class="muted-text">Katilan yok</span>';
                div.innerHTML = `
                    <strong>${evt.title}</strong>
                    <p>${when}</p>
                    <div class="event-meta">
                        ${evt.placeName ? `<span>${evt.placeName}</span>` : ""}
                    </div>
                    <div class="review-meta">${participants}</div>
                    <button class="pill ghost delete-event-btn" data-event-id="${evt.id}">Sil</button>
                `;
                myCreatedEvents.appendChild(div);
            });
        }
        if (!joined.length) {
            myJoinedEvents.classList.add("empty");
            myJoinedEvents.textContent = "Etkinlik yok.";
        } else {
            myJoinedEvents.classList.remove("empty");
            joined.forEach((evt) => {
                const div = document.createElement("div");
                div.className = "event-card";
                const when = evt.datetime ? new Date(evt.datetime).toLocaleString("tr-TR") : "Tarih yok";
                div.innerHTML = `
                    <strong>${evt.title}</strong>
                    <p>${when}</p>
                    <div class="event-meta">
                        ${evt.placeName ? `<span>${evt.placeName}</span>` : ""}
                        <span>Olusturan: ${formatHandle(evt.createdBy)}</span>
                    </div>
                `;
                myJoinedEvents.appendChild(div);
            });
        }
    }

    function deleteEvent(eventId) {
        if (EVENTS_DISABLED) {
            showToast("Etkinlikler pasif.");
            return;
        }
        if (!currentUser) {
            showToast("Etkinlik silmek icin giris yap.");
            return;
        }
        const target = events.find((evt) => evt.id === eventId);
        if (!target) {
            showToast("Etkinlik bulunamadi.");
            return;
        }
        if (target.createdBy !== currentUser) {
            showToast("Sadece olusturdugun etkinligi silebilirsin.");
            return;
        }
        events = events.filter((evt) => evt.id !== eventId);
        saveEvents();
        updateMyEvents();
        renderEventList();
        renderEventMarkers();
        renderNotifications();
        updateNotificationBadge();
        showToast("Etkinlik silindi");
    }

    function wireEventListeners() {
        // Global değişkenleri kontrol et ve tanımla (eğer yoksa)
        const eventPanel = typeof window !== "undefined" ? (window.eventPanel || document.getElementById("eventPanel")) : null;
        const openEventPanelBtn = typeof window !== "undefined" ? (window.openEventPanelBtn || document.getElementById("openEventPanelBtn")) : null;
        const eventList = typeof window !== "undefined" ? (window.eventList || document.getElementById("eventList")) : null;
        const eventForm = typeof window !== "undefined" ? (window.eventForm || document.getElementById("eventForm")) : null;
        
        if (EVENTS_DISABLED) {
            if (eventPanel) eventPanel.classList.add("collapsed", "disabled");
            if (openEventPanelBtn) {
                openEventPanelBtn.disabled = true;
                openEventPanelBtn.title = "Etkinlikler pasif";
                openEventPanelBtn.classList.add("disabled");
                openEventPanelBtn.style.display = "none";
            }
            if (eventList) {
                eventList.innerHTML = "";
                eventList.textContent = "Etkinlikler su an pasif.";
            }
            if (eventForm) {
                Array.from(eventForm.elements || []).forEach((el) => (el.disabled = true));
            }
            // Profil/ust bar etkinlik butonunu da pasif goster
            const topBarEventBtn = document.getElementById("openEventPanel");
            if (topBarEventBtn) {
                topBarEventBtn.disabled = true;
                topBarEventBtn.title = "Etkinlikler pasif";
                topBarEventBtn.classList.add("disabled");
            }
            return;
        }
        
        if (!eventPanel || !openEventPanelBtn) {
            console.warn("[etkinlikler.js] eventPanel or openEventPanelBtn not found, event listeners not wired");
            return;
        }
        
        openEventPanelBtn?.addEventListener("click", () => {
            if (!eventPanel) return;
            const willOpen = eventPanel.classList.contains("collapsed");
            if (typeof setEventPanel === "function") {
                setEventPanel(willOpen);
            }
            if (willOpen && typeof setEventMode === "function") {
                setEventMode("create");
            }
        });

        eventForm?.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = eventTitleInput.value.trim();
            const datetimeValue = eventDateInput.value;
            const description = eventDescriptionInput.value.trim();
            const visibility = Array.from(visibilityInputs).find((i) => i.checked)?.value || "public";
            const allowedEmailsRaw = allowedEmailsInput.value
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            if (!title || !datetimeValue) {
                showToast("Baslik ve tarih gerekli.");
                return;
            }
            if (!selectedEventLocation) {
                showToast("Once haritadan konum sec.");
                return;
            }
            if (visibility === "private" && !allowedEmailsRaw.length) {
                showToast("Özel etkinlik icin e-posta ekle.");
                return;
            }
            const datetimeIso = new Date(datetimeValue).toISOString();
            const place = places.find((p) => p.id === selectedEventPlaceId);
            events.push({
                id: `evt-${Date.now()}`,
                title,
                description,
                datetime: datetimeIso,
                location: { lat: selectedEventLocation[0], lng: selectedEventLocation[1] },
                createdBy: currentUser || "anonim",
                createdAt: Date.now(),
                options: Array.from(eventOptionSelections),
                visibility,
                allowedEmails: allowedEmailsRaw,
                placeId: selectedEventPlaceId || null,
                placeName: place?.name || null,
                participants: []
            });
            saveEvents();
            renderEventList();
            renderEventMarkers();
            eventForm.reset();
            resetEventLocation();
            eventOptionSelections.clear();
            renderEventOptions();
            allowedEmailsInput.classList.add("hidden");
            setEventPanel(true);
            showToast("Etkinlik eklendi");
        });

        modeCreateBtn?.addEventListener("click", () => setEventMode("create"));
        modeBrowseBtn?.addEventListener("click", () => setEventMode("browse"));

        closeEventPanelBtn?.addEventListener("click", () => setEventPanel(false));

        Array.from(visibilityInputs || []).forEach((input) => {
            input.addEventListener("change", () => {
                const isPrivate = input.value === "private" && input.checked;
                if (isPrivate) allowedEmailsInput.classList.remove("hidden");
                else allowedEmailsInput.classList.add("hidden");
            });
        });

        toggleFriendEventsBtn?.addEventListener("click", () => {
            if (!currentUser) {
                showToast("Gurmeleri gormek icin giris yap.");
                return;
            }
            friendEventLayerEnabled = !friendEventLayerEnabled;
            toggleFriendEventsBtn.classList.toggle("ghost", friendEventLayerEnabled);
            toggleFriendEventsBtn.classList.toggle("secondary", !friendEventLayerEnabled);
            toggleFriendEventsBtn.classList.toggle("active", friendEventLayerEnabled);
            renderEventMarkers();
        });

        myCreatedEvents?.addEventListener("click", (e) => {
            const btn = e.target.closest(".delete-event-btn");
            if (!btn) return;
            deleteEvent(btn.dataset.eventId);
        });

        eventList?.addEventListener("click", (e) => {
            const card = e.target.closest(".event-card");
            if (!card) return;
            if (e.target.classList.contains("join-btn")) {
                const evtId = e.target.dataset.evt;
                const evt = events.find((x) => x.id === evtId);
                if (!evt || !currentUser) {
                    showToast("Katılmak icin giris yap.");
                    return;
                }
                evt.participants = evt.participants || [];
                if (!evt.participants.includes(currentUser)) {
                    evt.participants.push(currentUser);
                    saveEvents();
                    renderEventList();
                    updateMyEvents();
                    renderEventMarkers();
                    showToast("Etkinlige katildin");
                }
                return;
            }
            const evtId = card.dataset.eventId;
            const evt = events.find((x) => x.id === evtId);
            if (!evt) return;
            map.setView([evt.location.lat, evt.location.lng], 15);
            showToast("Etkinlik konumuna gidildi");
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderEventOptions();
        wireEventListeners();
    });

    // Export globals for other moduller
    window.resetEventLocation = resetEventLocation;
    window.saveEvents = saveEvents;
    window.loadEvents = loadEvents;
    window.setEventLocation = setEventLocation;
    window.renderEventList = renderEventList;
    window.renderEventMarkers = renderEventMarkers;
    window.renderEventOptions = renderEventOptions;
    window.setEventMode = setEventMode;
    window.canSeeEvent = canSeeEvent;
    window.updateMyEvents = updateMyEvents;
    window.deleteEvent = deleteEvent;
})();
