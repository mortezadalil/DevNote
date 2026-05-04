import * as vscode from 'vscode';
import * as path from 'path';
import { NoteManager, Note } from './noteManager';
import { DecorationProvider } from './decorationProvider';
import { openNoteImage } from './openNoteImage';
import { resolveNoteFileAbsolutePath } from './resolveNoteFilePath';
import { revealNoteAnchorInWorkspace } from './noteNavigation';
import { workspaceDocumentUri } from './workspaceDocumentUri';
import { openNoteMarkdownPreview } from './noteMarkdownPreview';

interface PanelInput {
  filePath: string;
  line: number;            // 0-indexed
  selectedText: string;
  existingNote?: Note;
}

function panelCodeRefLocation(input: PanelInput): string {
  if (input.existingNote?.anchorUnknownReference === true) return input.filePath;
  return `${input.filePath}:${input.line + 1}`;
}

export class NoteWebviewPanel {
  private static currentPanel: NoteWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private pendingImages: string[] = [];   // image filenames already saved to disk
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    noteManager: NoteManager,
    decorationProvider: DecorationProvider,
    onSaved: () => void,
    input: PanelInput
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (NoteWebviewPanel.currentPanel) {
      NoteWebviewPanel.currentPanel.panel.reveal(column);
      NoteWebviewPanel.currentPanel.update(context, noteManager, decorationProvider, onSaved, input);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'devnoteEditor',
      'DevNote',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
          vscode.Uri.file(noteManager.getDevNoteDir() ?? context.extensionPath),
        ],
        retainContextWhenHidden: true,
      }
    );

    NoteWebviewPanel.currentPanel = new NoteWebviewPanel(
      panel,
      context,
      noteManager,
      decorationProvider,
      onSaved,
      input
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    noteManager: NoteManager,
    decorationProvider: DecorationProvider,
    onSaved: () => void,
    input: PanelInput
  ) {
    this.panel = panel;

    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.setupWebview(context, noteManager, decorationProvider, onSaved, input);
  }

  private update(
    context: vscode.ExtensionContext,
    noteManager: NoteManager,
    decorationProvider: DecorationProvider,
    onSaved: () => void,
    input: PanelInput
  ): void {
    this.pendingImages = input.existingNote ? [...input.existingNote.images] : [];
    this.panel.webview.html = this.getHtml(context, noteManager, input);
    this.sendInitData(noteManager, input);
  }

  private setupWebview(
    context: vscode.ExtensionContext,
    noteManager: NoteManager,
    decorationProvider: DecorationProvider,
    onSaved: () => void,
    input: PanelInput
  ): void {
    this.pendingImages = input.existingNote ? [...input.existingNote.images] : [];
    this.panel.webview.html = this.getHtml(context, noteManager, input);
    this.sendInitData(noteManager, input);

    this.panel.webview.onDidReceiveMessage(
      async msg => {
        switch (msg.type) {
          case 'save': {
            const { title, content } = msg;
            let note: Note;
            if (input.existingNote) {
              note = noteManager.updateNote(
                input.existingNote.id,
                title,
                content,
                this.pendingImages
              )!;
            } else {
              note = noteManager.createNote(
                input.filePath,
                input.line,
                input.selectedText,
                title,
                content,
                this.pendingImages
              );
            }
            decorationProvider.refreshAll();
            onSaved();
            this.panel.dispose();
            const ws = noteManager.getWorkspaceRoot();
            if (ws) await revealNoteAnchorInWorkspace(ws, note.fileRelativePath, note.line, decorationProvider);
            break;
          }
          case 'cancel': {
            this.panel.dispose();
            const ws = noteManager.getWorkspaceRoot();
            if (ws) {
              const abs = resolveNoteFileAbsolutePath(ws, input.filePath);
              if (abs) {
                const uri = workspaceDocumentUri(abs);
                vscode.workspace.openTextDocument(uri).then(doc => {
                  vscode.window.showTextDocument(doc, { preview: false });
                });
              }
            }
            break;
          }
          case 'saveImage': {
            const { base64, mimeType } = msg;
            const noteId = input.existingNote?.id ?? 'tmp_' + Date.now();
            const filename = noteManager.saveImage(noteId, base64, mimeType);
            this.pendingImages.push(filename);
            const fsPath = noteManager.getImageFsPath(filename);
            if (fsPath) {
              const uri = this.panel.webview.asWebviewUri(vscode.Uri.file(fsPath));
              this.panel.webview.postMessage({ type: 'imageSaved', uri: uri.toString(), filename });
            }
            break;
          }
          case 'deleteImage': {
            const { filename } = msg;
            this.pendingImages = this.pendingImages.filter(f => f !== filename);
            break;
          }
          case 'openImage': {
            if (typeof msg.filename === 'string') {
              await openNoteImage(noteManager, msg.filename);
            }
            break;
          }
          case 'openMarkdownPreview': {
            const title = typeof msg.title === 'string' ? msg.title : '';
            const markdown = typeof msg.markdown === 'string' ? msg.markdown : '';
            const wrapPersianDoc = msg.wrapPersianDoc === true;
            openNoteMarkdownPreview(context, noteManager, title, markdown, wrapPersianDoc);
            break;
          }
        }
      },
      null,
      this.disposables
    );
  }

  private sendInitData(noteManager: NoteManager, input: PanelInput): void {
    const existing = input.existingNote;
    const images: Array<{ filename: string; uri: string }> = [];

    for (const filename of this.pendingImages) {
      const fsPath = noteManager.getImageFsPath(filename);
      if (fsPath) {
        const uri = this.panel.webview.asWebviewUri(vscode.Uri.file(fsPath));
        images.push({ filename, uri: uri.toString() });
      }
    }

    this.panel.webview.postMessage({
      type: 'init',
      title: existing?.title ?? '',
      content: existing ? noteManager.getNoteContent(existing) : '',
      selectedText: input.selectedText,
      filePath: input.filePath,
      line: input.line + 1,
      locationDisplay: panelCodeRefLocation(input),
      images,
      anchorUnknownReference: existing?.anchorUnknownReference === true,
    });
  }

  private getHtml(
    context: vscode.ExtensionContext,
    noteManager: NoteManager,
    input: PanelInput
  ): string {
    const webview = this.panel.webview;
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'noteEditor.css'))
    );
    const toolbarCssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'note-text-toolbar.css'))
    );
    const rtlUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'rtl-utils.js'))
    );
    const toolbarJsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'note-text-toolbar.js'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'noteEditor.js'))
    );
    const previewHelpersUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'note-preview-helpers.js'))
    );

    const devNoteDir = noteManager.getDevNoteDir();
    const devNoteUri = devNoteDir
      ? webview.asWebviewUri(vscode.Uri.file(devNoteDir)).toString()
      : '';

    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `img-src ${webview.cspSource} data: blob:`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <link rel="stylesheet" href="${toolbarCssUri}" />
  <title>DevNote</title>
</head>
<body data-devnote-dir="${devNoteUri}">
  <div class="container">

    <div class="header">
      <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span class="header-title">DevNote</span>
    </div>

    <div class="code-ref">
      <div class="code-ref-bar">
        <span class="code-ref-label">Code reference</span>
        <span class="code-ref-meta">
          <span class="code-ref-location" id="file-location"></span>
          <span class="anchor-unknown-badge" id="anchor-unknown-badge" hidden>Unknown reference</span>
        </span>
      </div>
      <pre class="code-snippet" id="code-snippet"></pre>
    </div>

    <div class="field">
      <label for="note-title">Title</label>
      <input id="note-title" type="text" placeholder="Give this note a title…" autocomplete="off" />
    </div>

    <div class="field">
      <label for="note-content">Note</label>
      <div class="note-md-toolbar" id="note-md-toolbar" role="toolbar" aria-label="Markdown formatting">
        <button type="button" class="md-btn" data-md="bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="md-btn" data-md="italic" title="Italic"><em>I</em></button>
        <button type="button" class="md-btn" data-md="code" title="Inline code"><span style="font-family:var(--font-mono);">&#96;</span></button>
        <span class="md-toolbar-sep" aria-hidden="true"></span>
        <button type="button" class="md-btn" data-md="h1" title="Heading 1">H1</button>
        <button type="button" class="md-btn" data-md="h2" title="Heading 2">H2</button>
        <button type="button" class="md-btn" data-md="h3" title="Heading 3">H3</button>
        <span class="md-toolbar-sep" aria-hidden="true"></span>
        <button type="button" class="md-btn" data-md="bullet" title="Bullet list">•</button>
        <span class="md-toolbar-sep" aria-hidden="true"></span>
        <button type="button" class="md-btn md-btn-preview" id="btn-md-preview" title="Open Markdown preview in a separate editor tab">Preview</button>
        <button type="button" class="md-btn md-btn-preview-rtl" id="btn-md-preview-rtl" title="Add Persian/RTL font and layout to the note, then preview">Preview RTL</button>
      </div>
      <textarea id="note-content" placeholder="Write your note here — markdown is supported…" rows="8"></textarea>
    </div>

    <div class="field">
      <label>Images</label>
      <div class="images-grid" id="images-grid"></div>
      <div class="image-actions">
        <button class="btn-upload" id="btn-upload">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload image
        </button>
        <input id="file-input" type="file" accept="image/*" style="display:none" />
        <span class="paste-hint">or paste with Ctrl+V / ⌘V</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-cancel" id="btn-cancel">Cancel</button>
      <button class="btn-save" id="btn-save">Save note</button>
    </div>

  </div>
  <script nonce="${nonce}" src="${rtlUri}"></script>
  <script nonce="${nonce}" src="${previewHelpersUri}"></script>
  <script nonce="${nonce}" src="${toolbarJsUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    NoteWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
