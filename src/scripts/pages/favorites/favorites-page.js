import { getFavorites, addFavorite, removeFavorite, isFavorite } from "../../data/idb.js";

export default class FavoritesPage {
  async render() {
    return `
      <section class="container">
        <h1>Favorite Stories</h1>
        <div id="fav-list" class="story-grid" aria-live="polite" aria-busy="true"></div>
      </section>
    `;
  }

  async afterRender() {
    const container = document.querySelector("#fav-list");
    container.setAttribute("aria-busy", "true");

    try {
      const list = await getFavorites();
      container.setAttribute("aria-busy", "false");

      if (!list || list.length === 0) {
        container.innerHTML = `<p style="text-align:center">Belum ada favorit. Tekan ❤ pada kartu di Beranda untuk menyimpan.</p>`;
        return;
      }

      container.innerHTML = list
        .map((s) => {
          const createdAtISO = s.createdAt ? new Date(s.createdAt).toISOString() : "";
          const createdAtText = s.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.createdAt)) : "";
          return `
            <article class="story-card" data-id="${s.id}" tabindex="0" aria-label="Story favorit dari ${s.name || "Anonim"}">
              <img src="${s.photoUrl}" alt="Foto story dari ${s.name || "Anonim"}">
              <div class="story-content">
                <h3>${s.name || "Anonim"}</h3>
                <p>${s.description || ""}</p>
                <p class="meta">
                  <time datetime="${createdAtISO}">${createdAtText}</time>
                </p>
                <div class="card-actions">
                  <a class="btn-light" href="#/">Lihat di Beranda</a>
                  <button class="fav-remove-btn btn-danger" data-id="${s.id}" aria-label="Hapus dari favorit">Hapus ❤</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      container.addEventListener("click", async (e) => {
        const btn = e.target.closest(".fav-remove-btn");
        if (!btn) return;
        const id = btn.dataset.id;
        try {
          await removeFavorite(id);
          const card = btn.closest(".story-card");
          card?.remove();
          if (!container.querySelector(".story-card")) {
            container.innerHTML = `<p style="text-align:center">Semua favorit dihapus.</p>`;
          }
        } catch (err) {
          console.warn("Gagal hapus favorit:", err);
          alert("Gagal menghapus favorit. Coba lagi.");
        }
      });
    } catch (err) {
      console.error(err);
      container.setAttribute("aria-busy", "false");
      container.innerHTML = `<p style="color:red;text-align:center">Gagal memuat data favorit.</p>`;
    }
  }
}
