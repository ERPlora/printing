// A control the QA robot cannot name is a control nobody tests (printing#38).
//
// The hub's QA drives this screen with Playwright, and Playwright addresses by `data-testid`: it is
// the only hook that survives a copy change, the `en`↔`es` translation (ADR-0055 translates
// EVERYTHING visible) and a Web Component's Shadow DOM. Without it a spec falls back to selecting
// by text or by `nth`, and that is how the restaurant walkthrough of 2026-09-09 left 8 points of
// this module unverified.
//
// This is the PATTERN's guard, the mirror of `hub/apps/web/src/form-testids.test.ts` over this
// repo's `ui/`. It covers five different things, which is why they are five rules and not one:
//
//   · COVERAGE  — on a registered surface no form control and no action is left without a hook, and
//     no `<ok-data-table>` is left without its `testid`. This is what makes the field somebody adds
//     next month be born addressable.
//   · CONTRACT  — the names the QA specs write are declared here, and the declared set is EXACTLY
//     the one the file paints. A `data-testid` is a contract with whoever reads it from outside:
//     renaming one silently turns the QA suite red days later, in ANOTHER repo whose CI never saw
//     this change — so renaming it has to break THIS test first, here, where it is visible.
//   · ATTRIBUTE — `getByTestId` resolves `data-testid` and nothing else. A `data-test` is a hook the
//     robot cannot reach, and the spec that reads it asserts about nothing, forever.
//   · SPELLING  — the module writes ONE form of the hook. The rules above read that form; any other
//     way of writing the SAME attribute is a hook that Lit paints, that QA addresses, and that this
//     file never sees.
//   · RATCHET   — every surface with controls is classified: covered, or pending with its REAL
//     issue. A new component with an `ion-input` cannot slip in without somebody deciding.
//
// The convention is the hub's (`architecture/hub/apps/testids.md`): `<surface>-<field|action|state>`,
// kebab-case, the surface prefix mandatory, and a list's rows carrying their identity at the end
// (`printing-job-<jobId>`), never their index.
//
// 🔴 ONE DELIBERATE DEVIATION FROM THE SHELL'S GUARD, and it is the whole point of the spelling
// rule here. The shell is Vue, so its two legal spellings are `data-testid="…"` and
// `:data-testid="…"`. This module is LIT: `:data-testid` is not binding syntax, Lit paints an
// attribute literally named `:data-testid`, which `getByTestId` does not resolve — exactly the kind
// of dead hook the shell's rule was written to deny. The legal spellings here are
// `data-testid="…"` (fixed) and `data-testid=${…}` (Lit binding).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The `ui/` root, which is this very directory. `import.meta.dirname` and NOT `import.meta.url`:
 * under `happy-dom` the module URL is not a `file:` one and `fileURLToPath` dies before collecting
 * a single test — and unlike walking up from `process.cwd()`, this answer does not change with the
 * directory the suite happens to be launched from.
 */
const UI = import.meta.dirname;

/**
 * A covered surface: `prefix` is the namespace that belongs to it, `contract` the EXACT set of
 * literal hooks the file writes today, and `computed` that same contract for the ones Lit builds
 * while painting (`data-testid=${…}`), declared by their FIXED HEAD — the part QA can predict, with
 * the row identity behind it.
 *
 * To get in here a component needs both halves: every control hooked (coverage rule) and its names
 * written down (contract rule). Adding a field forces a change to this list — on purpose: that is
 * the moment somebody decides what that field is going to be called for the rest of the world.
 *
 * The prefix always carries the module id (`printing-`) because these hooks do not live alone: the
 * shell mounts several modules on the same page, so a bare `queue-refresh` from this repo and
 * another from a neighbouring module would be two elements for one `getByTestId`.
 */
const COVERED: Record<string, { prefix: string; contract: string[]; computed?: string[] }> = {
  // The printing settings screen (`/m/printing`): the print queue with its per-role coverage and
  // the two gestures over a stuck job, the ticket settings form, and the network printers with the
  // role each one takes.
  //
  // `<ion-select-option>` carries NO hook on purpose. With `interface="popover"` Ionic does not
  // render the option element the screen wrote: it builds its own list inside the popover from the
  // option's props, and a custom attribute does not travel. A `data-testid` there would paint in
  // the light DOM, never in what the person clicks — a dead hook, which is what this guard exists
  // to keep out. A spec picks a value by driving the `ion-select` itself.
  'components/erp-printing-settings/erp-printing-settings.ts': {
    prefix: 'printing-',
    contract: [
      'printing-add-printer-added',
      'printing-add-printer-cancel',
      'printing-add-printer-error',
      'printing-add-printer-form',
      'printing-add-printer-ip',
      'printing-add-printer-open',
      'printing-add-printer-port',
      'printing-add-printer-submit',
      'printing-auto-print',
      'printing-hardware-empty',
      'printing-hardware-error',
      'printing-hardware-ready',
      'printing-hardware-rescan',
      'printing-hardware-unavailable',
      'printing-open-drawer',
      'printing-paper-width',
      'printing-queue-clear',
      'printing-queue-clear-no-host',
      'printing-queue-error',
      'printing-queue-notice',
      'printing-queue-notice-permissions',
      'printing-queue-refresh',
      'printing-receipt-settings-link',
      'printing-receipt-settings-note',
      'printing-receipt-text-error',
      'printing-receipt-text-move',
      'printing-receipt-text-moved',
      'printing-receipt-text-pending',
      'printing-settings-error',
      'printing-settings-save',
      'printing-settings-saved',
    ],
    computed: [
      'printing-job-',
      'printing-printer-',
      'printing-queue-alert-',
      'printing-queue-role-',
      'printing-retired-',
    ],
  },
};

/**
 * Surfaces with controls that do not carry hooks yet, each one with the issue that asks for them.
 *
 * The list can only SHRINK: when one is completed it leaves here and goes up (the «already
 * complete» rule fails if it stays). A new component is not born in this list — it is born covered.
 */
const NOT_YET_COVERED: Record<string, string> = {};

/**
 * How many surfaces are pending TODAY. This number ONLY GOES DOWN: one that moves to `COVERED`
 * subtracts one, and nothing ever adds. Without it the pending list would be a list of exceptions —
 * a new component would walk in with a decorative issue number and the guard would stay green.
 */
const PENDING_TODAY = 0;

/**
 * What a person fills in, plus what a person presses.
 *
 * The hub leaves buttons out («they are declared in the contract») because the shell has hundreds
 * of decorative ones. Here it cannot: measured with the «a new control without a hook» mutant over
 * an action `<ion-button>`, which survived with the whole guard green. An ACTION without a hook is
 * a spec that cannot press anything, exactly as a field without a hook is a spec that cannot type:
 * both break this. Same for the `<form>` itself, which is what a spec submits.
 */
const CONTROL_TAGS = [
  'ion-input',
  'ion-select',
  'ion-textarea',
  'ion-toggle',
  'ion-checkbox',
  'ion-searchbar',
  'ion-radio-group',
  'ion-datetime',
  'ion-range',
  'ion-segment',
  'ion-button',
  'form',
  'input',
  'select',
  'textarea',
  'button',
] as const;

const CONTROL_OPEN = new RegExp(`<(${CONTROL_TAGS.join('|')})(?=[\\s/>])`, 'g');

/** `<ok-data-table>`: without `testid` it paints NONE of its derived hooks (outfitkit#143). */
const DATA_TABLE_OPEN = /<ok-data-table(?=[\s/>])/g;

/**
 * A literal hook, written by hand. Two forms, and both count the same for the contract:
 *   · `data-testid="x"` — the hook of a control of this module.
 *   · `testid="x"`      — the namespace `<ok-data-table>` expands into its own chrome. It is the
 *                         same contract with QA: rename it and the spec that presses «Add» has
 *                         nothing left to press, even though the attribute is called something else.
 *
 * The lookbehind is what stops `data-testid` from also being counted as a loose `testid`, and it
 * excludes `:` on purpose: `:data-testid="x"` is NOT a binding in Lit — it paints an attribute
 * literally called `:data-testid`, which `getByTestId` does not resolve — so reading it as a
 * literal would declare in the contract a name that is not on the screen.
 */
const LITERAL_TESTID = /(?<![:\w-])(?:data-)?testid="([^"]*)"/g;

/**
 * How a hook is WRITTEN. The rules above read exactly three forms — `data-testid="…"`,
 * `data-testid=${…}` and `testid="…"` — so any other way of writing the SAME attribute is a hook
 * Lit paints and this file never sees. Lit accepts several (`data-testid="${…}"` quoted,
 * `.dataTestid=${…}` as a property, single quotes), and Vue's syntax (`:data-testid`,
 * `v-bind:data-testid`) walks in by itself the moment somebody copies a screen from the shell.
 * Teaching three spellings to four regular expressions would be four places to forget one: the
 * module writes ONE form and this rule says so.
 *
 * The SEPARATOR is captured for the same reason, and it is the subtler half: HTML allows whitespace
 * around the `=`, so `data-testid = "x"` paints a hook just like the other one — but the contract
 * reader (`LITERAL_TESTID`) reads no space and never takes its name down. One spelling means one
 * spelling, the `=` bare (invoice#77).
 */
const TESTID_SPELLING = /(?<![\w-])([.?@]|v-bind:|:)?((?:data-)?testid)(\s*=\s*)(\$\{|"|'|[^\s>])/g;

/**
 * Any `data-test…` attribute, to tell the hook apart from the variants that look like it and are
 * not. Playwright resolves `getByTestId` against `data-testid` and nothing else, so a
 * `data-test="x"` is a hook the robot cannot reach — and the spec that reads it asserts about
 * nothing, forever.
 */
const TEST_ATTR = /(?<![\w-])(data-test[\w-]*)\s*=\s*("[^"]*"|'[^']*'|\$\{)?/g;

/** Kebab-case: lowercase and digits separated by a single hyphen. */
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A real issue reference, `repo#N`. A placeholder (`printing#PENDING`) is not one. */
const ISSUE_REF = /^[a-z][a-z0-9_-]*#\d+$/;

/** End of a JS string opened at `from` with quote `quote`. */
function endOfString(src: string, from: number, quote: string): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') {
      i++;
      continue;
    }
    if (src[i] === quote) return i;
  }
  return src.length;
}

/**
 * End of a `${…}` expression opened at `from` (right after the `{`).
 *
 * Counting braces alone is not enough: a Lit expression carries objects, strings and other nested
 * templates inside (`style=${`left:${x}px`}`), so each one has to be skipped whole or the inner
 * template's first `}` would close the outer expression.
 */
function endOfExpression(src: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') {
      i = endOfTemplate(src, i + 1) + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      i = endOfString(src, i + 1, c) + 1;
      continue;
    }
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return src.length;
}

/** End of a template literal opened at `from` (right after the backtick). */
function endOfTemplate(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') return i;
    if (c === '$' && src[i + 1] === '{') {
      i = endOfExpression(src, i + 2) + 1;
      continue;
    }
    i++;
  }
  return src.length;
}

/**
 * The file's MARKUP: a copy of the same length where only what lives inside an `html`…`` template
 * survives, and everything else is blanks.
 *
 * A Lit component has no `<template>` block like a `.vue` file: its markup is tagged templates
 * scattered across the class. Sweeping the whole file would count as a control any `<input>`
 * appearing inside a comment or a TypeScript string; sweeping only the top-level templates (the
 * nested ones travel INSIDE their parent, so they are not counted twice) looks at exactly what is
 * painted. Positions and newlines are preserved so the reported line number is the real one.
 */
function markupOf(source: string): string {
  // Indexed by UTF-16 unit, NOT by code point. `[...source]` splits by code point, so ONE astral
  // character above the markup (this screen carries a 🔴 in a comment) makes the map one slot
  // shorter than the source while `out[k] = source[k]` keeps writing at UTF-16 offsets. Each
  // template then starts one slot off, and since a template opens with a newline that newline ends
  // up duplicated: every reported line drifts one further down per template. Measured on this very
  // component: lines 755, 838, 855 and 877 reported for controls opening at 754, 836, 852 and 873.
  // The hooks themselves are still read (the copied block is internally contiguous), so this sends
  // the author to the wrong line rather than hiding a control — which is still a guard nobody
  // trusts the second time it points at a line with nothing on it.
  const out: string[] = new Array(source.length);
  for (let k = 0; k < source.length; k++) out[k] = source[k] === '\n' ? '\n' : ' ';
  const OPEN = /\bhtml`/g;
  let i = 0;
  while (i < source.length) {
    OPEN.lastIndex = i;
    const m = OPEN.exec(source);
    if (!m) break;
    const start = m.index + m[0].length;
    const end = endOfTemplate(source, start);
    for (let k = start; k < end; k++) out[k] = source[k];
    i = end + 1;
  }
  return out.join('');
}

/**
 * The `>` that closes an opening tag.
 *
 * It skips what is quoted and — this is the Lit-specific part — every `${…}`: half the tags in this
 * module carry a handler with an arrow function (`@ionInput=${(e) => …}`), and its `=>` brings a
 * `>` that would cut the tag in half. With the tag cut short, a hook written after the handler
 * would be invisible and the coverage rule would fail green.
 */
function openTag(src: string, start: number): string {
  let i = start;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '$' && src[i + 1] === '{') {
      i = endOfExpression(src, i + 2) + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      i++;
      continue;
    }
    if (c === '>') return src.slice(start, i + 1);
    i++;
  }
  return src.slice(start);
}

/** Files under `ui/` that are NOT tests: the candidate surfaces. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

/** Every `.ts` under `ui/`, tests included: the other half of the attribute rule. */
function allFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) allFiles(full, found);
    else if (entry.endsWith('.ts')) found.push(full);
  }
  return found;
}

const SURFACES: Array<{ name: string; source: string; markup: string }> = sourceFiles(UI)
  .map((full) => {
    const source = readFileSync(full, 'utf8');
    return { name: relative(UI, full), source, markup: markupOf(source) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * The whole module AND all of its specs. The attribute rule has to reach both halves: a component
 * writing `data-test` is a component the robot does not address, and a spec still reading
 * `[data-test="…"]` after the component stopped writing it asserts `null` forever — which is how a
 * rule that never fires disguises itself as a rule that passes.
 *
 * This file is the only exclusion, and it has to be: a guard that forbids an attribute has to spell
 * it out in order to forbid it.
 */
const ALL_SOURCES: Array<{ name: string; source: string }> = allFiles(UI)
  .map((full) => ({ name: relative(UI, full), source: readFileSync(full, 'utf8') }))
  .filter(({ name }) => name !== 'testids.test.ts')
  .sort((a, b) => a.name.localeCompare(b.name));

/** A surface's form controls, with the text of their opening tag. */
function controls(markup: string): Array<{ tag: string; line: number; open: string }> {
  const found: Array<{ tag: string; line: number; open: string }> = [];
  CONTROL_OPEN.lastIndex = 0;
  for (let m = CONTROL_OPEN.exec(markup); m; m = CONTROL_OPEN.exec(markup)) {
    found.push({
      tag: m[1],
      line: markup.slice(0, m.index).split('\n').length,
      open: openTag(markup, m.index),
    });
  }
  return found;
}

function dataTables(markup: string): Array<{ line: number; open: string }> {
  const found: Array<{ line: number; open: string }> = [];
  DATA_TABLE_OPEN.lastIndex = 0;
  for (let m = DATA_TABLE_OPEN.exec(markup); m; m = DATA_TABLE_OPEN.exec(markup)) {
    found.push({
      line: markup.slice(0, m.index).split('\n').length,
      open: openTag(markup, m.index),
    });
  }
  return found;
}

/**
 * Carries a hook, in one of the two spellings the rules read: literal (`data-testid="x"`) or
 * computed (`data-testid=${…}`).
 *
 * The `=` has to be bare, and that is the whole point: `data-testid = "x"` with spaces around it is
 * painted by Lit exactly the same (the HTML parser allows the whitespace) but `LITERAL_TESTID` reads
 * no space, so a reader that accepted it would call the control hooked while its name never reached
 * the contract — a LIVE hook nobody declared, which is precisely what renaming is supposed to break.
 * Measured on this screen: an action added as `data-testid = "printing-queue-purge"` passed all 22
 * rules. Now it falls by two (coverage and spelling).
 */
const hasTestid = (openTagText: string): boolean =>
  /(?:^|\s)data-testid=(?:"|\$\{)/.test(openTagText);

/** An `<ok-data-table>` with its namespace declared, in the one spelling the contract reads. */
const hasTableTestid = (openTagText: string): boolean => /(?:^|\s)testid="/.test(openTagText);

/**
 * The ways a chunk of source writes the SAME attribute that are NOT one of the three the rules read.
 * One reader, so the rule below and the fixtures that pin it can never answer differently — and so
 * the rule keeps being checked against spellings nobody has typed into this tree yet.
 */
function badSpellings(source: string): string[] {
  const found: string[] = [];
  TESTID_SPELLING.lastIndex = 0;
  for (let m = TESTID_SPELLING.exec(source); m; m = TESTID_SPELLING.exec(source)) {
    const [, prefix, attr, separator, open] = m;
    const ok =
      prefix === undefined &&
      separator === '=' &&
      (attr === 'data-testid' ? open === '"' || open === '${' : open === '"');
    if (!ok) found.push(`${prefix ?? ''}${attr}${separator}${open}`);
  }
  for (const value of literalTestids(source)) {
    // `data-testid="${…}"` is painted by Lit just like the unquoted form, but the contract rule
    // would read it as a literal name — and declare the TEXT of the expression as if it were a
    // hook. One form only, and this is not it.
    if (value.includes('${')) found.push(`data-testid="${value}" (quoted binding)`);
  }
  return found;
}

function literalTestids(markup: string): string[] {
  const found: string[] = [];
  LITERAL_TESTID.lastIndex = 0;
  for (let m = LITERAL_TESTID.exec(markup); m; m = LITERAL_TESTID.exec(markup)) found.push(m[1]);
  return found;
}

/** The `data-testid=${…}` expressions of a surface, each one whole. */
function computedTestids(markup: string): string[] {
  const found: string[] = [];
  const OPEN = /(?<![:\w-])data-testid=\$\{/g;
  for (let m = OPEN.exec(markup); m; m = OPEN.exec(markup)) {
    const end = endOfExpression(markup, m.index + m[0].length);
    found.push(markup.slice(m.index + m[0].length, end).trim());
    OPEN.lastIndex = end + 1;
  }
  return found;
}

/**
 * The fixed head of a computed hook: a template `` `printing-job-${j.jobId}` `` → the string
 * `printing-job-`.
 *
 * `null` means the expression spells no predictable head: either a bare property
 * (`data-testid=${this.testid}` — the reusable control, named by whoever uses it) or a template that
 * opens with the interpolation, which nobody can address.
 */
function fixedPartOf(expression: string): string | null {
  const template = expression.match(/^`([^`]*)`$/);
  if (!template) return null;
  const head = template[1].split('${')[0];
  return head === '' ? null : head;
}

/** The fixed heads a surface writes today, deduplicated: every row shares its own. */
const fixedParts = (markup: string): string[] => [
  ...new Set(
    computedTestids(markup)
      .map(fixedPartOf)
      .filter((fixed): fixed is string => fixed !== null),
  ),
];

const uncoveredControls = (markup: string): string[] => [
  ...controls(markup)
    .filter((c) => !hasTestid(c.open))
    .map((c) => `<${c.tag}> line ${c.line}`),
  ...dataTables(markup)
    .filter((d) => !hasTableTestid(d.open))
    .map((d) => `<ok-data-table> line ${d.line} (no testid: its chrome paints no hook at all)`),
];

const surfaceOf = (name: string) => SURFACES.find((s) => s.name === name);

describe('data-testid — the printing module UI contract (printing#38)', () => {
  it('1 · covered surfaces leave no control without a hook', () => {
    const offenders: string[] = [];
    for (const name of Object.keys(COVERED)) {
      const surface = surfaceOf(name);
      expect(surface, `${name} is in COVERED but does not exist`).toBeDefined();
      for (const control of uncoveredControls(surface!.markup)) offenders.push(`${name}: ${control}`);
    }
    expect(offenders, 'a control without data-testid is one Playwright cannot drive').toEqual([]);
  });

  it('2 · the declared literal contract is EXACTLY what the surface paints', () => {
    const drift: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      const found = [...new Set(literalTestids(surfaceOf(name)?.markup ?? ''))].sort();
      const declared = [...spec.contract].sort();
      for (const missing of declared.filter((v) => !found.includes(v))) {
        drift.push(`${name}: the contract declares "${missing}" and the surface no longer has it`);
      }
      for (const extra of found.filter((v) => !declared.includes(v))) {
        drift.push(`${name}: the surface has "${extra}" and the contract does not declare it`);
      }
    }
    expect(drift, 'renaming a data-testid breaks the QA suite: declare it here').toEqual([]);
  });

  it('2b · the declared computed contract is EXACTLY what the surface paints', () => {
    const drift: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      const found = fixedParts(surfaceOf(name)?.markup ?? '').sort();
      const declared = [...(spec.computed ?? [])].sort();
      for (const missing of declared.filter((v) => !found.includes(v))) {
        drift.push(`${name}: the contract declares "${missing}…" and the surface no longer has it`);
      }
      for (const extra of found.filter((v) => !declared.includes(v))) {
        drift.push(`${name}: the surface has "${extra}…" and the contract does not declare it`);
      }
    }
    expect(drift, 'renaming a computed hook breaks the QA suite: declare it here').toEqual([]);
  });

  it('2c · every hook is kebab-case and lives under its surface namespace', () => {
    const offenders: string[] = [];
    for (const { name, markup } of SURFACES) {
      for (const value of new Set(literalTestids(markup))) {
        if (!KEBAB.test(value)) offenders.push(`${name}: "${value}" is not kebab-case`);
      }
      for (const fixed of fixedParts(markup)) {
        if (!KEBAB.test(fixed.replace(/-$/, ''))) offenders.push(`${name}: "${fixed}…" is not kebab-case`);
      }
    }
    for (const [name, spec] of Object.entries(COVERED)) {
      const markup = surfaceOf(name)?.markup ?? '';
      for (const value of new Set(literalTestids(markup))) {
        if (!value.startsWith(spec.prefix)) offenders.push(`${name}: "${value}" ≠ ${spec.prefix}*`);
      }
      for (const fixed of fixedParts(markup)) {
        if (!fixed.startsWith(spec.prefix)) offenders.push(`${name}: "${fixed}…" ≠ ${spec.prefix}*`);
      }
    }
    expect(offenders, 'a name QA cannot predict is a name QA cannot use').toEqual([]);
  });

  it('2d · no literal hook is repeated across two surfaces', () => {
    const owners = new Map<string, string[]>();
    for (const { name, markup } of SURFACES) {
      for (const value of new Set(literalTestids(markup))) {
        owners.set(value, [...(owners.get(value) ?? []), name]);
      }
    }
    expect(
      [...owners].filter(([, files]) => files.length > 1).map(([v, f]) => `"${v}" in ${f.join(' + ')}`),
      'getByTestId would return two elements and the spec would pick one at random',
    ).toEqual([]);
  });

  it('2e · a computed hook with no fixed head only fits a reusable control', () => {
    // A surface with its own namespace spells its hooks out; `prefix: ''` is how this registry would
    // mark the control that has none, because its name is given by whoever uses it.
    const offenders: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      if (!spec.prefix) continue;
      for (const expression of computedTestids(surfaceOf(name)?.markup ?? '')) {
        if (fixedPartOf(expression) === null) offenders.push(`${name}: data-testid=\${${expression}}`);
      }
    }
    expect(
      offenders,
      'QA cannot predict a name the surface does not spell: give it a fixed head',
    ).toEqual([]);
  });

  it('3 · nothing in the module writes data-test: Playwright only resolves data-testid', () => {
    const offenders: string[] = [];
    for (const { name, source } of ALL_SOURCES) {
      TEST_ATTR.lastIndex = 0;
      for (let m = TEST_ATTR.exec(source); m; m = TEST_ATTR.exec(source)) {
        if (m[1] !== 'data-testid') offenders.push(`${name}: ${m[1]}=${m[2] ?? ''}`);
      }
    }
    expect(
      offenders,
      'getByTestId does not resolve it: write data-testid, with its surface prefix',
    ).toEqual([]);
  });

  it('4 · a hook is written data-testid="…", data-testid=${…} or testid="…", and no other way', () => {
    const offenders: string[] = [];
    for (const { name, source } of ALL_SOURCES) {
      for (const bad of badSpellings(source)) offenders.push(`${name}: ${bad}`);
    }
    expect(
      offenders,
      'the rules above read one spelling: any other one is a hook with no contract',
    ).toEqual([]);
  });

  it('5 · every surface with controls is classified: covered, or with its issue', () => {
    const unclassified = SURFACES.filter(
      ({ name, markup }) =>
        (controls(markup).length > 0 || dataTables(markup).length > 0) &&
        !(name in COVERED) &&
        !(name in NOT_YET_COVERED),
    ).map(({ name }) => name);
    expect(
      unclassified,
      'a new component is born with data-testid — or enters NOT_YET_COVERED with its issue',
    ).toEqual([]);
  });

  it('5b · a pending surface that is already complete does not stay pending', () => {
    const stale = Object.keys(NOT_YET_COVERED).filter((name) => {
      const surface = surfaceOf(name);
      return surface !== undefined && uncoveredControls(surface.markup).length === 0;
    });
    expect(stale, 'it already has every hook: move it to COVERED with its contract').toEqual([]);
  });

  it('5c · the pending list only shrinks: a new surface is born covered, not pending', () => {
    const pending = Object.keys(NOT_YET_COVERED).length;
    expect(
      pending,
      pending > PENDING_TODAY
        ? 'a new surface does not enter NOT_YET_COVERED: give it its data-testid and cover it'
        : `a pending surface left the list: lower PENDING_TODAY to ${pending}`,
    ).toBe(PENDING_TODAY);
  });

  it('5d · the pending list names no surface that no longer exists', () => {
    expect(Object.keys(NOT_YET_COVERED).filter((name) => surfaceOf(name) === undefined)).toEqual([]);
  });

  it('5e · every pending surface cites a real issue, not a placeholder', () => {
    // A pending item with no issue is one nobody does: the registry reads like a plan, and a
    // `printing#PENDING` turns it into a list of good intentions that never reaches the board.
    const placeholders = Object.entries(NOT_YET_COVERED)
      .filter(([, issue]) => !ISSUE_REF.test(issue))
      .map(([name, issue]) => `${name}: "${issue}"`);
    expect(placeholders, 'open the issue and put its number: the board does not pick up a gap').toEqual([]);
  });
});

describe('the reader underneath the rules reads a LIT open tag, not a JavaScript one (printing#38)', () => {
  // The rules above are worth exactly what the reader underneath them sees, and in a Lit template an
  // attribute value is JavaScript — `@ionInput=${(e: Event) => this.set('paper_width', …)}` — which
  // is full of `>`: every arrow, every generic. A reader that closes the tag at the first `>` stops
  // inside the first handler and never sees the attributes after it.
  //
  // That cuts both ways and one of the two directions is SILENT: a control whose hook comes after a
  // handler would be reported as unhooked (loud, somebody fixes it), but a hook the reader cannot
  // see at all makes the rules pass over a screen they never actually read. These sources are
  // synthetic on purpose — a reader that only works on the shapes that exist today is a reader that
  // breaks on the next component.
  const hooksOf = (source: string) => literalTestids(markupOf(source));
  const controlsOf = (source: string) =>
    controls(markupOf(source)).map((c) => `<${c.tag}> line ${c.line}`);
  const unhooked = (source: string) => uncoveredControls(markupOf(source));

  it('sees a control that comes after another interpolated handler', () => {
    const source = 'html`<ion-button @wheel=${(e: WheelEvent) => this.spin(e)}></ion-button>`';
    expect(controlsOf(source), "the first handler's arrow is not the end of the tag").toEqual([
      '<ion-button> line 1',
    ]);
  });

  it('sees a data-testid written after the handler', () => {
    const source =
      'html`<ion-button @click=${() => this.save()} data-testid="printing-settings-save"></ion-button>`';
    expect(unhooked(source), 'the hook is there: reporting it missing asks for a second one').toEqual(
      [],
    );
  });

  it('the `>` that closes a generic is not the `>` that closes the tag', () => {
    const source =
      'html`<ion-select @ionChange=${(e: CustomEvent<{ value?: string }>) => this.pick(e)} data-testid="printing-paper-width"></ion-select>`';
    expect(unhooked(source), 'a generic inside a binding must not cut the tag short').toEqual([]);
  });

  it('still closes each tag at its own `>`, not at a later one', () => {
    const source =
      'html`<ion-input data-testid="printing-receipt-header"></ion-input><ion-button @click=${() => this.go()}></ion-button>`';
    expect(
      unhooked(source),
      'the input is hooked and the button is not: bleeding past the tag would hide one of the two',
    ).toEqual(['<ion-button> line 1']);
  });

  it('does not take :data-testid for a hook: that control is unhooked', () => {
    // If the reader accepts the colon, the coverage rule sees a hooked control AND the contract rule
    // sees the declared name present — the surface goes green while the spec that calls
    // `getByTestId('printing-auto-print')` finds nothing. Both loud rules have to fire.
    const source = 'html`<ion-toggle :data-testid="printing-auto-print"></ion-toggle>`';
    expect(unhooked(source), 'a colon-bound attribute is not a hook').toEqual([
      '<ion-toggle> line 1',
    ]);
  });

  it('does not put a :data-testid into the contract', () => {
    const source = 'html`<ion-toggle :data-testid="printing-auto-print"></ion-toggle>`';
    expect(
      hooksOf(source),
      'reading it as a literal would let a dead hook satisfy the declared contract',
    ).toEqual([]);
  });

  it('reads the testid of a table declared after its interpolated properties', () => {
    const source =
      'html`<ok-data-table .rows=${this.rows} .columns=${this.cols} testid="printing-jobs-table"></ok-data-table>`';
    expect(
      dataTables(markupOf(source)).filter((d) => !hasTableTestid(d.open)),
      'the namespace is there: missing it would demand a second one',
    ).toEqual([]);
  });

  it('reads no control outside a template: a comment is not markup', () => {
    const source = '// <ion-input> in a comment\nconst sample = "<ion-toggle>";\nhtml`<p></p>`';
    expect(controlsOf(source), 'sweeping the whole file would invent controls nobody paints').toEqual(
      [],
    );
  });

  it('the spelling rule denies EVERY other way of writing the same attribute', () => {
    // Held against FIXTURES and not only against the tree: a rule that has only ever seen the one
    // spelling nobody has mistyped yet is a rule nothing has checked. Each of these is an attribute
    // Lit paints — or one the readers above cannot read — and none of them is the spelling.
    for (const fixture of [
      '<ion-input data-testid = "x"></ion-input>',
      '<ion-input data-testid= "x"></ion-input>',
      "<ion-input data-testid='x'></ion-input>",
      '<ion-input :data-testid="x"></ion-input>',
      '<ion-input v-bind:data-testid="x"></ion-input>',
      '<ion-input .data-testid=${x}></ion-input>',
      '<ion-input ?data-testid=${x}></ion-input>',
      '<ion-input data-testid=x></ion-input>',
      '<ion-input data-testid="${x}"></ion-input>',
      '<ok-data-table testid = "x"></ok-data-table>',
    ]) {
      expect(badSpellings(fixture), `this spelling has to be denied: ${fixture}`).not.toEqual([]);
    }
    expect(badSpellings('<ion-input data-testid="x"></ion-input>'), 'the fixed form').toEqual([]);
    expect(badSpellings('<ion-input data-testid=${x}></ion-input>'), 'the Lit form').toEqual([]);
    expect(badSpellings('<ok-data-table testid="x"></ok-data-table>'), 'the namespace').toEqual([]);
  });

  it('only the spelling the contract can read counts as a hook for coverage', () => {
    // The two readers have to agree. `data-testid = "x"` with spaces around the `=` IS painted by
    // Lit (the HTML parser allows the whitespace), so a reader that accepts it leaves a LIVE hook
    // whose name `LITERAL_TESTID` never reads: coverage green, contract silent, and renaming that
    // hook months later breaks nothing here and the QA suite in another repo. Measured on this very
    // screen: an action added as `data-testid = "printing-queue-purge"` passed all 22 rules.
    expect(hasTestid('<ion-input data-testid="x">'), 'the fixed form is a hook').toBe(true);
    expect(hasTestid('<ion-input data-testid=${x}>'), 'the Lit form is a hook').toBe(true);
    expect(hasTestid('<ion-input :data-testid="x">'), ':data-testid is not one Lit resolves').toBe(
      false,
    );
    expect(hasTestid('<ion-input data-testid = "x">'), 'the contract cannot read it').toBe(false);
    expect(hasTableTestid('<ok-data-table testid="x">'), 'the namespace is declared').toBe(true);
    expect(hasTableTestid('<ok-data-table testid = "x">'), 'the contract cannot read it').toBe(
      false,
    );
  });

  it('a hook written with spaces around the = leaves its control reported as unhooked', () => {
    const source = 'html`<ion-button @click=${() => this.purge()} data-testid = "printing-queue-purge"></ion-button>`';
    expect(
      unhooked(source),
      'it paints, so it has to fall LOUD here too and not only in the spelling rule',
    ).toEqual(['<ion-button> line 1']);
  });

  it('an astral character above the markup does not shift what the reader sees', () => {
    // This screen carries a 🔴 in a comment, and that one character used to be enough to make every
    // reported line drift (see `markupOf`). The template here has to span more than one line,
    // because that is the shape that reproduces it: with the template on a single line the
    // code-point map gives the right answer by accident, and a regression test that passes against
    // the bug is not one. Checked by putting `[...source]` back: this test is the one that falls.
    const source =
      '// 🔴 a note with an emoji in it\nconst sample = 1;\nhtml`\n  <ion-button @click=${() => this.go(sample)} data-testid="printing-queue-refresh"></ion-button>\n`';
    expect(controlsOf(source), 'the reported line is the real one').toEqual(['<ion-button> line 4']);
    expect(hooksOf(source), 'the hook is inside the tag the sweep reads').toEqual([
      'printing-queue-refresh',
    ]);
  });
});
