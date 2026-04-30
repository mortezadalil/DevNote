import * as vscode from 'vscode';
import * as path from 'path';
import { NoteManager } from './noteManager';

export class DecorationProvider {
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(
    private readonly noteManager: NoteManager,
    private readonly context: vscode.ExtensionContext
  ) {
    const iconPath = vscode.Uri.file(
      path.join(context.extensionPath, 'media', 'note-gutter.svg')
    );
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: iconPath,
      // Slightly larger so the pencil reads next to the line number
      gutterIconSize: '95%',
      // Show a subtle left border tint on noted lines
      overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  updateDecorations(editor: vscode.TextEditor): void {
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const notes = this.noteManager.getNotesForFile(filePath);
    const maxLine = editor.document.lineCount - 1;

    const decorations: vscode.DecorationOptions[] = notes.map(note => {
      const line = Math.min(note.line, maxLine);
      const range = new vscode.Range(line, 0, line, 0);

      // Hover over gutter shows a clickable markdown link
      const md = new vscode.MarkdownString(
        `**📝 ${note.title || 'Note'}**\n\n` +
        (note.selectedText
          ? `\`\`\`\n${note.selectedText.slice(0, 120)}\n\`\`\`\n\n`
          : '') +
        `[Open note](command:devnote.openNoteForLine?${encodeURIComponent(
          JSON.stringify([note.id])
        )})`
      );
      md.isTrusted = true;

      return { range, hoverMessage: md };
    });

    editor.setDecorations(this.decorationType, decorations);
  }

  refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
