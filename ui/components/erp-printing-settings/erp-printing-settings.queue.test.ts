// printing#28 — the Printers screen has to SHOW the hub's print queue.
//
// The runtime already publishes everything (hub#341/#342/#987): `GET /api/print/hosts` answers the
// per-role coverage (`waiting`, `liveHosts`, `waitingSeconds`, and `undrained` RESOLVED BY THE
// RUNTIME — one definition of "stuck", `print_hosts::is_undrained`, so the badge and the row cannot
// disagree) and `GET /api/print/jobs?status=…` answers the queue itself (`jobId`, `role`,
// `documentType`, `status`, `attempts`, `createdAt`, `lastError`).
//
// These tests mount the Web Component with a `fetch` double that answers EXACTLY the shapes the
// hub handlers serialize (`crates/server/src/print.rs::coverage_json` / `summary`) and assert on
// what gets painted. The four jobs of the issue — two kitchen orders waiting 29 minutes, two
// receipts waiting 4 — are the fixture: `attempts: 0` and an empty `lastError` are NOT an error
// state, they are the silence this screen exists to break.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

// ── The wire, as the hub writes it ────────────────────────────────────────────────────────────

/** `GET /api/print/hosts` — `hosts` from `host_json`, `coverage` from `coverage_json`. */
const HOSTS_EMPTY_QUEUE = {
  ok: true,
  hosts: [],
  coverage: [
    { role: 'kitchen', waiting: 2, liveHosts: 0, waitingSeconds: 1757, undrained: true },
    { role: 'receipt', waiting: 2, liveHosts: 0, waitingSeconds: 238, undrained: true },
  ],
};

/** The four stuck jobs of the issue, as `GET /api/print/jobs` summarizes them. */
const PENDING_JOBS = {
  ok: true,
  jobs: [
    {
      jobId: 'kitchen-order-1041',
      role: 'kitchen',
      documentType: 'kitchen_order',
      format: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: '2026-08-21T23:52:11Z',
      lastError: null,
    },
    {
      jobId: 'sale-2026-08-22-0012',
      role: 'receipt',
      documentType: 'receipt',
      format: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: '2026-08-22T00:41:03Z',
      lastError: null,
    },
  ],
};

const EMPTY_JOBS = { ok: true, jobs: [] };

/** A hub where everything works: one live host per role, nothing waiting. */
const HOSTS_HEALTHY = {
  ok: true,
  hosts: [
    {
      deviceId: 'till-01',
      role: 'receipt',
      label: 'Caja 1',
      live: true,
      registeredAt: '2026-08-01T10:00:00Z',
      registeredBy: 'admin',
      lastSeenAt: '2026-08-22T00:44:00Z',
    },
  ],
  coverage: [{ role: 'receipt', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false }],
};

/** A job that DID fail: the only place `lastError` and `attempts > 0` ever appear. */
const DEAD_JOBS = {
  ok: true,
  jobs: [
    {
      jobId: 'label-shelf-3',
      role: 'label',
      documentType: 'barcode_label',
      format: 'receipt',
      status: 'dead',
      attempts: 3,
      createdAt: '2026-08-22T00:10:00Z',
      lastError: 'printer not reachable: timeout',
    },
  ],
};

// ── Mount ─────────────────────────────────────────────────────────────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>;

function stubFetch(overrides: Record<string, unknown> = {}): FetchMock {
  const byUrl: Record<string, unknown> = {
    '/api/print/hosts': HOSTS_EMPTY_QUEUE,
    '/api/print/jobs?status=pending&limit=100': PENDING_JOBS,
    '/api/print/jobs?status=printing&limit=100': EMPTY_JOBS,
    '/api/print/jobs?status=dead&limit=100': EMPTY_JOBS,
    ...overrides,
  };
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = byUrl[url];
    if (body === undefined) throw new TypeError(`unexpected fetch: ${url}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function stubErplora() {
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => ({
      receipt_header: '', receipt_footer: '', paper_width: 80,
      auto_print_on_sale: 1, open_drawer_on_sale: 0, print_kitchen: 0,
    }),
    command: async () => ({}),
    peripherals: {
      detect: async () => ({ online: false, version: undefined }),
      discoverPrinters: async () => [],
      getDevices: async () => [],
    },
    locale: 'es',
    // Interpolates `{name}` the way the real SDK `t()` does (module-sdk index.ts) — the alarm and
    // the job rows only make sense with their facts substituted in.
    t: (catalog: Record<string, { ui: Record<string, string> }>, key: string, params?: Record<string, unknown>) => {
      const [, k] = key.split('.');
      let out = catalog.es?.ui?.[k] ?? key;
      if (params) for (const [name, value] of Object.entries(params)) out = out.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      return out;
    },
  };
}

/** Flushes Lit's update cycle plus whatever microtask the data load chained. */
async function settle(el: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

async function mount(): Promise<HTMLElement & { shadowRoot: ShadowRoot }> {
  await import('./erp-printing-settings');
  const el = document.createElement('erp-printing-settings');
  document.body.appendChild(el);
  await settle(el as HTMLElement & { updateComplete: Promise<unknown> });
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

/** happy-dom here exposes no `localStorage`; the component reads the global, so we stub it. */
function stubLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  });
}

beforeEach(() => {
  stubErplora();
  stubLocalStorage();
  localStorage.setItem('erplora.hub_session', 'sess-token');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── The alarm ─────────────────────────────────────────────────────────────────────────────────

describe('stuck queue: the screen says so (printing#28)', () => {
  it('paints an alarm with the count of waiting jobs, the role and the age of the oldest', async () => {
    stubFetch();
    const el = await mount();
    const alarm = el.shadowRoot.querySelector('.queue-alert');
    expect(alarm, 'no alarm row is painted for undrained coverage').toBeTruthy();
    const text = alarm?.textContent ?? '';
    expect(text).toContain('2');            // waiting
    expect(text).toMatch(/cocina/i);        // the role, translated
    expect(text).toMatch(/29\s*min/);       // waitingSeconds 1757 → 29 min, human
  });

  it('paints one alarm per undrained role, not one global blob', async () => {
    stubFetch();
    const el = await mount();
    const alarms = el.shadowRoot.querySelectorAll('.queue-alert');
    expect(alarms.length).toBe(2);          // kitchen AND receipt, per the coverage answer
    expect(alarms[1]?.textContent ?? '').toMatch(/recibo|caja/i);
  });

  it('names the fix: no device of that role is connected', async () => {
    stubFetch();
    const el = await mount();
    const text = el.shadowRoot.textContent ?? '';
    expect(text).toMatch(/ningún dispositivo/i);
  });

  it('never claims a job errored when it simply never got attempted', async () => {
    stubFetch();
    const el = await mount();
    const job = el.shadowRoot.querySelector('.queue-job');
    expect(job?.textContent ?? '').not.toMatch(/error/i);
  });
});

// ── Per-role coverage ─────────────────────────────────────────────────────────────────────────

describe('per-role coverage rows', () => {
  it('list every role the hub answers, with waiting count and live hosts', async () => {
    stubFetch();
    const el = await mount();
    const roles = Array.from(el.shadowRoot.querySelectorAll('.queue-role'));
    expect(roles.length).toBe(2);
    const kitchen = roles.find((r) => /cocina/i.test(r.textContent ?? ''));
    expect(kitchen?.textContent ?? '').toContain('2');
    expect(kitchen?.querySelector('.queue-role-status.ready')).toBeNull();
  });

  it('paints the explicit healthy state when a role has a live host and nothing waiting', async () => {
    stubFetch({
      '/api/print/hosts': HOSTS_HEALTHY,
      '/api/print/jobs?status=pending&limit=100': EMPTY_JOBS,
    });
    const el = await mount();
    const ready = el.shadowRoot.querySelector('.queue-role-status.ready');
    expect(ready, 'the ready badge is missing for a covered role').toBeTruthy();
    const text = el.shadowRoot.textContent ?? '';
    expect(text).toMatch(/Caja 1/);          // the live host is named
  });

  it('a role with no live host and nothing waiting is painted unattended, not ready', async () => {
    stubFetch({
      '/api/print/hosts': {
        ok: true,
        hosts: [],
        coverage: [{ role: 'receipt', waiting: 0, liveHosts: 0, waitingSeconds: 0, undrained: false }],
      },
    });
    const el = await mount();
    expect(el.shadowRoot.querySelector('.queue-role-status.ready')).toBeNull();
    expect(el.shadowRoot.querySelector('.queue-role-status.unattended')).toBeTruthy();
  });
});

// ── The job list ──────────────────────────────────────────────────────────────────────────────

describe('the queue listing', () => {
  it('lists each waiting job with role, document type, status, attempts and age', async () => {
    stubFetch();
    const el = await mount();
    const jobs = Array.from(el.shadowRoot.querySelectorAll('.queue-job'));
    expect(jobs.length).toBe(2);
    const first = jobs[0]?.textContent ?? '';
    expect(first).toContain('kitchen-order-1041');
    expect(first).toMatch(/comanda de cocina/i);   // documentType translated, not the raw enum
    expect(first).toMatch(/pendiente/i);           // status badge
    expect(first).toMatch(/0/);                    // attempts
  });

  it('shows the last error and the attempts of a dead job', async () => {
    stubFetch({
      '/api/print/jobs?status=pending&limit=100': EMPTY_JOBS,
      '/api/print/jobs?status=dead&limit=100': DEAD_JOBS,
      '/api/print/hosts': {
        ok: true,
        hosts: [],
        coverage: [{ role: 'label', waiting: 0, liveHosts: 0, waitingSeconds: 0, undrained: false }],
      },
    });
    const el = await mount();
    const dead = Array.from(el.shadowRoot.querySelectorAll('.queue-job'))
      .find((j) => /label-shelf-3/.test(j.textContent ?? ''));
    const text = dead?.textContent ?? '';
    expect(text).toMatch(/muert[oa]/i);
    expect(text).toContain('printer not reachable: timeout');
    expect(text).toContain('3');
  });

  it('paints the all-clear line when nothing is waiting and a host is live', async () => {
    stubFetch({
      '/api/print/hosts': HOSTS_HEALTHY,
      '/api/print/jobs?status=pending&limit=100': EMPTY_JOBS,
    });
    const el = await mount();
    expect(el.shadowRoot.textContent ?? '').toMatch(/todo al día|al día/i);
  });

  it('an empty queue with no live host is NOT painted as healthy', async () => {
    stubFetch({
      '/api/print/hosts': { ok: true, hosts: [], coverage: [] },
    });
    const el = await mount();
    expect(el.shadowRoot.textContent ?? '').not.toMatch(/al día/i);
  });
});

// ── Errors and refresh ────────────────────────────────────────────────────────────────────────

describe('reading failures and refresh', () => {
  it('a refused read paints an error, never a silent empty queue', async () => {
    const mock = vi.fn(async () => new Response('{"ok":false}', { status: 401 }));
    vi.stubGlobal('fetch', mock);
    const el = await mount();
    const text = el.shadowRoot.textContent ?? '';
    expect(text).toMatch(/no se pudo leer la cola/i);
    expect(text).not.toMatch(/al día/i);
    expect(el.shadowRoot.querySelectorAll('.queue-job').length).toBe(0);
  });

  it('sends the hub session header the shell keeps, so the runtime accepts the read', async () => {
    const mock = stubFetch();
    await mount();
    const withHeader = mock.mock.calls.some((c) => {
      const headers = ((c[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
      return headers['X-Hub-Session'] === 'sess-token';
    });
    expect(withHeader, 'the fetch never sent X-Hub-Session').toBe(true);
  });

  it('the refresh button re-reads the queue', async () => {
    const mock = stubFetch();
    const el = await mount();
    const before = mock.mock.calls.length;
    const btn = el.shadowRoot.querySelector<HTMLButtonElement>('.queue-refresh');
    expect(btn).toBeTruthy();
    btn?.click();
    await settle(el as unknown as HTMLElement & { updateComplete: Promise<unknown> });
    expect(mock.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-reads by itself every 30 s while mounted, and stops when disconnected', async () => {
    // shouldAdvanceTime lets the mount's own settle run on real time while the interval is faked.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mock = stubFetch();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const el = await mount();
    const afterMount = mock.mock.calls.length;
    vi.advanceTimersByTime(31_000);
    expect(mock.mock.calls.length).toBeGreaterThan(afterMount);
    el.remove();
    const afterRemove = mock.mock.calls.length;
    vi.advanceTimersByTime(120_000);
    expect(mock.mock.calls.length).toBe(afterRemove);
  });
});

// ── i18n ──────────────────────────────────────────────────────────────────────────────────────

const esUi = (esLocale as { ui: Record<string, string> }).ui;
const enUi = (enLocale as { ui: Record<string, string> }).ui;

describe('catalog parity for the queue strings (en source of truth, ADR-0055/0199)', () => {
  it('every new queue key exists in both languages', () => {
    const keys = [
      'queueTitle', 'queueRefresh', 'queueRefreshing', 'queueAllClear', 'queueAllClearNoHost',
      'queueAlertWaiting', 'queueNoDevice', 'queueWaitingJobs', 'queueOldest',
      'statusReady', 'statusStalled', 'statusUnattended',
      'jobPending', 'jobPrinting', 'jobDead', 'jobAttempts', 'jobLastError',
      'errQueueLoad', 'docKitchenOrder', 'docReceipt', 'docBarcodeLabel',
      'unitS', 'unitMin', 'unitH',
    ];
    for (const k of keys) {
      expect(esUi[k], `es is missing ui.${k}`).toBeTruthy();
      expect(enUi[k], `en is missing ui.${k}`).toBeTruthy();
    }
  });

  it('the alarm sentence carries the three facts: jobs, role, age', () => {
    // `t()` interpolates `{name}` (module-sdk): the template has to name all three.
    expect(esUi.queueAlertWaiting).toMatch(/\{waiting\}/);
    expect(esUi.queueAlertWaiting).toMatch(/\{role\}/);
    expect(esUi.queueAlertWaiting).toMatch(/\{age\}/);
    expect(enUi.queueAlertWaiting).toMatch(/\{waiting\}/);
  });
});

// ── The 390 px contract (CSS — happy-dom does not lay out) ────────────────────────────────────

describe('the queue section folds at 390 px (printing#28, three viewports)', () => {
  it('roles fold in an auto-fit grid, never a fixed-width row', async () => {
    stubFetch();
    const el = await mount();
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const roles = cssText.match(/\.queue-roles\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(roles).toMatch(/grid-template-columns\s*:\s*repeat\(auto-fit,\s*minmax\(/);
    expect(roles).not.toMatch(/minmax\(\s*(2[5-9]\d|[3-9]\d\d)px/);   // no card wider than a phone
  });

  it('job rows wrap instead of overflowing', async () => {
    stubFetch();
    await mount();
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const job = cssText.match(/\.queue-job\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(job).toMatch(/flex-wrap\s*:\s*wrap/);
    const jobId = cssText.match(/\.queue-job \.id\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(jobId + job).toMatch(/min-width\s*:\s*0|overflow-wrap|word-break/);  // long ids must break
  });
});
