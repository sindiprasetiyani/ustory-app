const CONFIG = {
  // base URL utama untuk semua endpoint API Dicoding Story
  BASE_URL: "https://story-api.dicoding.dev/v1",

  // base URL khusus untuk Push Notification API (sama dengan BASE_URL)
  PUSH_API_BASE: "https://story-api.dicoding.dev/v1",

  // public key VAPID untuk Web Push (punya kamu sendiri)
  VAPID_PUBLIC_KEY: "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk",

  // (opsional) key path untuk object store jika perlu konsisten
  DATABASE_NAME: "ustory-db",
  DATABASE_VERSION: 1,
  OBJECT_STORE_NAME: "stories",
};

export default CONFIG;
