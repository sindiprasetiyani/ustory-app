import HomePage from "../pages/home/home-page";
import AddPage from "../pages/add/add-page";
import LoginPage from "../pages/login/login-page";
import RegisterPage from "../pages/register/register-page";
import AboutPage from "../pages/about/about-page";
import FavoritesPage from "../pages/favorites/favorites-page";

const routes = {
  "/": new HomePage(),
  "/add": new AddPage(),
  "/login": new LoginPage(),
  "/register": new RegisterPage(),
  "/about": new AboutPage(),
  "/favorites": new FavoritesPage(),
};

export default routes;
