import "../styles/styles.css";

import App from "./pages/app";
import { createFocusTrap } from "./utils/focus-trap";

document.addEventListener("DOMContentLoaded", async () => {
  window.__DRAWER_MANAGED = true;

  if (!document.querySelector(".skip-link-global")) {
    const skip = document.createElement("a");
    skip.href = "#main-content";
    skip.className = "skip-link skip-link-global";
    skip.textContent = "Skip to content";
    document.body.prepend(skip);
  }

  const app = new App({
    content: document.querySelector("#main-content"),
    drawerButton: document.querySelector("#drawer-button"),
    navigationDrawer: document.querySelector("#navigation-drawer"),
  });

  const contentEl = document.querySelector("#main-content");
  if (contentEl && !contentEl.classList.contains("main-content")) {
    contentEl.classList.add("main-content");
  }
  contentEl?.setAttribute("role", "main");

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  async function withViewTransition(fn) {
    if (!prefersReducedMotion && document.startViewTransition) {
      return document.startViewTransition(fn).finished;
    }
    return fn();
  }

  await withViewTransition(() => app.renderPage());

  function updateAuthSection() {
    const authSection = document.querySelector("#auth-section");
    if (!authSection) return;

    const token = localStorage.getItem("token");
    const name = localStorage.getItem("name");

    if (token) {
      authSection.innerHTML = `
        <span>👋 Hai, ${name || "User"}</span>
        <button id="logout-btn" class="logout-btn">Logout</button>
      `;
    } else {
      authSection.innerHTML = `
        <a href="#/login">Login</a> | 
        <a href="#/register">Register</a>
      `;
    }
  }
  updateAuthSection();

  function setActiveNavItem() {
    const links = document.querySelectorAll('#navigation-drawer a[href^="#/"]');
    const current = (location.hash || "#/").split("?")[0];

    links.forEach((link) => {
      const href = link.getAttribute("href");
      const isActive = href === current;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }
  setActiveNavItem();

  const drawerBtn = document.querySelector("#drawer-button");
  const drawer = document.querySelector("#navigation-drawer");
  let trap = null;
  let escHandler = null;

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  let backdrop = document.querySelector(".nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);
  }

  function openDrawer() {
    if (!drawer || !drawerBtn) return;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    drawerBtn.setAttribute("aria-expanded", "true");

    if (isMobile()) document.body.classList.add("nav-open");

    trap = createFocusTrap(drawer, { initialFocus: ".nav-list a, button, [tabindex]" });
    trap.activate();

    escHandler = (e) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", escHandler);
  }

  function closeDrawer() {
    if (!drawer || !drawerBtn) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    drawerBtn.setAttribute("aria-expanded", "false");

    document.body.classList.remove("nav-open");

    trap?.deactivate();
    trap = null;

    if (escHandler) {
      document.removeEventListener("keydown", escHandler);
      escHandler = null;
    }
  }

  if (drawerBtn && drawer) {
    drawerBtn.setAttribute("aria-controls", "navigation-drawer");
    drawerBtn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("role", "dialog");

    drawerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains("open");
      isOpen ? closeDrawer() : openDrawer();
    });

    backdrop.addEventListener("click", () => {
      if (drawer.classList.contains("open")) closeDrawer();
    });

    drawer.addEventListener("click", (e) => {
      const target = e.target.closest("a, button");
      if (!target) return;
      if (target.tagName === "A") closeDrawer();
    });

    window.addEventListener("resize", () => {
      if (!isMobile()) document.body.classList.remove("nav-open");
    });

    document.addEventListener("click", (e) => {
      if (!isMobile()) return;
      const clickInsideDrawer = drawer.contains(e.target) || drawerBtn.contains(e.target) || backdrop.contains(e.target);
      if (!clickInsideDrawer && drawer.classList.contains("open")) {
        closeDrawer();
      }
    });
  }

  window.addEventListener("hashchange", async () => {
    if (drawer?.classList.contains("open")) closeDrawer();

    await withViewTransition(() => app.renderPage());
    updateAuthSection();
    setActiveNavItem();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });

  document.body.addEventListener("click", (e) => {
    if (e.target && e.target.id === "logout-btn") {
      localStorage.removeItem("token");
      localStorage.removeItem("name");
      alert("✅ Kamu sudah logout!");
      updateAuthSection();
      window.location.hash = "#/login";
      setActiveNavItem();
    }
  });
});
