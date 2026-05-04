// @ts-check
/** Shared by note editor webviews: prepend RTL/Vazir font styles to note Markdown (no wrapper div — that is applied at preview time). */
(function (global) {
  var STYLE_PREFIX =
    '<style>\n' +
    "@font-face {\n" +
    "  font-family: 'IRANSans';\n" +
    "  src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir-Regular.woff2') format('woff2'),\n" +
    "       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir-Regular.woff') format('woff');\n" +
    '  font-weight: normal;\n' +
    '  font-style: normal;\n' +
    '}\n' +
    '\n' +
    '.persian-doc {\n' +
    "  font-family: 'IRANSans', 'Vazir', 'Tahoma', 'Arial', sans-serif;\n" +
    '  direction: rtl;\n' +
    '  text-align: right;\n' +
    '}\n' +
    '\n' +
    '.persian-doc code,\n' +
    '.persian-doc pre {\n' +
    '  direction: ltr;\n' +
    '  text-align: left;\n' +
    "  font-family: 'Courier New', 'Consolas', monospace;\n" +
    '}\n' +
    '</style>\n';

  /** @param {string} text */
  function hasRtlFontBlock(text) {
    return text.indexOf('Vazir-Regular.woff2') !== -1 && text.indexOf('.persian-doc') !== -1;
  }

  global.DevNotePreviewRtl = {
    /** Prepend DevNote RTL/font `<style>` block if not already present (Markdown below stays parseable). */
    ensurePrefix: function (text) {
      var s = text == null ? '' : String(text);
      if (hasRtlFontBlock(s)) return s;
      return STYLE_PREFIX + s.replace(/^\s+/, '');
    },
  };
})(typeof window !== 'undefined' ? window : /** @type {*} */ ({}));
