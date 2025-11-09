import { saveStories, getStories as getStoriesIDB, deleteStory as deleteStoryIDB } from "../../data/idb.js";
import DicodingStoryApi from "../../data/api";
import HomePresenter from "../../presenters/home.presenter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import customMarkerIcon from "../../utils/marker";

import { mountPushToggle } from "../../push/ui-toggle.js";
import { subscribeWebPush } from "../../push/subscribe.js";

// Favorite (IndexedDB)
import { getFavorites, addFavorite, removeFavorite, isFavorite } from "../../data/idb.js";

export default class HomePage {
  constructor() {
    this.presenter = new HomePresenter({ api: DicodingStoryApi });

    this._allStories = [];
    this._map = null;
    this._storiesLayer = null;
    this._markers = {};
    this._favSet = new Set();
  }

  _formatDateID(dateInput) {
    try {
      const d = dateInput ? new Date(dateInput) : null;
      if (!d || isNaN(d.getTime())) return "";
      return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return "";
    }
  }

  async render() {
    return `
      <a href="#main-content" class="visually-hidden">Skip to content</a>
      <section class="container">
        <h1 tabindex="0">Story Location Map</h1>

        <h2 id="filter-heading" class="visually-hidden">Filter dan Pencarian</h2>
        <div id="filter-slot" aria-labelledby="filter-heading"></div>

        <h2 id="map-heading" class="visually-hidden">Peta Lokasi Story</h2>
        <div id="map" class="map" role="region" aria-labelledby="map-heading" tabindex="0"></div>

        <h2 id="list-heading" class="visually-hidden">Daftar Story</h2>
        <div id="story-list" class="story-grid" aria-labelledby="list-heading" aria-live="polite" aria-busy="true"></div>
      </section>
    `;
  }

  async afterRender() {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Kamu belum login! Silakan login terlebih dahulu.");
      window.location.hash = "#/login";
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        const alreadyRegisteredFromApp = !!window.__SW_REGISTERED;
        if (!alreadyRegisteredFromApp) {
          const existing = await navigator.serviceWorker.getRegistration();
          if (!existing) await navigator.serviceWorker.register("/sw.js");
        }
      } catch (e) {
        console.warn("SW registration skipped/failed:", e);
      }

      if (!window.__SW_MSG_BOUND) {
        navigator.serviceWorker.addEventListener("message", (evt) => {
          if (evt?.data?.type === "PUSH_CLICK" && evt.data.url) {
            window.location.assign(evt.data.url);
          }
        });
        window.__SW_MSG_BOUND = true;
      }
    }

    mountPushToggle(document.body);

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    });
    const cartoLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    });
    const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    });

    this._map = L.map("map", {
      center: [-2.5, 118],
      zoom: 5,
      layers: [osm],
      keyboard: true,
    });

    this._storiesLayer = L.layerGroup().addTo(this._map);
    const baseLayers = { "OSM Standard": osm, "Carto Light": cartoLight, "Esri Satellite": esriSat };
    const overlays = { Stories: this._storiesLayer };
    L.control.layers(baseLayers, overlays, { position: "topright", collapsed: true }).addTo(this._map);

    const storyListContainer = document.querySelector("#story-list");
    const filterSlot = document.querySelector("#filter-slot");
    this._markers = {};

    this._mountFilterBar(filterSlot, (filters) => {
      const filtered = this._applyFilters(this._allStories, filters);
      this._renderAll(filtered, storyListContainer);
    });

    try {
      let stories = [];

      try {
        stories = await this.presenter.getStoriesWithLocation();
        saveStories(stories).catch(() => {});
      } catch (netErr) {
        console.warn("[Home] fetch gagal, gunakan IDB:", netErr?.message || netErr);
        stories = await getStoriesIDB();
      }

      try {
        const favs = await getFavorites();
        this._favSet = new Set(favs.map((s) => s.id));
      } catch {
        this._favSet = new Set();
      }

      this._allStories = stories;
      storyListContainer.setAttribute("aria-busy", "false");

      if (!stories.length) {
        storyListContainer.innerHTML = `<p style="text-align:center;">Tidak ada story dengan lokasi.</p>`;
        return;
      }

      this._renderAll(this._applyFilters(stories, { query: "", sort: "newest", loc: "all" }), storyListContainer);

      const mapEl = document.getElementById("map");
      mapEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._map.flyTo(this._map.getCenter(), this._map.getZoom());
        }
      });
    } catch (error) {
      console.error(error);
      storyListContainer.setAttribute("aria-busy", "false");
      storyListContainer.innerHTML = `<p style="color:red;text-align:center;">Gagal memuat data story.</p>`;
    }
  }

  _mountFilterBar(slotEl, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "filter-bar";
    wrap.innerHTML = `
      <div class="filter-field">
        <label for="search-story" class="visually-hidden">Cari cerita</label>
        <input
          type="text"
          id="search-story"
          class="filter-input"
          placeholder="🔍 Cari cerita..."
        />
      </div>

      <div class="filter-field">
        <label for="sort-story" class="visually-hidden">Urutkan cerita</label>
        <select id="sort-story" class="filter-select">
          <option value="newest" selected>Terbaru</option>
          <option value="oldest">Terlama</option>
        </select>
      </div>

      <div class="filter-field">
        <label for="filter-location" class="visually-hidden">Filter lokasi</label>
        <select id="filter-location" class="filter-select">
          <option value="all" selected>Semua</option>
          <option value="with">Dengan lokasi</option>
          <option value="without">Tanpa lokasi</option>
        </select>
      </div>
    `;
    slotEl.innerHTML = "";
    slotEl.appendChild(wrap);

    const searchInput = wrap.querySelector("#search-story");
    const sortSelect = wrap.querySelector("#sort-story");
    const locSelect = wrap.querySelector("#filter-location");

    const emit = () => {
      onChange({
        query: (searchInput.value || "").trim().toLowerCase(),
        sort: sortSelect.value,
        loc: locSelect.value,
      });
    };

    searchInput.addEventListener("input", emit);
    sortSelect.addEventListener("change", emit);
    locSelect.addEventListener("change", emit);
  }

  _applyFilters(list, { query, sort, loc }) {
    let out = Array.isArray(list) ? [...list] : [];

    if (query) {
      out = out.filter((s) => {
        const text = `${s.name || ""} ${s.description || ""}`.toLowerCase();
        return text.includes(query);
      });
    }

    if (loc === "with") out = out.filter((s) => s.lat && s.lon);
    else if (loc === "without") out = out.filter((s) => !s.lat && !s.lon);

    out.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime() || 0;
      const tb = new Date(b.createdAt || 0).getTime() || 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return out;
  }

  _renderAll(stories, storyListContainer) {
    this._renderCards(stories, storyListContainer);
    this._renderMarkers(stories);

    const bounds = stories.filter((s) => s.lat && s.lon).map((s) => [s.lat, s.lon]);
    if (bounds.length) this._map.fitBounds(bounds, { padding: [24, 24] });
  }

  _renderCards(stories, storyListContainer) {
    if (!stories.length) {
      storyListContainer.innerHTML = `<p style="text-align:center;">Tidak ada story sesuai filter.</p>`;
      return;
    }

    storyListContainer.innerHTML = stories
      .map((story) => {
        const createdAtText = this._formatDateID(story.createdAt);
        const createdAtISO = story.createdAt ? new Date(story.createdAt).toISOString() : "";
        const isFav = this._favSet.has(story.id);
        const favLabel = isFav ? "Hapus dari favorit" : "Simpan ke favorit";
        return `
          <article class="story-card" data-id="${story.id}" tabindex="0" role="button" aria-pressed="false" aria-label="Story dari ${story.name || "Anonim"}">
            <img src="${story.photoUrl}" alt="Foto story dari ${story.name || "Anonim"}">
            <div class="story-content">
              <h3>${story.name || "Anonim"}</h3>
              <p>${story.description || ""}</p>
              <p class="meta">
                <time datetime="${createdAtISO}" aria-label="Tanggal dibuat">${createdAtText}</time>
              </p>
              <div class="card-actions">
                <button class="fav-btn ${isFav ? "fav-active" : ""}" data-id="${story.id}" aria-pressed="${isFav ? "true" : "false"}" aria-label="${favLabel}">❤</button>
                <button class="delete-btn" data-id="${story.id}" aria-label="Hapus story ini (lokal saja)">🗑 Hapus</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    stories.forEach((story) => {
      const card = storyListContainer.querySelector(`[data-id="${story.id}"]`);
      if (!card) return;
      const goToMarker = () => {
        const m = this._markers[story.id];
        if (m) {
          m.openPopup();
          this._map.flyTo(m.getLatLng(), 10);
        }
        this._highlightStory(card);
        card.setAttribute("aria-pressed", "true");
      };
      card.addEventListener("click", (e) => {
        if (e.target.closest(".card-actions")) return;
        goToMarker();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToMarker();
        }
      });
    });

    storyListContainer.addEventListener("click", async (e) => {
      const fav = e.target.closest(".fav-btn");
      if (!fav) return;
      e.preventDefault();
      e.stopPropagation();

      const id = fav.dataset.id;
      const story = stories.find((s) => s.id === id);
      if (!story) return;

      try {
        if (this._favSet.has(id)) {
          await removeFavorite(id);
          this._favSet.delete(id);
          fav.classList.remove("fav-active");
          fav.setAttribute("aria-pressed", "false");
          fav.setAttribute("aria-label", "Simpan ke favorit");
        } else {
          await addFavorite(story);
          this._favSet.add(id);
          fav.classList.add("fav-active");
          fav.setAttribute("aria-pressed", "true");
          fav.setAttribute("aria-label", "Hapus dari favorit");
        }
      } catch (err) {
        console.warn("Toggle favorite gagal:", err);
      }
    });

    storyListContainer.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(".delete-btn");
        if (!btn) return;
        const storyId = btn.dataset.id;
        if (!confirm("Yakin ingin menghapus story ini (lokal saja)?")) return;

        const card = btn.closest(".story-card");
        if (card) card.remove();

        if (this._markers[storyId]) {
          this._storiesLayer.removeLayer(this._markers[storyId]);
          delete this._markers[storyId];
        }

        deleteStoryIDB(storyId).catch(() => {});
        alert("✅ Story dihapus dari cache lokal.");
      },
      { once: true }
    );
  }

  _renderMarkers(stories) {
    this._storiesLayer.clearLayers();
    this._markers = {};

    stories.forEach((story) => {
      if (story.lat && story.lon) {
        const createdAtText = this._formatDateID(story.createdAt);
        const marker = L.marker([story.lat, story.lon], { icon: customMarkerIcon });
        marker.bindPopup(`
          <strong>${story.name || "Anonim"}</strong><br>
          ${story.description || ""}${createdAtText ? `<br><small><em>${createdAtText}</em></small>` : ""}
        `);

        marker.addTo(this._storiesLayer);
        this._markers[story.id] = marker;

        marker.on("click", () => {
          const card = document.querySelector(`[data-id="${story.id}"]`);
          if (!card) return;
          this._highlightStory(card);
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.setAttribute("aria-pressed", "true");
        });
      }
    });
  }

  _highlightStory(selectedCard) {
    document.querySelectorAll(".story-card").forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-pressed", "false");
    });
    selectedCard.classList.add("active");
  }
}
