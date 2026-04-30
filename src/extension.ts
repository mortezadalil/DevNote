import * as vscode from 'vscode';
import * as path from 'path';
import { NoteManager } from './noteManager';
import { DecorationProvider } from './decorationProvider';
import { NoteCodeLensProvider } from './codeLensProvider';
import { SidebarProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext): void {
  const noteManager        = new NoteManager(context);
  const decorationProvider = new DecorationProvider(noteManager, context);
  const codeLensProvider   = new NoteCodeLensProvider(noteManager);

  const onSaved = () => decorationProvider.refreshAll();

  const sidebarProvider = new SidebarProvider(context, noteManager, decorationProvider, onSaved);

  // ── Sidebar ───────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── CodeLens ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
  );

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('devnote.writeNote', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const sel          = editor.selection;
      const selectedText = editor.document.getText(sel);
      const line         = sel.start.line;
      const filePath     = vscode.workspace.asRelativePath(editor.document.uri);
      // Always create a new note; editing an existing one is only via Open / sidebar Edit.
      sidebarProvider.showEditor({ filePath, line, selectedText });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devnote.newNoteFromSelection', () => {
      sidebarProvider.tryOpenNewNoteFromSelection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'devnote.openNoteForLine',
      async (arg0?: string, arg1?: string | number) => {
        if (arg0 !== undefined && arg1 === undefined) {
          const byId = noteManager.getNoteById(arg0);
          if (byId) {
            sidebarProvider.showEditor({
              filePath: byId.fileRelativePath,
              line: byId.line,
              selectedText: byId.selectedText,
              existingNote: byId,
            });
            return;
          }
        }
        let filePath: string;
        let line: number;
        if (arg0 !== undefined && typeof arg1 === 'number') {
          filePath = arg0;
          line = arg1;
        } else {
          const editor = vscode.window.activeTextEditor;
          if (!editor) return;
          filePath = vscode.workspace.asRelativePath(editor.document.uri);
          line = editor.selection.active.line;
        }
        const atLine = noteManager.getNotesAtLine(filePath, line);
        if (atLine.length === 0) {
          vscode.window.showInformationMessage('No note found for this line.');
          return;
        }
        let note = atLine[0];
        if (atLine.length > 1) {
          const picked = await vscode.window.showQuickPick(
            atLine.map(n => ({
              label: n.title || 'Untitled note',
              description: `${n.fileRelativePath}:${n.line + 1}`,
              note: n,
            })),
            { placeHolder: 'Select a note on this line' }
          );
          if (!picked) return;
          note = picked.note;
        }
        sidebarProvider.showEditor({
          filePath: note.fileRelativePath,
          line: note.line,
          selectedText: note.selectedText,
          existingNote: note,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'devnote.navigateToNote',
      async (filePath: string, line: number) => {
        const ws = noteManager.getWorkspaceRoot();
        if (!ws) return;
        const uri    = vscode.Uri.file(path.join(ws, filePath));
        const doc    = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const pos    = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'devnote.deleteNote',
      async (item?: { note?: { id: string } }) => {
        const id = item?.note?.id;
        if (!id) return;
        const answer = await vscode.window.showWarningMessage(
          'Delete this note permanently?', { modal: true }, 'Delete'
        );
        if (answer === 'Delete') {
          noteManager.deleteNote(id);
          decorationProvider.refreshAll();
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devnote.refresh', () => {
      noteManager.loadConfig();
      decorationProvider.refreshAll();
      sidebarProvider.refresh();
    })
  );

  // ── Decorations ───────────────────────────────────────────────────────────
  if (vscode.window.activeTextEditor) {
    decorationProvider.updateDecorations(vscode.window.activeTextEditor);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) decorationProvider.updateDecorations(editor);
    })
  );

  // ── Line tracking ─────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      noteManager.handleDocumentChange(event);
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        decorationProvider.updateDecorations(editor);
        updateLineHasNoteContext(editor, noteManager);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(e => updateLineHasNoteContext(e.textEditor, noteManager))
  );

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(editors => {
      for (const editor of editors) decorationProvider.updateDecorations(editor);
    })
  );
}

function updateLineHasNoteContext(editor: vscode.TextEditor, noteManager: NoteManager): void {
  const filePath = vscode.workspace.asRelativePath(editor.document.uri);
  const line     = editor.selection.active.line;
  const hasNote  = noteManager.getNotesAtLine(filePath, line).length > 0;
  vscode.commands.executeCommand('setContext', 'devnote.lineHasNote', hasNote);
}

export function deactivate(): void {}
