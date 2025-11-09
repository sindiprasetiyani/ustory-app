export async function ensureNotificationPermission() {
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };

  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };

  const perm = await Notification.requestPermission();
  return { ok: perm === "granted", reason: perm };
}
