// @ts-check
/** Persian / Arabic script ranges (incl. presentation forms). Shared by sidebar + note editor webviews. */
(function (g) {
  const ARABIC_SCRIPT =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  /**
   * @param {string} text
   */
  function textNeedsRtl(text) {
    const t = text == null ? '' : String(text);
    return ARABIC_SCRIPT.test(t);
  }

  /**
   * Sets dir="rtl" when text contains Arabic script, dir="ltr" for non-empty Latin-only, dir="auto" when empty.
   * @param {HTMLElement | null} el
   * @param {unknown} text
   */
  function setDirectionFromText(el, text) {
    if (!el) return;
    const t = text == null ? '' : String(text);
    if (!t.trim()) {
      el.setAttribute('dir', 'auto');
      return;
    }
    el.setAttribute('dir', textNeedsRtl(t) ? 'rtl' : 'ltr');
  }

  g.DevNoteRtl = { textNeedsRtl, setDirectionFromText, ARABIC_SCRIPT };
})(typeof globalThis !== 'undefined' ? globalThis : /** @type {*} */ (window));
