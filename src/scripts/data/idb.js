const DB_NAME = "ustory-db";
const DB_VERSION = 1;
const STORE_STORIES = "stories";
const STORE_PENDING = "pending";
const STORE_FAVORITES = "favorites";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_STORIES)) {
        db.createObjectStore(STORE_STORIES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: "tempId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let fnResult;
    try {
      fnResult = fn(store);
    } catch (e) {
      reject(e);
      return;
    }

    tx.oncomplete = () => resolve(fnResult);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveStories(list = []) {
  await txStore(STORE_STORIES, "readwrite", (store) => {
    store.clear();
    list.forEach((item) => store.put(item));
  });
}

export async function getStories() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STORIES, "readonly");
    const store = tx.objectStore(STORE_STORIES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStory(id) {
  await txStore(STORE_STORIES, "readwrite", (store) => {
    store.delete(id);
  });
}

export async function addPendingStory(payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);

    const record = {
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingStories() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readonly");
    const store = tx.objectStore(STORE_PENDING);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPending(tempId) {
  await txStore(STORE_PENDING, "readwrite", (store) => {
    store.delete(tempId);
  });
}

export async function clearAllPending() {
  await txStore(STORE_PENDING, "readwrite", (store) => {
    store.clear();
  });
}

export async function addFavorite(story) {
  const payload = {
    id: story.id,
    name: story.name || "Anonim",
    description: story.description || "",
    photoUrl: story.photoUrl || "",
    lat: story.lat ?? null,
    lon: story.lon ?? null,
    createdAt: story.createdAt || new Date().toISOString(),
  };
  await txStore(STORE_FAVORITES, "readwrite", (store) => {
    store.put(payload);
  });
  return payload;
}

export async function removeFavorite(id) {
  await txStore(STORE_FAVORITES, "readwrite", (store) => {
    store.delete(id);
  });
}

export async function getFavorites() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readonly");
    const store = tx.objectStore(STORE_FAVORITES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function isFavorite(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readonly");
    const store = tx.objectStore(STORE_FAVORITES);
    const req = store.get(id);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}
