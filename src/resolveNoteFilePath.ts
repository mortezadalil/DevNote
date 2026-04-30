import * as path from 'path';
import * as fs from 'fs';

/**
 * True when two workspace-relative paths denote the same file, including the case where
 * one was saved with a leading folder segment matching the workspace root name
 * (e.g. "repo/src/a.ts" vs "src/a.ts" when the opened folder is .../repo).
 */
export function workspaceRelativePathsMatch(
  workspaceRoot: string,
  pathA: string,
  pathB: string
): boolean {
  const norm = (s: string) => path.normalize(s.replace(/\//g, path.sep));
  const a = norm(pathA);
  const b = norm(pathB);
  if (a === b) return true;
  const base = path.basename(path.normalize(workspaceRoot));
  if (a.length === 0 || b.length === 0) return false;
  if (b === path.join(base, a)) return true;
  if (a === path.join(base, b)) return true;
  return false;
}

/**
 * Map a stored note path to an absolute file on disk.
 *
 * Notes may contain a leading folder segment that matches the workspace folder name
 * (e.g. path saved as "sekeh-dotnet/src/..." while the workspace root is already
 * ".../sekeh-dotnet"). Joining blindly doubles the segment and breaks older notes.
 */
export function resolveNoteFileAbsolutePath(
  workspaceRoot: string,
  fileRelativePath: string
): string | undefined {
  const normalizedRel = path.normalize(fileRelativePath.replace(/\//g, path.sep));
  const base = path.basename(path.normalize(workspaceRoot));
  let rel = normalizedRel;
  const tried = new Set<string>();

  for (;;) {
    const abs = path.join(workspaceRoot, rel);
    if (tried.has(abs)) return undefined;
    tried.add(abs);
    try {
      if (fs.statSync(abs).isFile()) return abs;
    } catch {
      /* try alternate relative path */
    }
    const segments = rel.split(path.sep).filter(s => s.length > 0);
    if (segments.length === 0 || segments[0] !== base) return undefined;
    rel = segments.slice(1).join(path.sep);
  }
}
