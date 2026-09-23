// No `ion-*` of this module takes its colour from `color=` (ERPlora/pm#392, module-toolkit#273).
//
// Ionic implements `color="danger"` with a GLOBAL rule of the document stylesheet
// (`.ion-color-danger { --ion-color-base: … }`), which does not reach inside a shadow root. On the
// Printers screen that meant: the «Discard» confirmation of a stuck print job came out with no red
// fill — a transparent button with white text, the one irreversible gesture of the queue invisible.
//
// The button lives in this component's own shadow root (no `ion-modal`, no `ok-data-table` cell),
// so the recipe is a `tone-*` class painted from `static styles`: custom properties DO inherit
// through the boundary, so the theme token still applies. The render side is pinned in
// `erp-printing-settings.queue.test.ts`.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The `ui/` of THIS checkout, from the test's own URL: a fixed folder name (`modules/printing`, a
// worktree) would scan a sibling checkout and let a `color=` added HERE through.
const UI = path.dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The attribute names of every `<ion-*>` opening tag. A Lit tag does not end at the first `>`
 * (`@click=${() => …}`), so `${…}` expressions and quoted values are skipped, not read.
 */
function ionTags(source: string): { line: number; attrs: string }[] {
  const found: { line: number; attrs: string }[] = [];
  const start = /<ion-[a-z-]+(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = start.exec(source))) {
    let attrs = '';
    let depth = 0;
    let quote: string | null = null;
    for (let i = m.index + m[0].length; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (depth > 0) {
        if (ch === '"' || ch === "'" || ch === '`') quote = ch;
        else if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        continue;
      }
      if (ch === '$' && source[i + 1] === '{') { depth = 1; i += 1; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '>') break;
      attrs += ch;
    }
    found.push({ line: source.slice(0, m.index).split('\n').length, attrs: `${m[0]}${attrs}` });
  }
  return found;
}

const DECLARES_COLOR = /(?:^|\s)\.?color=/;

describe('pm#392: no ion-* delegates its colour to color=', () => {
  it('the source of ui/ carries no color= on an ion-* element', () => {
    const offenders = sources(UI).flatMap((file) =>
      ionTags(readFileSync(file, 'utf8'))
        .filter((t) => DECLARES_COLOR.test(t.attrs))
        .map((t) => `${path.relative(UI, file)}:${t.line}`),
    );
    expect(offenders, 'color= paints nothing inside a module shadow root').toEqual([]);
  });

  it('the reader sees a color= bound to an expression or behind an arrow function (control of the control)', () => {
    expect(ionTags('<ion-badge color=${tone(p)}>x</ion-badge>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(1);
    expect(ionTags('<ion-button size="small" ?disabled=${a || b}\n  @click=${() => this.go()} color="success">x</ion-button>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(1);
    expect(ionTags('<ion-button @click=${() => ({ color: 1 })}>x</ion-button>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(0);
  });
});
