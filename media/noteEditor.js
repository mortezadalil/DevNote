// @ts-check
(function () {
  const vscode = acquireVsCodeApi();

  const titleEl = /** @type {HTMLInputElement} */ (document.getElementById('note-title'));
  const contentEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('note-content'));
  const imagesGrid = /** @type {HTMLElement} */ (document.getElementById('images-grid'));
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('file-input'));
  const codeSnippet = /** @type {HTMLElement} */ (document.getElementById('code-snippet'));
  const fileLocation = /** @type {HTMLElement} */ (document.getElementById('file-location'));

  /** @type {{ setDirectionFromText: (el: HTMLElement | null, text: unknown) => void }} */
  const Rtl = /** @type {*} */ (window).DevNoteRtl;

  // ── Init data from extension ──────────────────────────────────────────────
  window.addEventListener('message', (/** @type {MessageEvent} */ e) => {
    const msg = e.data;
    if (msg.type === 'init') {
      titleEl.value = msg.title ?? '';
      contentEl.value = msg.content ?? '';
      codeSnippet.textContent = msg.selectedText || '(no selection)';
      fileLocation.textContent = `${msg.filePath}:${msg.line}`;
      fileLocation.setAttribute('dir', 'ltr');
      Rtl.setDirectionFromText(titleEl, titleEl.value);
      Rtl.setDirectionFromText(contentEl, contentEl.value);
      Rtl.setDirectionFromText(codeSnippet, codeSnippet.textContent);

      // Restore existing images
      for (const img of (msg.images ?? [])) {
        addImageThumb(img.uri, img.filename);
      }
      titleEl.focus();
    } else if (msg.type === 'imageSaved') {
      addImageThumb(msg.uri, msg.filename);
    }
  });

  // ── Buttons ───────────────────────────────────────────────────────────────
  document.getElementById('btn-save')?.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save',
      title: titleEl.value.trim(),
      content: contentEl.value,
    });
  });

  document.getElementById('btn-cancel')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  document.getElementById('btn-upload')?.addEventListener('click', () => {
    fileInput.click();
  });

  titleEl.addEventListener('input', () => Rtl.setDirectionFromText(titleEl, titleEl.value));
  contentEl.addEventListener('input', () => Rtl.setDirectionFromText(contentEl, contentEl.value));

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      readAndSendImage(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // ── Paste ─────────────────────────────────────────────────────────────────
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) readAndSendImage(file);
        break;
      }
    }
  });

  // ── Drag & drop ───────────────────────────────────────────────────────────
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-over');
  });

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) document.body.classList.remove('drag-over');
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        readAndSendImage(file);
      }
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  /**
   * @param {File} file
   */
  function readAndSendImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = /** @type {string} */ (reader.result);
      vscode.postMessage({ type: 'saveImage', base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  /**
   * @param {string} uri
   * @param {string} filename
   */
  function addImageThumb(uri, filename) {
    const wrap = document.createElement('div');
    wrap.className = 'image-thumb';
    wrap.dataset.filename = filename;

    const img = document.createElement('img');
    img.src = uri;
    img.alt = filename;
    img.title = 'Open image in editor';
    img.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({ type: 'openImage', filename });
    });

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.title = 'Remove image';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'deleteImage', filename });
      wrap.remove();
    });

    wrap.appendChild(img);
    wrap.appendChild(btn);
    imagesGrid.appendChild(wrap);
  }
})();
