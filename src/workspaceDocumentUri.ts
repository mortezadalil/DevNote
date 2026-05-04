import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Build a document URI that lives under a known workspace folder.
 * Some editors (e.g. Cursor) reject opening bare file:// paths for larger virtual workspaces
 * with "Files above 50MB cannot be synchronized with extensions" even for small files.
 * Using Uri.joinPath(folder.uri, …) aligns with how the Explorer opens files.
 */
export function workspaceDocumentUri(absolutePath: string): vscode.Uri {
  const normalized = path.normalize(absolutePath);
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return vscode.Uri.file(normalized);
  }

  for (const folder of folders) {
    const root = path.normalize(folder.uri.fsPath);
    if (normalized === root || normalized.startsWith(root + path.sep)) {
      let rel = path.relative(root, normalized);
      if (rel.startsWith('..')) {
        continue;
      }
      const segments = rel.split(path.sep).filter(s => s.length > 0);
      if (segments.length === 0) {
        return folder.uri;
      }
      return vscode.Uri.joinPath(folder.uri, ...segments);
    }
  }

  return vscode.Uri.file(normalized);
}
