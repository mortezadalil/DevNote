import * as vscode from 'vscode';
import * as path from 'path';
import type { DecorationProvider } from './decorationProvider';

/**
 * Opens the workspace file (if needed), reveals the note line, flashes it briefly, refreshes gutter.
 * Use when navigating from the sidebar webview so the editor group gets focus.
 */
export async function revealNoteAnchorInWorkspace(
  workspaceRoot: string,
  fileRelativePath: string,
  line: number,
  decorationProvider: DecorationProvider
): Promise<void> {
  try {
    const uri = vscode.Uri.file(path.join(workspaceRoot, fileRelativePath));
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

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
