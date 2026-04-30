import * as vscode from 'vscode';
import * as path from 'path';
import { NoteManager, Note } from './noteManager';
import { DecorationProvider } from './decorationProvider';
import { openNoteImage } from './openNoteImage';
import { revealNoteAnchorInWorkspace } from './noteNavigation';

export interface EditorInput {
  filePath: string;
  line: number;       // 0-indexed
  selectedText: string;
  existingNote?: Note;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'devnote.sidebar';

  private _view?: vscode.WebviewView;
  private _pendingImages: string[] = [];
  private _currentInput?: EditorInput;
  private _pendingEditorInput?: EditorInput;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly noteManager: NoteManager,
    private readonly decorationProvider: DecorationProvider,
    private readonly onSaved: () => void
  ) {
    noteManager.onDidChangeNotes(() => this.refresh());
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    const devNoteDir = this.noteManager.getDevNoteDir();
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        ...(devNoteDir ? [vscode.Uri.file(devNoteDir)] : []),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.onDidDispose(() => { this._view = undefined; });

    webviewView.webview.onDidReceiveMessage(async msg => {
      switch (msg.type) {
        case 'ready':
          if (this._pendingEditorInput) {
            const input = this._pendingEditorInput;
            this._pendingEditorInput = undefined;
            this._doShowEditor(input);
          } else {
            this._sendList();
          }
          break;

        case 'back':
          this._sendList();
          break;

        case 'navigateTo':
          await this._navigateTo(msg.filePath, msg.line);
          break;

        case 'editNote': {
          const note = this.noteManager.getNoteById(msg.noteId);
          if (note) {
            this._doShowEditor({
              filePath: note.fileRelativePath,
              line: note.line,
              selectedText: note.selectedText,
              existingNote: note,
            });
          }
          break;
        }

        case 'deleteNote': {
          const answer = await vscode.window.showWarningMessage(
            'Delete this note permanently?', { modal: true }, 'Delete'
          );
          if (answer === 'Delete') {
            this.noteManager.deleteNote(msg.noteId);
            this.decorationProvider.refreshAll();
          }
          break;
        }

        case 'save': {
          if (!this._currentInput) break;
          const { title, content } = msg;
          let note: Note;
          if (this._currentInput.existingNote) {
            note = this.noteManager.updateNote(
              this._currentInput.existingNote.id, title, content, this._pendingImages
            )!;
          } else {
            note = this.noteManager.createNote(
              this._currentInput.filePath, this._currentInput.line,
              this._currentInput.selectedText, title, content, this._pendingImages
            );
          }
          this.decorationProvider.refreshAll();
          this.onSaved();
          this._sendList();
          await this._navigateTo(note.fileRelativePath, note.line);
          break;
        }

        case 'saveImage': {
          if (!this._currentInput) break;
          const noteId = this._currentInput.existingNote?.id ?? 'tmp_' + Date.now();
          const filename = this.noteManager.saveImage(noteId, msg.base64, msg.mimeType);
          this._pendingImages.push(filename);
          const fsPath = this.noteManager.getImageFsPath(filename);
          if (fsPath && this._view) {
            const uri = this._view.webview.asWebviewUri(vscode.Uri.file(fsPath));
            this._view.webview.postMessage({ type: 'imageSaved', uri: uri.toString(), filename });
          }
          break;
        }

        case 'deleteImage':
          this._pendingImages = this._pendingImages.filter(f => f !== msg.filename);
          break;

        case 'openImage':
          if (typeof msg.filename === 'string') {
            await openNoteImage(this.noteManager, msg.filename);
          }
          break;
      }
    });
  }

  showEditor(input: EditorInput): void {
    if (!this._view) {
      this._pendingEditorInput = input;
      vscode.commands.executeCommand(`${SidebarProvider.viewId}.focus`);
      return;
    }
    this._view.show(true);
    this._doShowEditor(input);
  }

  /** New note from current selection; errors if no editor or empty selection. */
  tryOpenNewNoteFromSelection(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showErrorMessage(
        'Open a file in the editor, select the text you want to annotate, then click + next to Refresh in the Notes title bar or use the shortcut (⌘⇧N on Mac, Ctrl+Shift+N on Windows/Linux).'
      );
      return;
    }
    const sel = editor.selection;
    const selectedText = editor.document.getText(sel);
    if (!selectedText.trim()) {
      void vscode.window.showErrorMessage(
        'Select some text in the editor first, then click + next to Refresh in the Notes title bar or use the shortcut (⌘⇧N on Mac, Ctrl+Shift+N on Windows/Linux).'
      );
      return;
    }
    const line = sel.start.line;
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    this.showEditor({ filePath, line, selectedText });
  }

  refresh(): void {
    if (this._view) this._sendList();
  }

  private _doShowEditor(input: EditorInput): void {
    this._currentInput = input;
    this._pendingImages = input.existingNote ? [...input.existingNote.images] : [];

    const images: Array<{ filename: string; uri: string }> = [];
    if (this._view) {
      for (const filename of this._pendingImages) {
        const fsPath = this.noteManager.getImageFsPath(filename);
        if (fsPath) {
          const uri = this._view.webview.asWebviewUri(vscode.Uri.file(fsPath));
          images.push({ filename, uri: uri.toString() });
        }
      }
    }

    this._view?.webview.postMessage({
      type: 'showEditor',
      title: input.existingNote?.title ?? '',
      content: input.existingNote ? this.noteManager.getNoteContent(input.existingNote) : '',
      selectedText: input.selectedText,
      filePath: input.filePath,
      line: input.line + 1,
      images,
    });
  }

  private _sendList(): void {
    const notes = this.noteManager.getAllNotes();
    this._view?.webview.postMessage({ type: 'showList', notes });
  }

  private async _navigateTo(filePath: string, line: number): Promise<void> {
    const ws = this.noteManager.getWorkspaceRoot();
    if (!ws) return;
    await revealNoteAnchorInWorkspace(ws, filePath, line, this.decorationProvider);
  }

  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'sidebar.css'))
    );
    const rtlUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'rtl-utils.js'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'sidebar.js'))
    );
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
</head>
<body>

  <div id="view-list" class="view">
    <div id="notes-list"></div>
    <div id="empty-state" class="empty-state" style="display:none">
      <p>No notes yet.</p>
      <p>Select code, then click <strong>+</strong> next to Refresh above or press <kbd>⌘⇧N</kbd>.</p>
    </div>
  </div>

  <div id="view-editor" class="view" style="display:none">

    <div class="editor-header">
      <button id="btn-back" class="btn-back" title="Back to notes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Notes
      </button>
    </div>

    <div class="code-ref">
      <div class="code-ref-bar">
        <span class="code-ref-label">Code reference</span>
        <span class="code-ref-location" id="file-location"></span>
      </div>
      <pre class="code-snippet" id="code-snippet"></pre>
    </div>

    <div class="field">
      <label for="note-title">Title</label>
      <input id="note-title" type="text" placeholder="Give this note a title…" autocomplete="off" />
    </div>

    <div class="field">
      <label for="note-content">Note</label>
      <textarea id="note-content" placeholder="Write your note here…" rows="6"></textarea>
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
          Upload
        </button>
        <input id="file-input" type="file" accept="image/*" style="display:none" />
        <span class="paste-hint">or paste ⌘V</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-cancel" id="btn-cancel">Cancel</button>
      <button class="btn-save" id="btn-save">Save</button>
    </div>

  </div>

  <script nonce="${nonce}" src="${rtlUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
