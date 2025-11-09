export default class AddPresenter {
  constructor({ api }) {
    this.api = api;
  }

  async submitStory(formData) {
    if (!formData.get("description")) {
      throw new Error("Deskripsi wajib diisi.");
    }
    return await this.api.addStory(formData);
  }
}
