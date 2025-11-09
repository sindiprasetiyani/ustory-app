export default class AboutPage {
  async render() {
    document.title = "UStory — About";

    return `
      <section class="about-page" aria-labelledby="about-title">
        <h1 id="about-title">Tentang UStory</h1>

        <p>
          <strong>UStory</strong> adalah platform sederhana untuk <em>berbagi cerita</em> dan foto
          dari berbagai tempat di Indonesia. Kamu bisa menambahkan deskripsi, memilih lokasi
          langsung di peta, serta melihat cerita pengguna lain dalam daftar dan peta interaktif.
        </p>

        <p>
          Dibuat dengan ❤️ untuk memudahkan siapa pun berbagi momen dan lokasi.
        </p>
      </section>
    `;
  }

  async afterRender() {
    const title = document.getElementById("about-title");
    title?.setAttribute("tabindex", "-1");
    title?.focus({ preventScroll: false });
  }
}
