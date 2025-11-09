import routes from "../routes/routes";
import { getActiveRoute } from "../routes/url-parser";
import { syncPendingStories } from "../sync/offline-sync.js";

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;
  #deferredPrompt = null;

  constructor({ navigationDrawer, drawerButton, content }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;

    this._setupDrawer();
    this._setupThemeToggle();
    this._setupOnlineOfflineHandler();
    this._setupServiceWorker();
    this._setupInstallPrompt();

    Promise.resolve()
      .then(() => this._trySyncPendingStories())
      .catch(() => {});
  }

  _setupDrawer() {
    if (window.__DRAWER_MANAGED) return;

    if (!this.#drawerButton || !this.#navigationDrawer) return;

    this.#drawerButton.setAttribute("aria-controls", "navigation-drawer");
    this.#drawerButton.setAttribute("aria-expanded", "false");
    this.#navigationDrawer.setAttribute("aria-hidden", "true");
    this.#navigationDrawer.setAttribute("role", "dialog");

    const openDrawer = () => {
      this.#navigationDrawer.classList.add("open");
      this.#navigationDrawer.setAttribute("aria-hidden", "false");
      this.#drawerButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("no-scroll");
    };

    const closeDrawer = () => {
      this.#navigationDrawer.classList.remove("open");
      this.#navigationDrawer.setAttribute("aria-hidden", "true");
      this.#drawerButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("no-scroll");
    };

    this.#drawerButton.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const isOpen = this.#navigationDrawer.classList.contains("open");
      if (isOpen) closeDrawer();
      else openDrawer();
    });

    document.body.addEventListener("click", (event) => {
      if (this.#navigationDrawer.contains(event.target) || this.#drawerButton.contains(event.target)) return;

      if (window.matchMedia && !window.matchMedia("(max-width: 768px)").matches) return;
      closeDrawer();
    });

    this.#navigationDrawer.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link) closeDrawer();
    });

    window.addEventListener("resize", () => {
      if (window.matchMedia && !window.matchMedia("(max-width: 768px)").matches) {
        closeDrawer();
      }
    });
  }

  _setupThemeToggle() {
    const themeToggle = document.querySelector("#theme-toggle");
    if (!themeToggle) return;

    const currentTheme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", currentTheme);
    themeToggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";

    themeToggle.addEventListener("click", () => {
      const newTheme = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.body.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
    });
  }

  _setupOnlineOfflineHandler() {
    window.addEventListener("online", async () => {
      this._showToast("✅ Kamu kembali online", "success");

      try {
        const result = await syncPendingStories();
        if (result?.synced) {
          this._showToast(`🔁 ${result.synced} story tersinkron.`, "success");
        }
      } catch (err) {
        console.warn("Sync gagal:", err);
      }
    });

    window.addEventListener("offline", () => {
      this._showToast("⚠️ Kamu sedang offline", "warning");
    });
  }

  _showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async renderPage() {
    const url = getActiveRoute();
    const token = localStorage.getItem("token");

    const protectedRoutes = ["/", "/add"];
    const authRoutes = ["/login", "/register"];

    if (!token && protectedRoutes.includes(url)) {
      window.location.hash = "#/login";
      return;
    }

    if (token && authRoutes.includes(url)) {
      window.location.hash = "#/";
      return;
    }

    try {
      const page = routes[url] || routes["/"];
      this.#content.innerHTML = `
        <div class="loading-page">
          <div class="spinner"></div>
          <p>Memuat halaman...</p>
        </div>
      `;

      const pageContent = await page.render();
      this.#content.innerHTML = pageContent;
      await page.afterRender();

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("❌ Gagal render halaman:", error);
      this.#content.innerHTML = `
        <section class="error-page">
          <h2>Terjadi Kesalahan 😢</h2>
          <p>${error.message || "Halaman gagal dimuat."}</p>
          <button id="retry-btn">Coba Lagi</button>
        </section>
      `;
      document.querySelector("#retry-btn")?.addEventListener("click", () => this.renderPage());
    }
  }

  _setupServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const IS_DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        window.__SW_REGISTERED = true;

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (IS_DEV) {
            console.log("[SW] controllerchange (dev mode) - skip reload");
            return;
          }
          this._showToast("🔄 Aplikasi diperbarui. Muat ulang untuk versi terbaru.", "info");
        });

        console.log("[SW] Registered:", reg.scope);
      } catch (err) {
        console.warn("SW registration failed:", err);
      }
    });

    navigator.serviceWorker.addEventListener("message", (evt) => {
      if (evt?.data?.type === "PUSH_CLICK" && evt.data.url) {
        window.location.assign(evt.data.url);
      }
    });
    window.__SW_MSG_BOUND = true;
  }

  _setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.#deferredPrompt = e;
      this._showInstallButton();
    });

    window.addEventListener("appinstalled", () => {
      this.#deferredPrompt = null;
      const btn = document.getElementById("install-app-button");
      if (btn) btn.remove();
      this._showToast("📲 UStory terinstal!", "success");
    });
  }

  _showInstallButton() {
    if (document.getElementById("install-app-button")) return;

    const btn = document.createElement("button");
    btn.id = "install-app-button";
    btn.type = "button";
    btn.textContent = "Install App";
    btn.setAttribute("aria-label", "Install aplikasi UStory");
    btn.style.cssText = `
      position: fixed; left: 1rem; bottom: 1rem; z-index: 10000;
      padding: .6rem 1rem; border: none; border-radius: .75rem;
      background: #2563eb; color: #fff; font-weight: 700; cursor: pointer;
      box-shadow: 0 10px 25px rgba(0,0,0,.25);
    `;

    btn.addEventListener("click", async () => {
      if (!this.#deferredPrompt) return;
      this.#deferredPrompt.prompt();
      const { outcome } = await this.#deferredPrompt.userChoice;
      if (outcome === "accepted") {
        this._showToast("✅ Memulai instalasi...", "success");
      } else {
        this._showToast("ℹ️ Instalasi dibatalkan.", "info");
      }
      this.#deferredPrompt = null;
      btn.remove();
    });

    document.body.appendChild(btn);
  }

  async _trySyncPendingStories() {
    try {
      const result = await syncPendingStories();
      if (result?.synced) {
        this._showToast(`🔁 ${result.synced} story offline tersinkron.`, "success");
      }
    } catch (err) {
      console.warn("Sync pending gagal:", err);
    }
  }
}

export default App;
