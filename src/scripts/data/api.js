const BASE_URL = "https://story-api.dicoding.dev/v1";

class DicodingStoryApi {
  static async getStoriesWithLocation() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/stories?location=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) throw new Error("Token tidak valid atau kadaluarsa");
      if (!response.ok) throw new Error("Gagal mengambil data story dengan lokasi");

      const data = await response.json();
      return data.listStory || [];
    } catch (error) {
      console.error("❌ Error fetching stories with location:", error);
      DicodingStoryApi._notifyError(error.message);
      return [];
    }
  }

  static async getAllStories() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/stories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) throw new Error("Token tidak valid atau kadaluarsa");
      if (!response.ok) throw new Error("Gagal mengambil semua story");

      const data = await response.json();
      return data.listStory || [];
    } catch (error) {
      console.error("❌ Error fetching all stories:", error);
      DicodingStoryApi._notifyError(error.message);
      return [];
    }
  }

  static async getStoryById(storyId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/stories/${storyId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) throw new Error("Token tidak valid atau kadaluarsa");
      if (!response.ok) throw new Error("Gagal mengambil detail story");

      const data = await response.json();
      return data.story;
    } catch (error) {
      console.error("❌ Error fetching story detail:", error);
      DicodingStoryApi._notifyError(error.message);
      throw error;
    }
  }

  static async addStory(formData) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/stories`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (response.status === 401) throw new Error("Token tidak valid atau kadaluarsa");
      if (!response.ok) throw new Error(result.message || "Gagal menambahkan story");

      DicodingStoryApi._notifySuccess("Story berhasil ditambahkan 🎉");
      return result;
    } catch (error) {
      console.error("❌ Error adding story:", error);
      DicodingStoryApi._notifyError(error.message);
      throw error;
    }
  }

  static async deleteStory(storyId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/stories/${storyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) throw new Error("Token tidak valid atau kadaluarsa");
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Gagal menghapus story");
      }

      DicodingStoryApi._notifySuccess("Story berhasil dihapus 🗑️");
      return { success: true };
    } catch (error) {
      console.error("❌ Error deleting story:", error);
      DicodingStoryApi._notifyError(error.message);
      throw error;
    }
  }

  static _notifySuccess(message) {
    window.dispatchEvent(
      new CustomEvent("api-notify", {
        detail: { type: "success", message },
      })
    );
  }

  static _notifyError(message) {
    window.dispatchEvent(
      new CustomEvent("api-notify", {
        detail: { type: "error", message },
      })
    );
  }
}

export default DicodingStoryApi;
