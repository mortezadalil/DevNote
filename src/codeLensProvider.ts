import * as vscode from 'vscode';
import { NoteManager } from './noteManager';

export class NoteCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private readonly noteManager: NoteManager) {
    noteManager.onDidChangeNotes(() => this._onDidChangeCodeLenses.fire());
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const notes = this.noteManager.getNotesForFile(filePath);
    const maxLine = document.lineCount - 1;

    return notes
      .filter(note => note.anchorUnknownReference !== true)
      .map(note => {
        const line = Math.min(Math.max(0, note.line), maxLine);
        const range = new vscode.Range(line, 0, line, 0);
        return new vscode.CodeLens(range, {
          title: `📝 ${note.title || 'Note'}`,
          command: 'devnote.openNoteForLine',
          arguments: [note.id],
        });
      });
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}
