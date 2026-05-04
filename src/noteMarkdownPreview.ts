import * as vscode from 'vscode';
import * as path from 'path';
import { marked } from 'marked';
import { NoteManager } from './noteManager';

marked.use({ gfm: true, breaks: true });

/**
 * Opens a separate editor column webview that renders note Markdown (and inline HTML) for the current workspace.
 */
export function openNoteMarkdownPreview(
  context: vscode.ExtensionContext,
  noteManager: NoteManager,
  title: string,
  markdown: string,
  wrapPersianDoc: boolean = false
): void {
  const devDir = noteManager.getDevNoteDir();
  const panelTitle = title ? `Preview — ${title}` : 'Note preview';

  const panel = vscode.window.createWebviewPanel(
    'devnoteMarkdownPreview',
    panelTitle,
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
        ...(devDir ? [vscode.Uri.file(devDir)] : []),
      ],
    }
  );

  const bodyHtmlRaw = marked.parse(markdown, { async: false }) as string;
  const withImages = rewriteImageSrcs(bodyHtmlRaw, panel.webview, noteManager);
  const inner = wrapPersianDoc ? `<div class="persian-doc">\n${withImages}\n</div>` : withImages;

  const cssUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'note-markdown-preview.css'))
  );

  const w = panel.webview;
  const csp = [
    `default-src 'none'`,
    `style-src ${w.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net`,
    `font-src https://cdn.jsdelivr.net`,
    `img-src ${w.cspSource} data: https:`,
  ].join('; ');

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>
<div class="markdown-body">
${inner}
</div>
</body>
</html>`;
}

function rewriteImageSrcs(html: string, webview: vscode.Webview, noteManager: NoteManager): string {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]*)"([^>]*)>/gi, (_full, before, src, after) => {
    const trimmed = (src as string).trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return `<img${before}src="${src}"${after}>`;
    }
    const filename = trimmed.includes('/') ? path.posix.basename(trimmed) : trimmed;
    const fsPath = noteManager.getImageFsPath(filename);
    if (!fsPath) {
      return `<img${before}src="${src}"${after}>`;
    }
    const uri = webview.asWebviewUri(vscode.Uri.file(fsPath));
    return `<img${before}src="${uri}"${after}>`;
  });
}
