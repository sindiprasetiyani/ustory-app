import { ensureNotificationPermission } from "./ask-permission.js";

const VAPID_PUBLIC_KEY = "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";

const PUSH_API_BASE = "https://story-api.dicoding.dev/v1";

function apiUrl(path) {
  return path.startsWith("http") ? path : `${PUSH_API_BASE}${path}`;
}

function urlBase64ToUint8Array(base64String) {
  const pad = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function getAccessToken() {
  try {
    const raw = localStorage.getItem("token");
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : parsed?.token || raw;
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

async function callAPI(method, path, body) {
  const token = getAccessToken();
  const url = apiUrl(path);
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${url} failed (${res.status}) ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function getReadyRegistration() {
  if (!isPushSupported()) throw new Error("Push not supported in this browser.");
  return navigator.serviceWorker.ready;
}

function subToPayload(sub) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: JSON.stringify(json.keys),
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };
}

export async function getExistingSubscription() {
  const reg = await getReadyRegistration();
  return reg.pushManager.getSubscription();
}

export async function subscribeWebPush({ forceSync = true } = {}) {
  const perm = await ensureNotificationPermission();
  if (!perm.ok) throw new Error(`Permission not granted: ${perm.reason}`);

  const reg = await getReadyRegistration();
  const existing = await reg.pushManager.getSubscription();

  if (existing) {
    if (forceSync) {
      try {
        await callAPI("POST", "/notifications/subscribe", subToPayload(existing));
      } catch (e) {
        console.warn("[Push] sync existing subscription failed:", e.message);
      }
    }
    return existing;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const payload = subToPayload(sub);
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      await callAPI("POST", "/notifications/subscribe", payload);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  if (lastErr) {
    console.warn("[Push] subscribe saved locally but failed on server:", lastErr.message);
  }
  return sub;
}

export async function unsubscribeWebPush() {
  const reg = await getReadyRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;

  try {
    await callAPI("DELETE", "/notifications/subscribe", { endpoint: sub.endpoint });
  } catch (e) {
    console.warn("[Push] server unsubscribe failed, continue local:", e.message);
  }

  return sub.unsubscribe();
}

export async function syncServerSubscription() {
  try {
    const sub = await getExistingSubscription();
    if (!sub) return false;
    await callAPI("POST", "/notifications/subscribe", subToPayload(sub));
    return true;
  } catch (e) {
    console.warn("[Push] syncServerSubscription failed:", e.message);
    return false;
  }
}

export async function resubscribeIfNeeded() {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await getReadyRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) return true;

  try {
    await subscribeWebPush({ forceSync: true });
    return true;
  } catch (e) {
    console.warn("[Push] resubscribeIfNeeded failed:", e.message);
    return false;
  }
}

export async function getPushStatus() {
  const supported = isPushSupported();
  const permission = supported ? Notification.permission : "denied";
  let subscribed = false;
  let endpoint = null;

  if (supported) {
    try {
      const sub = await getExistingSubscription();
      subscribed = !!sub;
      endpoint = sub?.endpoint || null;
    } catch {
      subscribed = false;
    }
  }
  return { supported, permission, subscribed, endpoint };
}
