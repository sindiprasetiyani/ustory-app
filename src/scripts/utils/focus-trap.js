export function createFocusTrap(container, { initialFocus = null } = {}) {
  if (!container) return { activate() {}, deactivate() {} };

  const FOCUSABLE = ["a[href]", "area[href]", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", "button:not([disabled])", "[tabindex]:not([tabindex='-1'])"].join(",");

  let previouslyFocused = null;
  let keyHandler = null;

  function getFocusable() {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function onKeydown(e) {
    if (e.key !== "Tab") return;
    const focusables = getFocusable();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return {
    activate() {
      previouslyFocused = document.activeElement;
      container.setAttribute("aria-modal", "true");
      container.setAttribute("role", container.getAttribute("role") || "dialog");
      keyHandler = onKeydown.bind(container);
      document.addEventListener("keydown", keyHandler);

      const target = typeof initialFocus === "string" ? container.querySelector(initialFocus) : initialFocus || getFocusable()[0];

      setTimeout(() => target?.focus(), 0);
    },
    deactivate() {
      document.removeEventListener("keydown", keyHandler);
      container.removeAttribute("aria-modal");
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    },
  };
}
