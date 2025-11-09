import AuthApi from "../../data/auth-api";

export default class RegisterPage {
  async render() {
    return `
      <section class="container register-page">
        <h1>Daftar Akun Baru</h1>
        <form id="register-form">
          <div class="form-group">
            <label for="name">Nama</label>
            <input type="text" id="name" required />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required />
          </div>

          <button type="submit">Daftar</button>
        </form>

        <p>Sudah punya akun? <a href="#/login">Login</a></p>

        <div id="register-message"></div>
      </section>
    `;
  }

  async afterRender() {
    const form = document.querySelector("#register-form");
    const message = document.querySelector("#register-message");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#name").value;
      const email = document.querySelector("#email").value;
      const password = document.querySelector("#password").value;

      message.textContent = "📩 Sedang mendaftar...";

      try {
        const result = await AuthApi.register({ name, email, password });

        if (!result.error) {
          message.textContent = "✅ Registrasi berhasil! Silakan login.";
          window.location.hash = "#/login";
        } else {
          message.textContent = `❌ ${result.message}`;
        }
      } catch (error) {
        message.textContent = `⚠️ Terjadi kesalahan: ${error.message}`;
      }
    });
  }
}
