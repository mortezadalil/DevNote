import * as vscode from 'vscode';
import type { DecorationProvider } from './decorationProvider';
import { resolveNoteFileAbsolutePath } from './resolveNoteFilePath';
import { UNKNOWN_NOTE_LINE } from './noteManager';

/**
 * Opens the workspace file (if needed), flashes anchor line or entire file when unknown,
 * refreshes gutter. Unknown notes (@see UNKNOWN_NOTE_LINE) only open the file and flash whole document.
 */
export async function revealNoteAnchorInWorkspace(
  workspaceRoot: string,
  fileRelativePath: string,
  line: number,
  decorationProvider: DecorationProvider
): Promise<void> {
  try {
    const absolute = resolveNoteFileAbsolutePath(workspaceRoot, fileRelativePath);
    if (!absolute) {
      await vscode.window.showErrorMessage(
        `DevNote: file not found for "${fileRelativePath}". ` +
          'Try opening the same workspace folder as when the note was created.'
      );
      return;
    }
    const uri = vscode.Uri.file(absolute);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

    if (line === UNKNOWN_NOTE_LINE) {
      decorationProvider.flashWholeDocument(editor);
      decorationProvider.updateDecorations(editor);
      return;
    }

    const maxLine = doc.lineCount - 1;
    const L = Math.min(Math.max(0, line), maxLine);
    const lineRange = doc.lineAt(L).range;
    const pos = lineRange.start;
    editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
    decorationProvider.flashNoteLine(editor, L);
    decorationProvider.updateDecorations(editor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(
      `DevNote: could not open "${fileRelativePath}": ${msg}`
    );
  }
}
