// @ts-check
(function () {
  const vscode = acquireVsCodeApi();

  const viewList   = /** @type {HTMLElement} */ (document.getElementById('view-list'));
  const viewEditor = /** @type {HTMLElement} */ (document.getElementById('view-editor'));
  const notesList  = /** @type {HTMLElement} */ (document.getElementById('notes-list'));
  const emptyState = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
  const titleEl    = /** @type {HTMLInputElement} */ (document.getElementById('note-title'));
  const contentEl  = /** @type {HTMLTextAreaElement} */ (document.getElementById('note-content'));
  const imagesGrid = /** @type {HTMLElement} */ (document.getElementById('images-grid'));
  const fileInput  = /** @type {HTMLInputElement} */ (document.getElementById('file-input'));
  const codeSnippet   = /** @type {HTMLElement} */ (document.getElementById('code-snippet'));
  const fileLocation  = /** @type {HTMLElement} */ (document.getElementById('file-location'));

  /** @type {{ setDirectionFromText: (el: HTMLElement | null, text: unknown) => void; textNeedsRtl: (text: unknown) => boolean }} */
  const Rtl = /** @type {*} */ (window).DevNoteRtl ?? {
    setDirectionFromText() {},
    textNeedsRtl() {
      return false;
    },
  };

  function showView(name) {
    viewList.style.display   = name === 'list'   ? '' : 'none';
    viewEditor.style.display = name === 'editor' ? '' : 'none';
  }

  // ── Messages from extension ───────────────────────────────────────────────
  window.addEventListener('message', (/** @type {MessageEvent} */ e) => {
    const msg = e.data;
    switch (msg.type) {
      case 'showList':
        renderList(msg.notes);
        showView('list');
        break;
      case 'showEditor':
        titleEl.value    = msg.title   ?? '';
        contentEl.value  = msg.content ?? '';
        codeSnippet.textContent = msg.selectedText || '(no selection)';
        fileLocation.textContent =
          typeof msg.locationDisplay === 'string' ? msg.locationDisplay : `${msg.filePath}:${msg.line}`;
        fileLocation.setAttribute('dir', 'ltr');
        const sideBadge = /** @type {HTMLElement} */ (document.getElementById('anchor-unknown-badge'));
        if (sideBadge) {
          if (msg.anchorUnknownReference) sideBadge.removeAttribute('hidden');
          else sideBadge.setAttribute('hidden', '');
        }
        Rtl.setDirectionFromText(titleEl, titleEl.value);
        Rtl.setDirectionFromText(contentEl, contentEl.value);
        Rtl.setDirectionFromText(codeSnippet, codeSnippet.textContent);
        imagesGrid.innerHTML = '';
        for (const img of (msg.images ?? [])) addImageThumb(img.uri, img.filename);
        showView('editor');
        setTimeout(() => titleEl.focus(), 50);
        break;
      case 'imageSaved':
        addImageThumb(msg.uri, msg.filename);
        break;
    }
  });

  // ── List rendering ────────────────────────────────────────────────────────
  function renderList(notes) {
    notesList.innerHTML = '';
    if (!notes || notes.length === 0) {
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';

    /** @type {Map<string, any[]>} */
    const byFile = new Map();
    for (const note of notes) {
      const arr = byFile.get(note.fileRelativePath) ?? [];
      arr.push(note);
      byFile.set(note.fileRelativePath, arr);
    }

    for (const [filePath, fileNotes] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const group = document.createElement('div');
      group.className = 'file-group';

      const fileName = filePath.split('/').pop() || filePath;
      const fileDir  = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

      const header = document.createElement('div');
      header.className = 'file-header';
      header.innerHTML =
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
          `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>` +
          `<polyline points="14 2 14 8 20 8"/>` +
        `</svg>` +
        `<span class="file-name">${esc(fileName)}</span>` +
        (fileDir ? `<span class="file-dir">${esc(fileDir)}</span>` : '');
      group.appendChild(header);

      for (const note of [...fileNotes].sort((a, b) => a.line - b.line)) {
        group.appendChild(createNoteEl(note));
      }
      notesList.appendChild(group);
    }
  }

  function createNoteEl(note) {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.innerHTML =
      `<div class="note-main">` +
        `<div class="note-info">` +
        `<div class="note-title-row">` +
          `<span class="note-title">${esc(note.title || 'Untitled note')}</span>` +
          (note.anchorUnknownReference
            ? `<span class="note-ref-unknown" title="Original code range was deleted">Unknown reference</span>`
            : '') +
        `</div>` +
        `<span class="note-line" dir="ltr">${note.anchorUnknownReference ? '(no code anchor)' : `Line ${note.line + 1}`}</span>` +
      `</div>` +
      `</div>` +
      `<div class="note-actions">` +
        `<button class="icon-btn edit-btn" title="Edit note">` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>` +
            `<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>` +
          `</svg>` +
        `</button>` +
        `<button class="icon-btn delete-btn" title="Delete note">` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<polyline points="3 6 5 6 21 6"/>` +
            `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>` +
            `<path d="M10 11v6M14 11v6"/>` +
            `<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>` +
          `</svg>` +
        `</button>` +
      `</div>`;

    item.querySelector('.note-main')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigateTo', filePath: note.fileRelativePath, line: note.line });
    });
    item.querySelector('.edit-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      vscode.postMessage({ type: 'editNote', noteId: note.id });
    });
    item.querySelector('.delete-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      vscode.postMessage({ type: 'deleteNote', noteId: note.id });
    });

    const titleSpan = item.querySelector('.note-title');
    const noteInfo = item.querySelector('.note-info');
    const displayTitle = note.title || 'Untitled note';
    Rtl.setDirectionFromText(titleSpan, displayTitle);
    if (noteInfo) {
      noteInfo.classList.toggle('note-info--rtl', Rtl.textNeedsRtl(displayTitle));
    }

    return item;
  }

  // ── Editor interactions ───────────────────────────────────────────────────
  document.getElementById('btn-back')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'back' });
  });

  document.getElementById('btn-cancel')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'back' });
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'save', title: titleEl.value.trim(), content: contentEl.value });
  });

  document.getElementById('btn-upload')?.addEventListener('click', () => fileInput.click());

  titleEl.addEventListener('input', () => Rtl.setDirectionFromText(titleEl, titleEl.value));
  contentEl.addEventListener('input', () => Rtl.setDirectionFromText(contentEl, contentEl.value));

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) { readAndSendImage(fileInput.files[0]); fileInput.value = ''; }
  });

  document.addEventListener('paste', e => {
    if (viewEditor.style.display === 'none') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) { readAndSendImage(file); break; }
      }
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function readAndSendImage(file) {
    const reader = new FileReader();
    reader.onload = () => vscode.postMessage({ type: 'saveImage', base64: reader.result, mimeType: file.type });
    reader.readAsDataURL(file);
  }

  function addImageThumb(uri, filename) {
    const wrap = document.createElement('div');
    wrap.className = 'image-thumb';

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
    btn.className = 'remove-btn'; btn.title = 'Remove'; btn.textContent = '×';
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'deleteImage', filename });
      wrap.remove();
    });

    wrap.appendChild(img); wrap.appendChild(btn);
    imagesGrid.appendChild(wrap);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const mdToolbar = document.getElementById('note-md-toolbar');
  const Tbar = /** @type {{ bind?: (a: HTMLElement | null, b: HTMLTextAreaElement | null) => void }} */ (
    /** @type {*} */ (window).DevNoteNoteToolbar
  );
  if (Tbar?.bind) Tbar.bind(mdToolbar, contentEl);

  // ── Boot ──────────────────────────────────────────────────────────────────
  vscode.postMessage({ type: 'ready' });
})();
