// @ts-check
(function () {
  /**
   * @param {HTMLTextAreaElement} ta
   * @param {string} open
   * @param {string} close
   */
  function wrapSelection(ta, open, close) {
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const v = ta.value;
    const sel = v.slice(s, e);
    ta.value = v.slice(0, s) + open + sel + close + v.slice(e);
    const ns = s + open.length;
    const ne = ns + sel.length;
    ta.setSelectionRange(ns, ne);
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * @param {HTMLTextAreaElement} ta
   */
  function lineBounds(ta) {
    const v = ta.value;
    const pos = ta.selectionStart;
    const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
    const nextNl = v.indexOf('\n', pos);
    const lineEnd = nextNl === -1 ? v.length : nextNl;
    return { lineStart, lineEnd, v };
  }

  /**
   * @param {HTMLTextAreaElement} ta
   * @param {string} prefix
   */
  function setHeadingPrefix(ta, prefix) {
    const { lineStart, lineEnd, v } = lineBounds(ta);
    let line = v.slice(lineStart, lineEnd);
    line = line.replace(/^\s*#{1,6}\s+/, '');
    const newLine = prefix + line;
    ta.value = v.slice(0, lineStart) + newLine + v.slice(lineEnd);
    const newPos = lineStart + newLine.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * @param {HTMLTextAreaElement} ta
   */
  function bulletLine(ta) {
    const { lineStart, lineEnd, v } = lineBounds(ta);
    let line = v.slice(lineStart, lineEnd);
    if (/^\s*[-*]\s+/.test(line)) {
      line = line.replace(/^\s*[-*]\s+/, '');
    } else {
      line = '- ' + line.replace(/^\s*[-*]\s+/, '');
    }
    ta.value = v.slice(0, lineStart) + line + v.slice(lineEnd);
    ta.setSelectionRange(lineStart + line.length, lineStart + line.length);
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * @param {HTMLTextAreaElement} ta
   * @param {string} action
   */
  function applyMd(ta, action) {
    switch (action) {
      case 'bold':
        wrapSelection(ta, '**', '**');
        break;
      case 'italic':
        wrapSelection(ta, '*', '*');
        break;
      case 'code':
        wrapSelection(ta, '`', '`');
        break;
      case 'h1':
        setHeadingPrefix(ta, '# ');
        break;
      case 'h2':
        setHeadingPrefix(ta, '## ');
        break;
      case 'h3':
        setHeadingPrefix(ta, '### ');
        break;
      case 'bullet':
        bulletLine(ta);
        break;
      default:
        break;
    }
  }

  /**
   * @param {HTMLElement | null} toolbar
   * @param {HTMLTextAreaElement | null} textarea
   */
  function bind(toolbar, textarea) {
    if (!toolbar || !textarea) return;
    toolbar.querySelectorAll('[data-md]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const action = btn.getAttribute('data-md');
        if (action) applyMd(textarea, action);
      });
    });
  }

  /** @type {*} */ (window).DevNoteNoteToolbar = { bind };
})();
