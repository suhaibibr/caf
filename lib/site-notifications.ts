export const RECIPE_ADDED_EVENT = "caf-recipe-added";

export type RecipeAddedNotification = {
  type: "recipe-added";
  recipeName: string;
  authorName: string;
  roasterName: string;
};

const STORAGE_KEY = "caf-site-notification";

export function announceRecipeAdded(payload: RecipeAddedNotification) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  window.dispatchEvent(new CustomEvent(RECIPE_ADDED_EVENT, { detail: payload }));
}

export function readPendingNotification() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (!value) {
      return null;
    }

    window.sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(value) as RecipeAddedNotification;
  } catch {
    return null;
  }
}
