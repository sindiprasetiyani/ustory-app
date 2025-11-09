export default class HomePresenter {
  constructor({ api }) {
    this.api = api;
  }

  async getStoriesWithLocation() {
    return await this.api.getStoriesWithLocation();
  }
}
