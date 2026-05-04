import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { workspaceRelativePathsMatch } from './resolveNoteFilePath';

/** Workspace folder for notes (lowercase d). Legacy `.DevNote` is migrated on load. */
export const DEVNOTE_FOLDER = '.devNote';
const LEGACY_DEVNOTE_FOLDER = '.DevNote';

function migrateLegacyDevNoteFolder(root: string): void {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const hasLegacy = dirs.includes(LEGACY_DEVNOTE_FOLDER);
    const hasNew = dirs.includes(DEVNOTE_FOLDER);
    if (!hasLegacy) return;

    const oldPath = path.join(root, LEGACY_DEVNOTE_FOLDER);
    const newPath = path.join(root, DEVNOTE_FOLDER);

    if (hasNew) {
      try {
        const sa = fs.statSync(oldPath);
        const sb = fs.statSync(newPath);
        if (sa.ino === sb.ino && sa.dev === sb.dev) return;
      } catch {
        return;
      }
      return;
    }

    const tmp = path.join(root, `.devnote_migrate_${process.pid}_${Date.now()}`);
    fs.renameSync(oldPath, tmp);
    fs.renameSync(tmp, newPath);
  } catch {
    /* ignore: permissions, locked folder, case-only rename edge cases */
  }
}

/** Sentinel: no code line anchor (unknown reference). */
export const UNKNOWN_NOTE_LINE = -1;

export interface Note {
  id: string;
  fileRelativePath: string;
  line: number; // 0-based; UNKNOWN_NOTE_LINE when anchorUnknownReference
  selectedText: string;
  title: string;
  noteFile: string; // filename inside .devNote/notes/
  images: string[]; // filenames inside .devNote/images/
  createdAt: string;
  updatedAt: string;
  /** True when the original code range was removed; no line anchor (UNKNOWN_NOTE_LINE); UI shows "Unknown reference". */
  anchorUnknownReference?: boolean;
}

interface DevNoteConfig {
  version: string;
  notes: Note[];
}

/** Whether the saved selection text still appears on consecutive lines starting at `line`. */
export function snippetMatchesDocument(
  doc: vscode.TextDocument,
  line: number,
  selectedText: string
): boolean {
  if (line < 0) return false;
  if (!selectedText.trim()) return true;
  const parts = selectedText.split('\n');
  for (let j = 0; j < parts.length; j++) {
    const li = line + j;
    if (li < 0 || li >= doc.lineCount) return false;
    const want = parts[j].trim();
    if (!want) continue;
    if (!doc.lineAt(li).text.includes(want)) return false;
  }
  return true;
}

export class NoteManager {
  private config: DevNoteConfig = { version: '1.0', notes: [] };
  private _onDidChangeNotes = new vscode.EventEmitter<void>();
  readonly onDidChangeNotes = this._onDidChangeNotes.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadConfig();
  }

  getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  getDevNoteDir(): string | null {
    const root = this.getWorkspaceRoot();
    return root ? path.join(root, DEVNOTE_FOLDER) : null;
  }

  private ensureDirs(): string {
    const dir = this.getDevNoteDir();
    if (!dir) throw new Error('No workspace folder open');
    for (const sub of [dir, path.join(dir, 'notes'), path.join(dir, 'images')]) {
      if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });
    }
    return dir;
  }

  private configPath(): string | null {
    const dir = this.getDevNoteDir();
    return dir ? path.join(dir, 'config.json') : null;
  }

  loadConfig(): void {
    const root = this.getWorkspaceRoot();
    if (root) migrateLegacyDevNoteFolder(root);
    const p = this.configPath();
    if (!p || !fs.existsSync(p)) {
      this.config = { version: '1.0', notes: [] };
      return;
    }
    try {
      this.config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const n of this.config.notes) {
        if (n.anchorUnknownReference) n.line = UNKNOWN_NOTE_LINE;
      }
    } catch {
      this.config = { version: '1.0', notes: [] };
    }
  }

  private saveConfig(): void {
    const p = this.configPath();
    if (!p) return;
    fs.writeFileSync(p, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  getAllNotes(): Note[] {
    this.loadConfig();
    return [...this.config.notes];
  }

  getNotesForFile(filePath: string): Note[] {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return this.config.notes.filter(n => n.fileRelativePath === filePath);
    }
    return this.config.notes.filter(n =>
      workspaceRelativePathsMatch(root, n.fileRelativePath, filePath)
    );
  }

  /** All notes anchored to this exact line (there may be more than one after “Write Note”). */
  getNotesAtLine(filePath: string, line: number): Note[] {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return this.config.notes.filter(
        n => n.fileRelativePath === filePath && n.line === line
      );
    }
    return this.config.notes.filter(
      n => workspaceRelativePathsMatch(root, n.fileRelativePath, filePath) && n.line === line
    );
  }

  getNoteForLine(filePath: string, line: number): Note | undefined {
    return this.getNotesAtLine(filePath, line)[0];
  }

  getNoteById(id: string): Note | undefined {
    return this.config.notes.find(n => n.id === id);
  }

  getNoteContent(note: Note): string {
    const dir = this.getDevNoteDir();
    if (!dir) return '';
    const p = path.join(dir, 'notes', note.noteFile);
    if (!fs.existsSync(p)) return '';
    const raw = fs.readFileSync(p, 'utf-8');
    // Strip the leading "# Title\n\n" we add on save
    const lines = raw.split('\n');
    if (lines[0].startsWith('#')) {
      return lines.slice(2).join('\n').trim();
    }
    return raw;
  }

  createNote(
    filePath: string,
    line: number,
    selectedText: string,
    title: string,
    content: string,
    images: string[]
  ): Note {
    const dir = this.ensureDirs();
    const id = crypto.randomUUID();
    const noteFile = `${id}.md`;

    const note: Note = {
      id,
      fileRelativePath: filePath,
      line,
      selectedText,
      title,
      noteFile,
      images,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anchorUnknownReference: false,
    };

    const mdContent = `# ${title}\n\n${content}`;
    fs.writeFileSync(path.join(dir, 'notes', noteFile), mdContent, 'utf-8');

    this.config.notes.push(note);
    this.saveConfig();
    this._onDidChangeNotes.fire();
    return note;
  }

  updateNote(
    id: string,
    title: string,
    content: string,
    images: string[]
  ): Note | undefined {
    const dir = this.getDevNoteDir();
    if (!dir) return undefined;

    const note = this.config.notes.find(n => n.id === id);
    if (!note) return undefined;

    note.title = title;
    note.images = images;
    note.updatedAt = new Date().toISOString();

    const mdContent = `# ${title}\n\n${content}`;
    fs.writeFileSync(path.join(dir, 'notes', note.noteFile), mdContent, 'utf-8');

    this.saveConfig();
    this._onDidChangeNotes.fire();
    return note;
  }

  deleteNote(id: string): void {
    const dir = this.getDevNoteDir();
    if (!dir) return;

    const idx = this.config.notes.findIndex(n => n.id === id);
    if (idx === -1) return;

    const note = this.config.notes[idx];
    const notePath = path.join(dir, 'notes', note.noteFile);
    if (fs.existsSync(notePath)) fs.unlinkSync(notePath);

    for (const img of note.images) {
      const imgPath = path.join(dir, 'images', img);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    this.config.notes.splice(idx, 1);
    this.saveConfig();
    this._onDidChangeNotes.fire();
  }

  saveImage(noteId: string, base64Data: string, mimeType: string): string {
    const dir = this.ensureDirs();
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const filename = `${noteId}_${Date.now()}.${ext}`;
    const imgPath = path.join(dir, 'images', filename);
    const data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(imgPath, Buffer.from(data, 'base64'));
    return filename;
  }

  getImageFsPath(filename: string): string | null {
    const dir = this.getDevNoteDir();
    if (!dir) return null;
    const p = path.join(dir, 'images', filename);
    return fs.existsSync(p) ? p : null;
  }

  // Called by onDidChangeTextDocument — updates anchors; unknown → UNKNOWN_NOTE_LINE, no gutter line
  handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const doc = event.document;
    const filePath = vscode.workspace.asRelativePath(doc.uri);
    const root = this.getWorkspaceRoot();
    if (!root) return;
    const notes = this.config.notes.filter(n =>
      workspaceRelativePathsMatch(root, n.fileRelativePath, filePath)
    );
    if (notes.length === 0) return;

    let changed = false;

    for (const change of event.contentChanges) {
      const s = change.range.start.line;
      const e = change.range.end.line;
      const insertedNL = (change.text.match(/\n/g) ?? []).length;
      const removedSpanLines = e - s;
      const delta = insertedNL - removedSpanLines;

      for (const note of notes) {
        if (note.anchorUnknownReference) {
          note.line = UNKNOWN_NOTE_LINE;
          continue;
        }

        const L = note.line;

        if (removedSpanLines > 0 && L >= s && L < e) {
          note.line = UNKNOWN_NOTE_LINE;
          note.anchorUnknownReference = true;
          changed = true;
          continue;
        }

        if (L >= e) {
          const newL = L + delta;
          if (newL !== L) {
            note.line = Math.max(0, newL);
            changed = true;
          }
        }
      }
    }

    for (const note of notes) {
      if (note.anchorUnknownReference) {
        note.line = UNKNOWN_NOTE_LINE;
        continue;
      }
      if (!snippetMatchesDocument(doc, note.line, note.selectedText)) {
        note.line = UNKNOWN_NOTE_LINE;
        note.anchorUnknownReference = true;
        changed = true;
      }
    }

    if (changed) {
      this.saveConfig();
      this._onDidChangeNotes.fire();
    }
  }
}
