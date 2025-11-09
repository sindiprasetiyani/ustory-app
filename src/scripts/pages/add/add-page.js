import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DicodingStoryApi from "../../data/api";
import AddPresenter from "../../presenters/add.presenter";
import customMarkerIcon from "../../utils/marker";
import { queueOfflineStory } from "../../sync/offline-sync";

export default class AddPage {
  constructor() {
    this.presenter = new AddPresenter({ api: DicodingStoryApi });
    this._mediaStream = null;
    this._capturedBlob = null;
    this._objectUrl = null;
  }

  async render() {
    return `
      <section class="container">
        <h1>Add New Story</h1>

        <form id="add-story-form" class="add-story-form" novalidate aria-describedby="status-message">
          <label for="name">Name</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            placeholder="Masukkan nama kamu..." 
            required 
            autocomplete="name"
          />

          <label for="description">Description</label>
          <textarea 
            id="description" 
            name="description" 
            placeholder="Tulis deskripsi cerita kamu..." 
            required
          ></textarea>

          <label for="photo">Photo (unggah dari file / kamera)</label>
          <input 
            type="file" 
            id="photo" 
            name="photo" 
            accept="image/*"
            capture="environment"
          />

          <div class="camera-box" aria-live="polite">
            <div class="camera-actions" style="display:flex; gap:.5rem; flex-wrap:wrap;">
              <button type="button" id="open-camera-btn" class="btn-secondary">🎥 Gunakan Kamera</button>
              <button type="button" id="capture-btn" class="btn-secondary" disabled>📸 Ambil Foto</button>
              <button type="button" id="close-camera-btn" class="btn-danger" disabled>✖ Tutup Kamera</button>
              <button type="button" id="clear-captured-btn" class="btn-light" disabled>🗑 Hapus Foto Diambil</button>
            </div>

            <div class="camera-preview-area" style="margin-top:.75rem;">
              <video id="camera-preview" autoplay playsinline muted style="width:100%; max-height:300px; border-radius:10px; display:none;"></video>
              <canvas id="camera-canvas" class="visually-hidden"></canvas>
              <img id="captured-thumb" alt="" style="display:none; width:100%; max-height:300px; border-radius:10px; margin-top:.5rem;" />
            </div>

            <p id="camera-hint" class="muted" style="font-size:.9rem; color:#6b7280;"></p>
          </div>

          <label for="map">Select Location</label>
          <div id="map" class="map" role="region" aria-label="Pilih lokasi pada peta"></div>

          <input type="hidden" id="lat" name="lat" />
          <input type="hidden" id="lon" name="lon" />

          <button type="submit" class="btn-primary" id="submit-btn">Submit</button>
        </form>

        <p id="status-message" class="status-message" role="status" aria-live="polite"></p>
      </section>
    `;
  }

  async afterRender() {
    const status = document.querySelector("#status-message");
    const form = document.querySelector("#add-story-form");
    const submitBtn = document.querySelector("#submit-btn");

    const openBtn = document.querySelector("#open-camera-btn");
    const captureBtn = document.querySelector("#capture-btn");
    const closeBtn = document.querySelector("#close-camera-btn");
    const clearCapturedBtn = document.querySelector("#clear-captured-btn");
    const videoEl = document.querySelector("#camera-preview");
    const canvasEl = document.querySelector("#camera-canvas");
    const capturedThumb = document.querySelector("#captured-thumb");
    const cameraHint = document.querySelector("#camera-hint");
    const fileInput = document.querySelector("#photo");

    const isSecure = () => window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost";

    async function hasVideoInput() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return true;
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some((d) => d.kind === "videoinput");
      } catch {
        return true;
      }
    }

    const supportsGetUserMedia = () => !!(navigator.mediaDevices?.getUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);

    function requestUserMedia(constraints) {
      const gum = navigator.mediaDevices?.getUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      if (!gum) return Promise.reject(new Error("getUserMedia tidak tersedia."));
      if (navigator.mediaDevices?.getUserMedia) return navigator.mediaDevices.getUserMedia(constraints);
      return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
    }

    const token = localStorage.getItem("token");
    if (!token) {
      status.style.color = "red";
      status.textContent = "⚠️ Kamu belum login. Silakan login terlebih dahulu.";
      window.location.hash = "#/login";
      return;
    }

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    const cartoLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    });
    const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    });

    const map = L.map("map", {
      center: [-6.2, 106.816666],
      zoom: 5,
      layers: [osm],
    });

    const baseLayers = { "OSM Standard": osm, "Carto Light": cartoLight, "Esri Satellite": esriSat };
    const chosenLayer = L.layerGroup().addTo(map);
    const overlays = { "Chosen Location": chosenLayer };
    L.control.layers(baseLayers, overlays, { position: "topright", collapsed: true }).addTo(map);

    let marker = null;

    map.on("click", (event) => {
      const { lat, lng } = event.latlng;
      document.querySelector("#lat").value = lat;
      document.querySelector("#lon").value = lng;

      if (marker) chosenLayer.removeLayer(marker);
      marker = L.marker([lat, lng], { icon: customMarkerIcon }).addTo(chosenLayer);
    });

    // Validasi
    const validateClient = () => {
      const desc = form.description.value.trim();
      const file = fileInput.files[0];
      if (!desc) throw new Error("Deskripsi wajib diisi.");
      if (!file && !this._capturedBlob) throw new Error("Harap unggah foto atau ambil foto dari kamera.");
      if (file && file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5MB.");
    };

    // Kamera
    const stopStream = () => {
      if (this._mediaStream) {
        this._mediaStream.getTracks().forEach((t) => t.stop());
        this._mediaStream = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
        videoEl.style.display = "none";
      }
      captureBtn.disabled = true;
      closeBtn.disabled = true;
      cameraHint.textContent = "";
    };

    const clearCaptured = () => {
      this._capturedBlob = null;
      if (this._objectUrl) {
        URL.revokeObjectURL(this._objectUrl);
        this._objectUrl = null;
      }
      capturedThumb.src = "";
      capturedThumb.style.display = "none";
      clearCapturedBtn.disabled = true;
    };

    openBtn.addEventListener("click", async () => {
      clearCaptured();
      if (!supportsGetUserMedia()) {
        cameraHint.textContent = "Browser tidak mendukung kamera.";
        return;
      }
      if (!isSecure()) {
        cameraHint.innerHTML = "Gunakan HTTPS atau localhost untuk akses kamera.";
        return;
      }
      const hasCam = await hasVideoInput();
      if (!hasCam) {
        cameraHint.textContent = "Kamera tidak ditemukan.";
        return;
      }

      try {
        this._mediaStream = await requestUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        videoEl.srcObject = this._mediaStream;
        videoEl.style.display = "block";
        captureBtn.disabled = false;
        closeBtn.disabled = false;
        cameraHint.textContent = "Kamera aktif. Klik 'Ambil Foto'.";
      } catch (err) {
        cameraHint.textContent = "Gagal membuka kamera.";
        console.error(err);
      }
    });

    captureBtn.addEventListener("click", async () => {
      if (!this._mediaStream || !videoEl.srcObject) return;
      const track = this._mediaStream.getVideoTracks()[0];
      const settings = track.getSettings?.() || {};
      const w = settings.width || 1280;
      const h = settings.height || 720;

      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, w, h);
      const blob = await new Promise((res) => canvasEl.toBlob(res, "image/jpeg", 0.9));
      if (!blob) return;
      this._capturedBlob = blob;

      if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = URL.createObjectURL(blob);
      capturedThumb.src = this._objectUrl;
      capturedThumb.style.display = "block";
      clearCapturedBtn.disabled = false;
      cameraHint.textContent = "Foto berhasil diambil.";
    });

    closeBtn.addEventListener("click", stopStream);
    clearCapturedBtn.addEventListener("click", clearCaptured);

    const cleanup = () => {
      stopStream();
      clearCaptured();
      if (marker) {
        chosenLayer.removeLayer(marker);
      }
    };
    window.addEventListener("hashchange", cleanup, { once: true });
    window.addEventListener("beforeunload", cleanup, { once: true });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        validateClient();
      } catch (err) {
        status.style.color = "red";
        status.textContent = `❌ ${err.message}`;
        return;
      }

      const userName = form.name.value.trim();
      if (userName) localStorage.setItem("lastStoryName", userName);

      const rawDesc = form.description.value.trim();
      const descToSend = userName ? `[${userName}] ${rawDesc}` : rawDesc;

      const formData = new FormData();
      formData.append("description", descToSend);
      if (this._capturedBlob) formData.append("photo", this._capturedBlob, "camera.jpg");
      else if (fileInput.files[0]) formData.append("photo", fileInput.files[0]);
      if (form.lat.value && form.lon.value) {
        formData.append("lat", form.lat.value);
        formData.append("lon", form.lon.value);
      }

      submitBtn.disabled = true;
      status.style.color = "#555";
      status.textContent = "⏳ Mengirim story...";

      try {
        await this.presenter.submitStory(formData);
        status.style.color = "green";
        status.textContent = "✅ Story berhasil ditambahkan!";

        form.reset();
        cleanup();

        setTimeout(() => (window.location.hash = "#/"), 800);
      } catch (error) {
        console.warn("[AddPage] gagal kirim online:", error?.message);
        status.style.color = "#666";
        status.textContent = "📦 Offline. Story disimpan & akan dikirim otomatis saat online.";

        try {
          const photoBlob = this._capturedBlob || fileInput.files[0] || null;
          const lat = form.lat.value ? parseFloat(form.lat.value) : null;
          const lon = form.lon.value ? parseFloat(form.lon.value) : null;

          await queueOfflineStory({
            description: descToSend,
            photoBlob,
            lat,
            lon,
            createdAt: new Date().toISOString(),
          });

          form.reset();
          cleanup();

          this._toast("✅ Disimpan offline. Akan disinkron saat online.", "success");
          setTimeout(() => (window.location.hash = "#/"), 800);
        } catch (err2) {
          console.error("[AddPage] gagal simpan offline:", err2);
          status.style.color = "red";
          status.textContent = "❌ Gagal menyimpan offline. Coba lagi.";
        }
      } finally {
        submitBtn.disabled = false;
      }
    });

    const mapEl = document.getElementById("map");
    mapEl.setAttribute("tabindex", "0");
    mapEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        map.flyTo(map.getCenter(), map.getZoom());
      }
    });
  }

  _toast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:1rem;bottom:1rem;background:#111827;color:#fff;padding:.6rem .9rem;border-radius:.75rem;z-index:9999;opacity:0;transition:opacity .2s";
    document.body.appendChild(t);
    requestAnimationFrame(() => (t.style.opacity = "1"));
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 250);
    }, 2500);
  }
}
