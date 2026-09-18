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

/** Repo-relative path with forward slashes, so expectations are OS-neutral. */
const rel = (file: string): string => path.relative(SRC, file).split(path.sep).join('/');

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
          offenders.push(`${rel(file)} → ${name}`);
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
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never uses a fractional font size', () => {
    // 9.5 and 8.5 are not design decisions, they are drift. The ramp in
    // src/theme has eight steps; a size between two of them means someone
    // nudged a number until it looked right on one screen.
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const hits = source.match(/fontSize: \d+\.\d+/g);
      if (hits) offenders.push(`${rel(file)} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('routes every family through the theme rather than hardcoding a name', () => {
    // ErrorBoundary is the one allowed exception: it renders when the theme
    // provider itself may have failed, so it cannot read from the theme.
    const allowed = new Set(['components/common/ErrorBoundary.tsx']);
    const offenders: string[] = [];
    for (const file of files) {
      const relPath = rel(file);
      if (allowed.has(relPath)) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/fontFamily: '/.test(source)) offenders.push(relPath);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Screen headers.
 *
 * Five screens rendered their own title block and had drifted into four
 * versions of the same element: 26/18/16pt titles, -0.6/1/1.2 tracking, and
 * subtitles in three colours. components/ui/ScreenHeader is now the one
 * implementation; this fails if a screen grows its own again.
 */
describe('screen headers', () => {
  const screens = files.filter(f => f.includes(`${path.sep}screens${path.sep}`));

  it('finds the screen files', () => {
    expect(screens.length).toBeGreaterThan(5);
  });

  it('no screen defines its own screenTitle style', () => {
    const offenders: string[] = [];
    for (const file of screens) {
      const source = fs.readFileSync(file, 'utf8');
      if (/\n {2}screenTitle: \{/.test(source)) {
        offenders.push(rel(file));
      }
    }
    // Known remaining: these still predate ScreenHeader and are listed so the
    // number can only go down, never quietly up.
    expect(offenders.sort()).toEqual(
      ['screens/AnalyticsScreen.tsx', 'screens/PlaybookScreen.tsx', 'screens/TradesScreen.tsx'].sort()
    );
  });
});

/**
 * Dashboard section count.
 *
 * It was cut from eleven sections to six once, then grew back to ten one
 * feature at a time -- each addition reasonable on its own, the total not.
 * Nothing in the codebase noticed, because a screen getting longer breaks no
 * test.
 *
 * This is a budget, not a rule about layout: it fails when the screen grows,
 * so the growth has to be a decision rather than a side effect.
 */
describe('dashboard length budget', () => {
  const DASHBOARD = path.join(SRC, 'screens', 'DashboardScreen.tsx');

  it('keeps the top-level section count within budget', () => {
    const source = fs.readFileSync(DASHBOARD, 'utf8');
    const sections = source.split('\n').filter(l => /^ {6}\{\/\* ── /.test(l));
    expect(sections.length).toBeLessThanOrEqual(9);
  });

  it('numbers its sections consecutively from 1', () => {
    // The numbering had drifted to 1, 3, 3, 4, 5, 5bis, 5ter, 6, 10 -- which
    // is how two different sections both came to be called "3".
    const source = fs.readFileSync(DASHBOARD, 'utf8');
    const numbers = source
      .split('\n')
      .filter(l => /^ {6}\{\/\* ── \d+\./.test(l))
      .map(l => Number(l.match(/── (\d+)\./)![1]));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});
