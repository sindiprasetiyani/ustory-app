import AuthApi from "../../data/auth-api";

export default class LoginPage {
  async render() {
    return `
      <section class="container login-page">
        <h1>Login</h1>
        <form id="login-form" class="form-card">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="Masukkan email" required />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Masukkan password" required />
          </div>

          <button type="submit" id="login-btn">Login</button>
        </form>

        <p>Belum punya akun? <a href="#/register">Daftar di sini</a></p>

        <p id="login-message" class="message"></p>
      </section>
    `;
  }

  async afterRender() {
    const form = document.querySelector("#login-form");
    const message = document.querySelector("#login-message");
    const loginButton = document.querySelector("#login-btn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();

      // Validasi sederhana sebelum kirim request
      if (!email || !password) {
        message.style.color = "red";
        message.textContent = "⚠️ Email dan password wajib diisi.";
        return;
      }

      loginButton.disabled = true;
      loginButton.textContent = "⏳ Logging in...";
      message.style.color = "black";
      message.textContent = "Sedang memproses login...";

      try {
        const result = await AuthApi.login({ email, password });

        if (result.error) {
          message.style.color = "red";
          message.textContent = `❌ ${result.message}`;
        } else {
          localStorage.setItem("token", result.loginResult.token);
          localStorage.setItem("name", result.loginResult.name);

          message.style.color = "green";
          message.textContent = "✅ Login berhasil! Mengalihkan...";

          // Redirect
          setTimeout(() => {
            window.location.hash = "#/";
          }, 1200);
        }
      } catch (error) {
        console.error("Login error:", error);
        message.style.color = "red";
        message.textContent = `⚠️ Gagal login: ${error.message}`;
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
      }
    });
  }
}
