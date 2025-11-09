import { getPendingStories, clearPending, addPendingStory } from "../data/idb.js";

const API_BASE = "https://story-api.dicoding.dev/v1";

function getToken() {
  try {
    const raw = localStorage.getItem("token");
    return raw && typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

export async function queueOfflineStory(payload) {
  try {
    if (!payload || !payload.description) throw new Error("Payload kosong");

    const data = {
      tempId: payload.tempId || Date.now(),
      description: payload.description,
      lat: typeof payload.lat === "number" ? payload.lat : null,
      lon: typeof payload.lon === "number" ? payload.lon : null,
      createdAt: new Date().toISOString(),
    };

    if (payload.photoBlob instanceof Blob) {
      data.photoBlob = payload.photoBlob;
    } else if (typeof payload.photoBase64 === "string") {
      data.photoBase64 = payload.photoBase64;
    } else if (payload.photoFile instanceof File) {
      data.photoBlob = payload.photoFile;
    }

    await addPendingStory(data);
    console.log(`[Queue] 📦 Story offline tersimpan (#${data.tempId})`);
    return { saved: true, tempId: data.tempId };
  } catch (err) {
    console.error("[Queue] ❌ Gagal menyimpan story offline:", err);
    return { saved: false, error: err.message };
  }
}

export async function syncPendingStories() {
  let list = [];
  try {
    list = await getPendingStories();
  } catch (err) {
    console.warn("[Sync] ⚠️ Gagal ambil data pending:", err);
    return { synced: 0, error: "idb-fail" };
  }

  if (!list || !list.length) {
    console.log("[Sync] Tidak ada story pending untuk dikirim.");
    return { synced: 0 };
  }

  const token = getToken();
  if (!token) return { synced: 0, error: "no-token" };

  let okCount = 0;
  console.log(`[Sync] 🚀 Mulai kirim ${list.length} story pending...`);

  for (const item of list) {
    try {
      const fd = new FormData();
      fd.append("description", item.description || "");
      if (typeof item.lat === "number") fd.append("lat", String(item.lat));
      if (typeof item.lon === "number") fd.append("lon", String(item.lon));

      if (item.photoBlob instanceof Blob) {
        fd.append("photo", item.photoBlob, `offline-${item.tempId || Date.now()}.jpg`);
      } else if (item.photoBase64) {
        const res = await fetch(item.photoBase64);
        const blob = await res.blob();
        fd.append("photo", blob, `offline-${item.tempId || Date.now()}.jpg`);
      }

      const res = await fetch(`${API_BASE}/stories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error(`POST /stories gagal (${res.status})`);

      await clearPending(item.tempId);
      okCount++;
      console.log(`[Sync] ✅ Story #${item.tempId} berhasil dikirim`);
    } catch (e) {
      console.warn(`[Sync] ⚠️ Story #${item.tempId} gagal dikirim: ${e.message}`);
    }
  }

  console.log(`[Sync] 🔁 Selesai. ${okCount}/${list.length} story tersinkron.`);
  return { synced: okCount, total: list.length };
}
