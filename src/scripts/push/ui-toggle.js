import { subscribeWebPush, unsubscribeWebPush, getExistingSubscription, isPushSupported } from "./subscribe.js";

const TOGGLE_ID = "ustory-push-toggle";

function getToken() {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : parsed?.token || raw;
  } catch {
    return raw;
  }
}

export async function mountPushToggle(container = document.body) {
  const existingNode = document.getElementById(TOGGLE_ID);
  if (existingNode) return;

  if (!isPushSupported()) {
    console.warn("[Push] Browser tidak mendukung Service Worker / Push API.");
    return;
  }

  const wrap = document.createElement("div");
  wrap.id = TOGGLE_ID;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-live", "polite");
  wrap.setAttribute("aria-label", "Pengaturan Push Notification");
  wrap.style.cssText = `
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    background: #111827;
    color: #fff;
    padding: .75rem 1rem;
    border-radius: .75rem;
    box-shadow: 0 6px 20px rgba(0,0,0,.25);
    display: flex;
    gap: .5rem;
    align-items: center;
    z-index: 9999;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;

  const label = document.createElement("span");
  label.textContent = "Push Notification: …";
  label.style.fontSize = "14px";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Enable";
  btn.setAttribute("aria-pressed", "false");
  btn.style.cssText = `
    padding: .4rem .8rem;
    border-radius: .5rem;
    border: none;
    background: #10b981;
    color: #111827;
    font-weight: 600;
    cursor: pointer;
    transition: background .3s ease, opacity .2s ease;
  `;

  function showToast(msg, color = "#10b981") {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      bottom: 4.5rem;
      right: 1rem;
      background: ${color};
      color: #fff;
      padding: .6rem 1rem;
      border-radius: .5rem;
      font-size: 14px;
      opacity: 0;
      transform: translateY(20px);
      transition: all .3s ease;
      z-index: 10000;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(20px)";
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  async function refresh() {
    const token = getToken();
    const permission = Notification.permission;

    let enabled = false;
    try {
      const sub = await getExistingSubscription();
      enabled = !!sub;
    } catch {
      enabled = false;
    }

    if (!token) {
      label.textContent = "Push Notification: login terlebih dulu";
      btn.textContent = "Login Required";
      btn.disabled = true;
      btn.style.opacity = ".7";
      btn.setAttribute("aria-pressed", "false");
      btn.style.background = "#6b7280";
      return;
    }

    if (permission === "denied") {
      label.textContent = "Push Notification: BLOCKED (ubah di Site Settings)";
      btn.textContent = "Blocked";
      btn.disabled = true;
      btn.style.opacity = ".7";
      btn.setAttribute("aria-pressed", "false");
      btn.style.background = "#ef4444";
      return;
    }

    btn.disabled = false;
    btn.style.opacity = "1";
    btn.textContent = enabled ? "Disable" : "Enable";
    btn.setAttribute("aria-pressed", String(enabled));
    btn.style.background = enabled ? "#ef4444" : "#10b981";
    label.textContent = enabled ? "Push Notification: ON" : "Push Notification: OFF";
  }

  btn.addEventListener("click", async () => {
    const token = getToken();
    if (!token) {
      showToast("Silakan login terlebih dahulu", "#ef4444");
      await refresh();
      return;
    }

    btn.disabled = true;
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        await unsubscribeWebPush();
        showToast("🔕 Push notification dimatikan", "#ef4444");
      } else {
        await subscribeWebPush({ forceSync: true });
        showToast("🔔 Push notification diaktifkan");
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Gagal mengatur push notification.");
    } finally {
      await refresh();
      btn.disabled = false;
    }
  });

  wrap.append(label, btn);
  container.appendChild(wrap);

  refresh().catch(() => {});
}
