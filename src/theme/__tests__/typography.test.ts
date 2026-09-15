import fs from 'fs';
import path from 'path';

/**
 * Typography consistency, enforced by reading the source.
 *
 * Reported: some text renders in a different typeface from everything around
 * it. Two causes, both invisible to tsc and to any render test:
 *
 * 1. A style sets fontSize but no fontFamily, so the text falls back to the
 *    OS default (Roboto / SF) instead of the app's JetBrains Mono.
 * 2. A style sets fontStyle: 'italic'. App.tsx loads only upright weights, so
 *    Android has no italic face to use and substitutes or synthesises one.
 *
 * Checked here rather than by eye because the app has well over 400 text
 * styles and the drift only shows up on a device.
 */

const SRC = path.join(__dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__render__') return [];
      return tsxFiles(full);
    }
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Style blocks at the usual two-space StyleSheet.create indentation. */
function styleBlocks(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /\n {2}(\w+): \{([^{}]*?)\n {2}\},/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.push({ name: m[1], body: m[2] });
  }
  return out;
}

const files = tsxFiles(SRC);

describe('typography', () => {
  it('finds source files to check', () => {
    // Guards against the walker silently returning nothing and the suite
    // passing vacuously.
    expect(files.length).toBeGreaterThan(30);
  });

  it('never sizes text without also naming the family', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { name, body } of styleBlocks(source)) {
        if (body.includes('fontSize') && !body.includes('fontFamily')) {
          offenders.push(`${path.relative(SRC, file)} → ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never asks for italic, because no italic face is bundled', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes("fontStyle: 'italic'")) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('routes every family through the theme rather than hardcoding a name', () => {
    // ErrorBoundary is the one allowed exception: it renders when the theme
    // provider itself may have failed, so it cannot read from the theme.
    const allowed = new Set(['components/common/ErrorBoundary.tsx']);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (allowed.has(rel)) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/fontFamily: '/.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
