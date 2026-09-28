// printing#53 + printing#52 — the queue speaks about jobs the way a person reads them.
//
// printing#53: the orange alert read «11 trabajo(s) de impresión de Recibo llevan 4 h esperando»,
// and two more sentences of the same screen carried a «(s)» — no till on the market writes a plural
// in brackets when it knows the number. Only the catalogue knows the singular noun AND the verb that
// agrees with it («lleva» / «llevan»), so the choice is a key (`…One`, the pattern of sales#459),
// never a rule in the code.
//
// printing#52: every row was titled with the job's internal id (`sale-018f…`), which broke into
// three lines on a phone, and eleven «Descartar» buttons had no name saying which job they
// discard. The row now says WHAT is printed and FROM WHICH document (`documentRef`, the number the
// document itself carries — the ticket, the invoice, the kitchen order), or the time it was queued
// when the hub does not send a number; every gesture is named after that row.
//
// The double of t() resolves against the REAL locales/*.json and fills {params}: the symptom is a
// text, so the words are pinned, not only the keys.
import { afterEach, describe, expect, it, vi } from 'vitest';

import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

type Lang = 'es' | 'en';
const LOCALES: Record<Lang, { ui: Record<string, string> }> = { es: esLocale, en: enLocale };

interface Double {
  locale: Lang;
  coverage: unknown[];
  jobs?: Record<string, unknown[]>;
}

function stubErplora({ locale, coverage, jobs = {} }: Double): void {
  (globalThis as Record<string, unknown>).erplora = {
    query: vi.fn(async (name: string, params?: Record<string, unknown>) => {
      if (name === 'printing.settings.get') {
        return [{ receipt_header: '', receipt_footer: '', paper_width: 80, auto_print_on_sale: 1, open_drawer_on_sale: 0, print_kitchen: 0 }];
      }
      if (name === 'hub.print.coverage') return coverage;
      if (name === 'hub.print.jobs') return jobs[String(params?.status ?? '')] ?? [];
      throw new Error(`unexpected query: ${name}`);
    }),
    command: async () => ({}),
    forModule: () => ({ printQueue: { retry: vi.fn(), discard: vi.fn() } }),
    hasPermission: (perm: string) => perm === 'hub.administer',
    peripherals: {
      detect: async () => ({ online: false }),
      discoverPrinters: async () => [],
      getDevices: async () => [],
    },
    locale,
    t: (catalog: Record<string, { ui: Record<string, string> }>, key: string, params?: Record<string, unknown>) => {
      const text = catalog[locale]?.ui?.[key.split('.')[1] ?? ''];
      if (typeof text !== 'string') return `MISSING:${key}`;
      return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        params && name in params ? String(params[name]) : whole);
    },
  };
}

type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mount(double: Double): Promise<Mounted> {
  stubErplora(double);
  await import('./erp-printing-settings');
  const el = document.createElement('erp-printing-settings') as Mounted;
  document.body.appendChild(el);
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
  return el;
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** What the screen must never say: a bracketed plural, a raw key or an unfilled placeholder. */
function expectCleanSentence(said: string): void {
  expect(said, 'resolved from the catalogue, no key left raw').not.toContain('MISSING:');
  expect(said, 'a bracketed plural').not.toMatch(/\((s|es)\)/);
  expect(said, 'an unfilled placeholder').not.toMatch(/\{\w+\}/);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ── printing#53 — the number and its noun agree ───────────────────────────────────────────────

const stuck = (waiting: number) => [
  { role: 'receipt', waiting, liveHosts: 0, waitingSeconds: 4 * 3600, undrained: true },
];
const healthy = (liveHosts: number) => [
  { role: 'receipt', waiting: 0, liveHosts, waitingSeconds: 0, undrained: false },
];

const WORDS: Record<Lang, Record<string, RegExp>> = {
  es: {
    alertOne: /^1 trabajo de impresión de Recibo lleva 4 h esperando\./,
    alertMany: /^11 trabajos de impresión de Recibo llevan 4 h esperando\./,
    clearOne: /^Todo al día: la cola está vacía y hay 1 dispositivo conectado\.$/,
    clearMany: /^Todo al día: la cola está vacía y hay 2 dispositivos conectados\.$/,
    hostsOne: /^Imprime desde 1 dispositivo\.$/,
    hostsMany: /^Imprime desde 2 dispositivos\.$/,
  },
  en: {
    alertOne: /^1 print job for Receipt has been waiting 4 h\./,
    alertMany: /^11 print jobs for Receipt have been waiting 4 h\./,
    clearOne: /^All clear: the queue is empty and 1 device is connected\.$/,
    clearMany: /^All clear: the queue is empty and 2 devices are connected\.$/,
    hostsOne: /^Printing from 1 device\.$/,
    hostsMany: /^Printing from 2 devices\.$/,
  },
};

describe.each(['es', 'en'] as const)('the queue sentences agree with their number (%s)', (lang) => {
  const w = WORDS[lang];

  it('ONE stuck job is one job that waits, with no «(s)»', async () => {
    const el = await mount({ locale: lang, coverage: stuck(1) });
    const said = text(el.shadowRoot.querySelector('[data-testid="printing-queue-alert-receipt"]'));
    expectCleanSentence(said);
    expect(said).toMatch(w.alertOne);
  });

  it('eleven stuck jobs keep the plural', async () => {
    const el = await mount({ locale: lang, coverage: stuck(11) });
    const said = text(el.shadowRoot.querySelector('[data-testid="printing-queue-alert-receipt"]'));
    expectCleanSentence(said);
    expect(said).toMatch(w.alertMany);
  });

  it('the all-clear counts one device in the singular and two in the plural', async () => {
    const one = await mount({ locale: lang, coverage: healthy(1) });
    const saidOne = text(one.shadowRoot.querySelector('[data-testid="printing-queue-clear"]'));
    expectCleanSentence(saidOne);
    expect(saidOne).toMatch(w.clearOne);
    document.body.innerHTML = '';

    const two = await mount({ locale: lang, coverage: healthy(2) });
    const saidTwo = text(two.shadowRoot.querySelector('[data-testid="printing-queue-clear"]'));
    expectCleanSentence(saidTwo);
    expect(saidTwo).toMatch(w.clearMany);
  });

  it('the station card counts the devices printing it the same way', async () => {
    const one = await mount({ locale: lang, coverage: healthy(1) });
    const saidOne = text(one.shadowRoot.querySelector('[data-testid="printing-queue-role-receipt"] .hosts'));
    expectCleanSentence(saidOne);
    expect(saidOne).toMatch(w.hostsOne);
    document.body.innerHTML = '';

    const two = await mount({ locale: lang, coverage: healthy(2) });
    const saidTwo = text(two.shadowRoot.querySelector('[data-testid="printing-queue-role-receipt"] .hosts'));
    expectCleanSentence(saidTwo);
    expect(saidTwo).toMatch(w.hostsMany);
  });
});

describe('the catalogue has no bracketed plural left', () => {
  it.each(['es', 'en'] as const)('%s', (lang) => {
    const bracketed = Object.entries(LOCALES[lang].ui).filter(([, v]) => /\w\((s|es)\)/.test(v));
    expect(bracketed.map(([k]) => k)).toEqual([]);
  });

  it('every singular form has its plural twin in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      const ui = LOCALES[lang].ui;
      for (const key of ['queueAlertWaiting', 'queueAllClear', 'queueLiveHosts']) {
        expect(ui[key], `${lang}.${key}`).toBeTypeOf('string');
        expect(ui[`${key}One`], `${lang}.${key}One`).toBeTypeOf('string');
      }
    }
  });
});

// ── printing#52 — a job is named after its document, and so is every gesture on it ────────────

const SALE_ID = 'sale-018f3c2a-7d51-7b6e-9c1a-5e2f0d4b8a11';
const OTHER_SALE_ID = 'sale-018f3c2a-7d51-7b6e-9c1a-5e2f0d4b8a12';
const KITCHEN_ID = 'kitchen-pass-018f3c2a-7d51-7b6e-9c1a-5e2f0d4b8a13-kitchen';
const CREATED = '2026-09-26T21:05:00Z';

const job = (over: Record<string, unknown>) => ({
  role: 'receipt',
  documentType: 'receipt',
  format: 'receipt',
  status: 'pending',
  attempts: 0,
  createdAt: CREATED,
  lastError: '',
  ...over,
});

/** The same moment the screen writes, so the assertion does not pin a timezone or a locale. */
function moment(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
}

function row(el: Mounted, jobId: string): HTMLElement {
  const found = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="printing-job-${jobId}"]`);
  expect(found, `row ${jobId} is on screen`).toBeTruthy();
  return found!;
}

function ariaOf(el: Mounted, testid: string): string {
  return el.shadowRoot.querySelector(`[data-testid="${testid}"]`)?.getAttribute('aria-label') ?? '';
}

const NAMED: Record<Lang, { ticket: string; other: string; kitchen: string; discard: string; retry: string; confirm: string }> = {
  es: {
    ticket: 'Recibo T-000123',
    other: 'Recibo T-000124',
    kitchen: 'Comanda de cocina 57',
    discard: 'Descartar Recibo T-000123',
    retry: 'Reintentar Recibo T-000123',
    confirm: 'Sí, descartar Recibo T-000123',
  },
  en: {
    ticket: 'Receipt T-000123',
    other: 'Receipt T-000124',
    kitchen: 'Kitchen order 57',
    discard: 'Discard Receipt T-000123',
    retry: 'Try Receipt T-000123 again',
    confirm: 'Yes, discard Receipt T-000123',
  },
};

describe.each(['es', 'en'] as const)('each job is named after its document (%s)', (lang) => {
  const n = NAMED[lang];

  it('titles the row with the document and its number, never the internal id', async () => {
    const el = await mount({
      locale: lang,
      coverage: stuck(2),
      jobs: {
        pending: [
          job({ jobId: SALE_ID, documentRef: 'T-000123' }),
          job({ jobId: KITCHEN_ID, role: 'kitchen', documentType: 'kitchen_order', documentRef: '57' }),
        ],
      },
    });
    const sale = text(row(el, SALE_ID));
    const kitchen = text(row(el, KITCHEN_ID));
    expect(sale).toContain(n.ticket);
    expect(kitchen).toContain(n.kitchen);
    expect(sale, 'the internal id is plumbing, not a label').not.toContain(SALE_ID);
    expect(kitchen, 'the internal id is plumbing, not a label').not.toContain(KITCHEN_ID);
    // And a waiting job still says how long it has waited: that is what the alert is about.
    const waiting = LOCALES[lang].ui.jobAge!.replace(/\s*\{age\}\s*/, '');
    expect(sale).toMatch(new RegExp(`${waiting} \\d+ (h|min|s)`));
    expectCleanSentence(sale);
  });

  it('without a number (a hub older than documentRef) the row says the type and WHEN, not the id', async () => {
    const el = await mount({
      locale: lang,
      coverage: stuck(1),
      jobs: { pending: [job({ jobId: SALE_ID })] },
    });
    const sale = text(row(el, SALE_ID));
    expect(sale).not.toContain(SALE_ID);
    expect(sale).toContain(moment(CREATED, lang));
    expect(ariaOf(el, `printing-job-${SALE_ID}-discard`)).toContain(moment(CREATED, lang));
    expectCleanSentence(sale);
  });

  it('a blank number is no number: the row falls back to the time instead of an empty title', async () => {
    const el = await mount({
      locale: lang,
      coverage: stuck(1),
      jobs: { pending: [job({ jobId: SALE_ID, documentRef: '   ' })] },
    });
    expect(ariaOf(el, `printing-job-${SALE_ID}-discard`)).toContain(moment(CREATED, lang));
  });

  it('does not repeat the station when it reads the same as the document («Recibo · Recibo»)', async () => {
    const el = await mount({
      locale: lang,
      coverage: stuck(2),
      jobs: {
        pending: [
          job({ jobId: SALE_ID, documentRef: 'T-000123' }),
          job({ jobId: KITCHEN_ID, role: 'bar', documentType: 'kitchen_order', documentRef: '57' }),
        ],
      },
    });
    const receiptWord = LOCALES[lang].ui.docReceipt!;
    const said = text(row(el, SALE_ID));
    expect(said.split(receiptWord).length - 1, `«${receiptWord}» once: ${said}`).toBe(1);
    // A kitchen order routed to the BAR says so: that one is information, not an echo.
    expect(text(row(el, KITCHEN_ID))).toContain(LOCALES[lang].ui.roleBar!);
  });

  it('names every gesture after its job, so two «Descartar» are never the same button', async () => {
    const el = await mount({
      locale: lang,
      coverage: stuck(2),
      jobs: {
        pending: [
          job({ jobId: SALE_ID, documentRef: 'T-000123' }),
          job({ jobId: OTHER_SALE_ID, documentRef: 'T-000124' }),
        ],
        dead: [job({ jobId: 'dead-1', status: 'dead', attempts: 3, documentRef: 'T-000123' })],
      },
    });
    expect(ariaOf(el, `printing-job-${SALE_ID}-discard`)).toBe(n.discard);
    expect(ariaOf(el, `printing-job-${OTHER_SALE_ID}-discard`)).toContain(n.other);
    expect(ariaOf(el, 'printing-job-dead-1-retry')).toBe(n.retry);

    el.shadowRoot.querySelector<HTMLElement>(`[data-testid="printing-job-${SALE_ID}-discard"]`)!.click();
    await el.updateComplete;
    expect(ariaOf(el, `printing-job-${SALE_ID}-discard-confirm`)).toBe(n.confirm);
  });

  it('the retired list names its jobs the same way', async () => {
    const el = await mount({
      locale: lang,
      coverage: [],
      jobs: {
        discarded: [
          job({ jobId: SALE_ID, status: 'discarded', documentRef: 'T-000123', discardedAt: CREATED, discardedBy: 'hub_user:1', discardedByName: 'Ana' }),
        ],
      },
    });
    const retired = text(el.shadowRoot.querySelector(`[data-testid="printing-retired-${SALE_ID}"]`));
    expect(retired).toContain(n.ticket);
    expect(retired).not.toContain(SALE_ID);
  });
});
