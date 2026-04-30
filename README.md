<p align="center">
  <img src="https://raw.githubusercontent.com/mortezadalil/DevNote/main/devNote.jpg" alt="DevNote — Notes in your code" width="640" />
</p>

<h1 align="center">DevNote</h1>

<p align="center"><strong>Notes in your code.</strong></p>

<p align="center">
  <a href="https://github.com/mortezadalil/DevNote">GitHub</a>
  ·
  <a href="https://github.com/mortezadalil/DevNote/issues">Issues</a>
  ·
  <a href="#how-to-use">How to use</a>
  ·
  <a href="#installation">Install</a>
  ·
  <a href="#quick-start">Quick start</a>
</p>

---

## How to use

1. **Select** a portion of code in the editor, then **create a note** for that selection. DevNote remembers the file, line, and snippet so the note stays anchored to that code.
2. Whenever you need context again, **open the Notes list** in the sidebar, **find** the note, and **navigate** back to the exact code to read or edit what you wrote.
3. Notes support **Markdown-style text** and **images**—paste or add pictures so diagrams and screenshots sit beside the code they refer to.

**DevNote** is a [Visual Studio Code](https://code.visualstudio.com/) extension that attaches these rich notes to **specific lines** in your project. Notes are stored in your workspace so they stay with the codebase—ideal for design decisions, TODOs, reviews, and documentation that belongs next to the code.

## Table of contents

- [How to use](#how-to-use)
- [Features](#features)
- [Installation](#installation)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Using DevNote](#using-devnote)
- [Commands](#commands)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Where data is stored](#where-data-is-stored)
- [Right-to-left text (Persian / Arabic)](#right-to-left-text-persian--arabic)
- [Images](#images)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Publishing](#publishing)
- [License](#license)

## Features

| | |
|:--|:--|
| **Line-anchored notes** | Each note is tied to a file path and line number; line positions adjust when you insert or delete lines above them. |
| **Rich editor** | Title, multi-line note body, and an inline preview of the **selected code** you attached the note to. |
| **Sidebar “Notes”** | Browse every note grouped by file; navigate to code; edit or delete from the list (actions appear on hover). |
| **Editor gutter** | A **pencil** icon in the **glyph margin** (beside line numbers) marks lines that have a note. |
| **Code Lens** | The note title appears above noted lines for quick context. |
| **Multiple notes per line** | You can add more than one note on the same line; **Open Note** offers a picker when needed. |
| **Images** | Paste (**⌘V** / **Ctrl+V**) or upload images in the note editor; thumbnails open the file in an editor tab when clicked. |
| **RTL support** | Persian and Arabic (and other Arabic-script) text is shown **right-to-left** in the sidebar list and in the note editor where applicable. |

## Installation

### From a `.vsix` file

1. Download or build `devnote-*.vsix` (see [Development](#development)).
2. In VS Code: **Extensions** → **⋯** (Views and More Actions) → **Install from VSIX…** and choose the file.

### From the Marketplace

**DevNote Pro** is published as **`MortezaDalil.DevNotePro`**.

- **Open in browser:** [DevNote Pro on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MortezaDalil.DevNotePro)
- **In VS Code / Cursor:** Extensions (`Ctrl+Shift+X` / `⌘⇧X`) → search **DevNote Pro** or **MortezaDalil** → **Install**.

> The internal marketplace id is `DevNotePro` because the short name `devnote` was already taken globally on the Marketplace.

## Requirements

- **VS Code 1.85** or newer (or a compatible editor such as **Cursor** that loads VS Code extensions).
- A **folder workspace** opened (**File → Open Folder…**). Notes are created under the workspace root only.

## Quick start

1. Open a project folder in VS Code.
2. Open a source file and **select** a meaningful snippet of code (the selection is stored with the note).
3. Create a note using **any** of the following:
   - **Command Palette** (`Ctrl+Shift+P` / `⌘⇧P`) → **DevNote: Write Note**
   - **Right-click** in the editor → **Write Note** (when text is selected)
   - **Keyboard:** **Ctrl+Shift+N** (Windows/Linux) or **⌘⇧N** (Mac) — only when you have a selection
   - **Notes** view title bar: **+** (**New Note from Selection**). If nothing is selected, you’ll get a clear error telling you to select text first.
4. Fill in **Title** and **Note**, add images if you want, then **Save**.
5. Open the **DevNote** icon in the **Activity Bar** to see all notes; click a note to jump to its line.

## Using DevNote

### Activity Bar & sidebar

- Click the **DevNote** icon on the left to open the **Notes** view.
- Use **+** (next to **Refresh**) to start a **new** note from the **current selection** in the active editor.
- Use **Refresh** if you changed `.DevNote` on disk outside VS Code.

### From the editor

- **Gutter:** Hover the **pencil** icon for a short preview and a link to **Open note**.
- **Code Lens** (line above the code): click to open that note.
- **Context menu:** **Open Note** appears when the cursor is on a line that already has a note.

### Editing vs creating

- **Write Note** / **+** / shortcut always aims to **create a new** note for the current selection.
- To **edit** an existing note, use **Open Note**, the sidebar **edit** control, or the Code Lens / gutter link.

## Commands

All commands appear under the category **DevNote** in the Command Palette.

| Command | ID | Description |
|--------|-----|-------------|
| **Write Note** | `devnote.writeNote` | Open the note editor for the current selection (new note). |
| **New Note from Selection** | `devnote.newNoteFromSelection` | Same as above; shows an error if no text is selected or no editor is active. |
| **Open Note** | `devnote.openNoteForLine` | Open the note for the current line (or pick one if several exist). |
| **Delete Note** | `devnote.deleteNote` | Delete a note (e.g. from context where bound). |
| **Go to Line** | `devnote.navigateToNote` | Jump editor to a note’s file and line. |
| **Edit Note** | `devnote.editNote` | Available where exposed (e.g. palette). |
| **Refresh** | `devnote.refresh` | Reload DevNote config and refresh decorations. |

## Keyboard shortcuts

| Keys | Command | When |
|------|---------|------|
| **Ctrl+Shift+N** / **⌘⇧N** | Write Note | **Text is selected** in the editor |

You can change shortcuts in **File → Preferences → Keyboard Shortcuts** and search for `devnote`.

## Where data is stored

Everything lives under **`<your-workspace>/.DevNote/`**:

| Path | Content |
|------|---------|
| `.DevNote/config.json` | Index of notes (file, line, title, image list, etc.) |
| `.DevNote/notes/*.md` | Note bodies (Markdown files) |
| `.DevNote/images/*` | Attached images |

Add **`.DevNote/`** to `.gitignore` if notes are private, or **commit** it if your team should share them.

## Right-to-left text (Persian / Arabic)

Titles, note bodies, the code snippet panel, and sidebar titles use automatic direction when the text contains **Arabic-script** characters, so Persian and Arabic notes are readable **RTL** in the UI.

## Images

- In the note editor, use **Upload** or **paste** an image from the clipboard.
- Click a **thumbnail** to open the image file in an editor tab (full preview).

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **No pencil in the gutter** | Enable the glyph margin: **Settings** → search `editor.glyphMargin` → enable **Editor: Glyph Margin** (same area as breakpoints / lightbulb). |
| **`+` does nothing** | Ensure a **file tab** is active, not only the sidebar; select **non-empty** text first. |
| **Notes missing after clone** | `.DevNote` may not be in the repo; check [Where data is stored](#where-data-is-stored). |
| **Wrong line after big edits** | Line tracking follows simple insert/delete; complex refactors may need you to re-open or move notes manually. |

## Development

```bash
git clone https://github.com/mortezadalil/DevNote.git
cd DevNote
npm install
npm run compile
```

Press **F5** in VS Code with this folder opened to launch an **Extension Development Host** and debug the extension.

Build a redistributable package:

```bash
npm run pack
# creates devnote-<version>.vsix
```

## Publishing

1. Create a [Marketplace publisher](https://marketplace.visualstudio.com/manage). The `publisher` field in `package.json` must match your publisher ID.
2. Create an **Azure DevOps** Personal Access Token with **Marketplace (Manage)** scope; login: `npx @vscode/vsce login <publisher>`.
3. Publish: `npx @vscode/vsce publish`, or upload the `.vsix` on the manage page.
4. Optional: add a **128×128** PNG as `icon` in `package.json` for the store listing.

## License

[MIT](./LICENSE)

---

<p align="center">
  Made for developers who want <strong>notes in their code</strong>.
</p>
