import { subscribeWebPush, unsubscribeWebPush, getExistingSubscription } from "./subscribe.js";

export function mountPushToggle(container = document.body) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Push] Browser tidak mendukung Service Worker / Push API.");
    return;
  }

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-label", "Push Notification Toggle");
  wrap.style = `
    position:fixed;
    right:1rem;
    bottom:1rem;
    background:#111827;
    color:#fff;
    padding:.75rem 1rem;
    border-radius:.75rem;
    box-shadow:0 6px 20px rgba(0,0,0,.25);
    display:flex;
    gap:.5rem;
    align-items:center;
    z-index:9999;
    font-family:system-ui, sans-serif;
  `;

  const label = document.createElement("span");
  label.textContent = "Push Notification";
  label.style.fontSize = "14px";

  const btn = document.createElement("button");
  btn.textContent = "Enable";
  btn.setAttribute("aria-pressed", "false");
  btn.style = `
    padding:.4rem .8rem;
    border-radius:.5rem;
    border:none;
    background:#10b981;
    color:#111827;
    font-weight:600;
    cursor:pointer;
    transition:background .3s ease;
  `;

  function showToast(msg, color = "#10b981") {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style = `
      position:fixed;
      bottom:4.5rem;
      right:1rem;
      background:${color};
      color:#fff;
      padding:.6rem 1rem;
      border-radius:.5rem;
      font-size:14px;
      opacity:0;
      transform:translateY(20px);
      transition:all .3s ease;
      z-index:99999;
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
    const sub = await getExistingSubscription();
    const enabled = !!sub;
    btn.textContent = enabled ? "Disable" : "Enable";
    btn.setAttribute("aria-pressed", String(enabled));
    btn.style.background = enabled ? "#ef4444" : "#10b981";
    label.textContent = enabled ? "Push Notification: ON" : "Push Notification: OFF";
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        await unsubscribeWebPush();
        showToast("🔕 Push notification dimatikan", "#ef4444");
      } else {
        await subscribeWebPush();
        showToast("🔔 Push notification diaktifkan");
      }
    } catch (e) {
      alert(e.message || "Gagal mengatur push notification.");
      console.error(e);
    } finally {
      await refresh();
      btn.disabled = false;
    }
  });

  wrap.append(label, btn);
  container.appendChild(wrap);
  refresh();
}
