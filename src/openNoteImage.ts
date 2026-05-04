import * as vscode from 'vscode';
import { NoteManager } from './noteManager';

/** Opens a note attachment from `.devNote/images/` in an editor tab (image preview). */
export async function openNoteImage(noteManager: NoteManager, filename: string): Promise<void> {
  const fsPath = noteManager.getImageFsPath(filename);
  if (!fsPath) {
    void vscode.window.showWarningMessage('Image not found.');
    return;
  }
  const uri = vscode.Uri.file(fsPath);
  try {
    await vscode.window.showTextDocument(uri, { preview: false });
  } catch {
    try {
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch {
      await vscode.env.openExternal(uri);
    }
  }
}
