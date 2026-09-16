// printing#28 + printing#30 — the Printers screen SHOWS the hub's print queue, and lets a stuck
// job out of the jam.
//
// **How it reads it changed** (printing#30). Until hub#1107 landed there was no door: the screen
// pulled `GET /api/print/hosts` and `GET /api/print/jobs` with a raw `fetch`, carrying the shell's
// session out of `localStorage`. That worked only while the session stayed in `localStorage` and
// broke the WC → SDK → dispatcher contract (ADR-0192). The core queries exist now, so the read is
// `erplora().query('hub.print.coverage' | 'hub.print.jobs')` like any other — same shapes, because
// the runtime serves both doors from one definition (`print_hosts::coverage_view`,
// `print_queue::status_view`).
//
// **And the screen can now act** (hub#1108): `retry` puts a `dead` job back in front of the print
// hosts, `discard` retires one nobody will ever print (never a delete — the row survives, stamped).
// Both are ADMIN + the `printer` capability, at the opposite end of the read, which any local
// session may do (hub#987: whoever is standing next to the printer).
//
// The four stuck jobs of printing#28 are still the fixture — two kitchen orders waiting 29 minutes,
// two receipts waiting 4: `attempts: 0` and an empty `lastError` are NOT an error state, they are
// the silence this screen exists to break.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

// ── The wire, as the dispatcher answers it ────────────────────────────────────────────────────

/** `hub.print.coverage` rows — `print_hosts::coverage_view`. `undrained` arrives RESOLVED. */
const COVERAGE_STUCK = [
  { role: 'kitchen', waiting: 2, liveHosts: 0, waitingSeconds: 1757, undrained: true },
  { role: 'receipt', waiting: 2, liveHosts: 0, waitingSeconds: 238, undrained: true },
];

/** A hub where everything works: one live host on the receipt station, nothing waiting. */
const COVERAGE_HEALTHY = [
  { role: 'receipt', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false },
];

/**
 * The same healthy hub as the runtime answers it since hub#1527: the count AND the names.
 *
 * `liveHostLabels` is what this whole issue is about — the owner with a till and a tablet reading
 * "2 devices" has to go and try which of the two is printing.
 */
const COVERAGE_NAMED = [
  {
    role: 'receipt',
    waiting: 0,
    liveHosts: 2,
    waitingSeconds: 0,
    undrained: false,
    liveHostLabels: ['Caja 1', 'Tablet sala'],
  },
];

/** One till covering TWO stations: the same device, named under each of them. */
const COVERAGE_ONE_DEVICE_TWO_ROLES = [
  { role: 'receipt', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false, liveHostLabels: ['Caja 1'] },
  { role: 'kitchen', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false, liveHostLabels: ['Caja 1'] },
];

/** `hub.print.jobs` rows — `print_queue::status_view`. The document never travels here. */
const JOBS_PENDING = [
  {
    jobId: 'kitchen-order-1041',
    role: 'kitchen',
    documentType: 'kitchen_order',
    format: 'receipt',
    status: 'pending',
    attempts: 0,
    createdAt: '2026-08-21T23:52:11Z',
    lastError: '',
  },
  {
    jobId: 'sale-2026-08-22-0012',
    role: 'receipt',
    documentType: 'receipt',
    format: 'receipt',
    status: 'pending',
    attempts: 0,
    createdAt: '2026-08-22T00:41:03Z',
    lastError: '',
  },
];

/** A job that DID fail: the only place `lastError` and `attempts > 0` ever appear. */
const JOBS_DEAD = [
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
];

/** A job a print host is rendering right now: neither gesture may touch it. */
const JOBS_PRINTING = [
  {
    jobId: 'sale-2026-08-22-0031',
    role: 'receipt',
    documentType: 'receipt',
    format: 'receipt',
    status: 'printing',
    attempts: 1,
    createdAt: '2026-08-22T00:50:00Z',
    lastError: '',
  },
];

const SETTINGS_ROW = {
  receipt_header: '',
  receipt_footer: '',
  paper_width: 80,
  auto_print_on_sale: 1,
  open_drawer_on_sale: 0,
  print_kitchen: 0,
};

/** A rejection shaped like the SDK's `ErploraError`: what matters is the stable `code`. */
class FakeErploraError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'ErploraError';
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────────────────────────

interface QueueDouble {
  coverage?: unknown[];
  /** Rows per `status` asked for; anything not named answers empty. */
  jobs?: Record<string, unknown[]>;
  /** Throw from every queue read (a refused read is a STATE, not an empty queue). */
  queueFails?: unknown;
  /** `hub.administer` — owner/admin only. The two gestures are not offered without it. */
  admin?: boolean;
  /** The shell's active language. Defaults to `es`; the parity tests mount BOTH. */
  locale?: 'es' | 'en';
  /**
   * The surface the screen is standing on (printing#37). `peripherals.detect()` is the only
   * signal a module has: in a plain browser the shell injects `UnavailableBridgeTransport`, which
   * always answers `{online:false}`; inside the installed app the Tauri transport answers `true`.
   */
  hardwareOnline?: boolean;
  retry?: (jobId: string) => Promise<unknown>;
  discard?: (jobId: string, reason?: string) => Promise<unknown>;
}

interface Spies {
  query: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  discard: ReturnType<typeof vi.fn>;
  forModule: ReturnType<typeof vi.fn>;
}

function stubErplora(opts: QueueDouble = {}): Spies {
  const coverage = opts.coverage ?? COVERAGE_STUCK;
  const locale = opts.locale ?? 'es';
  const retry = vi.fn(opts.retry ?? (async (jobId: string) => ({ jobId, status: 'pending' })));
  const discard = vi.fn(
    opts.discard ??
      (async (jobId: string) => ({
        jobId,
        discardedAt: '2026-08-22T01:00:00Z',
        discardedBy: 'hub_user:1',
        discardReason: '',
      })),
  );
  const query = vi.fn(async (name: string, params?: Record<string, unknown>) => {
    if (name === 'printing.settings.get') return [SETTINGS_ROW];
    if (name === 'hub.print.coverage' || name === 'hub.print.jobs') {
      if (opts.queueFails) throw opts.queueFails;
      if (name === 'hub.print.coverage') return coverage;
      // Read `opts.jobs` on EVERY call: the refusal tests hand a getter so the queue can change
      // between the paint and the re-read. Capturing it once would freeze the double on the
      // stale rows and the re-read would prove nothing.
      const jobs = opts.jobs ?? { pending: JOBS_PENDING };
      return jobs[String(params?.status ?? '')] ?? [];
    }
    throw new FakeErploraError('not_found', `unexpected query: ${name}`);
  });
  const forModule = vi.fn((_id: string) => ({ printQueue: { retry, discard } }));
  (globalThis as Record<string, unknown>).erplora = {
    query,
    command: async () => ({}),
    forModule,
    hasPermission: (perm: string) => (opts.admin ?? true) && perm === 'hub.administer',
    peripherals: {
      detect: async () => ({
        online: opts.hardwareOnline ?? false,
        version: opts.hardwareOnline ? '0.1.21' : undefined,
      }),
      discoverPrinters: async () => [],
      getDevices: async () => [],
    },
    locale,
    // Interpolates `{name}` the way the real SDK `t()` does (module-sdk index.ts) — the alarm and
    // the job rows only make sense with their facts substituted in. And it resolves against the
    // ACTIVE language, not always `es`: a double pinned to one catalog cannot tell a translated
    // screen from one with the sentence hardcoded in the source language.
    t: (
      catalog: Record<string, { ui: Record<string, string> }>,
      key: string,
      params?: Record<string, unknown>,
    ) => {
      const [, k] = key.split('.');
      let out = catalog[locale]?.ui?.[k] ?? key;
      if (params)
        for (const [name, value] of Object.entries(params))
          out = out.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      return out;
    },
  };
  return { query, retry, discard, forModule };
}

/** Flushes Lit's update cycle plus whatever microtask the data load chained. */
async function settle(el: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mount(): Promise<Mounted> {
  await import('./erp-printing-settings');
  const el = document.createElement('erp-printing-settings');
  document.body.appendChild(el);
  await settle(el as Mounted);
  return el as Mounted;
}

/** The visible action buttons of a job row, by their stable class. */
function actions(el: Mounted, jobId: string): HTMLElement[] {
  const row = Array.from(el.shadowRoot.querySelectorAll('.queue-job')).find((j) =>
    (j.textContent ?? '').includes(jobId),
  );
  return Array.from(row?.querySelectorAll<HTMLElement>('[class*="job-action"]') ?? []);
}

function action(el: Mounted, jobId: string, kind: 'retry' | 'discard'): HTMLElement | undefined {
  return actions(el, jobId).find((b) => b.classList.contains(`job-action-${kind}`));
}

async function click(el: Mounted, target: HTMLElement | undefined): Promise<void> {
  expect(target, 'the control is not on screen').toBeTruthy();
  target?.click();
  await settle(el);
}

beforeEach(() => {
  stubErplora();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  // The global is NOT deleted: a `loadQueue` still in flight when the test ends would then reject
  // with «SDK not initialized» and vitest would count it as an unhandled error. `beforeEach`
  // re-stubs it for the next test, which is what isolation needs.
});

// ── The door: the dispatcher, never a raw fetch (printing#30) ─────────────────────────────────

describe('the queue is read through the dispatcher (printing#30, ADR-0192)', () => {
  it('asks the core queries and NEVER touches fetch or the shell session in localStorage', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const getItem = vi.fn(() => 'sess-token');
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() });
    const spies = stubErplora();

    await mount();

    const asked = spies.query.mock.calls.map((c) => c[0]);
    expect(asked, 'the coverage never went through the dispatcher').toContain('hub.print.coverage');
    expect(asked, 'the queue never went through the dispatcher').toContain('hub.print.jobs');
    expect(fetchSpy, 'the screen still pulls a core route with a raw fetch').not.toHaveBeenCalled();
    expect(getItem, 'the screen still reads the shell session out of localStorage').not.toHaveBeenCalled();
  });

  it('asks for the three LIVE buckets it paints, with the hub page size', async () => {
    const spies = stubErplora();
    await mount();
    const asked = spies.query.mock.calls
      .filter((c) => c[0] === 'hub.print.jobs')
      .map((c) => c[1] as Record<string, unknown>);
    const live = asked.filter((p) => p.status !== 'discarded');
    expect(live.map((p) => p.status).sort()).toEqual(['dead', 'pending', 'printing']);
    // `done` is history, not state: a lifetime of completed tickets would push the interesting
    // rows off the page. (`discarded` is history too and IS asked for, but only for the back
    // office and on a page of its own — hub#1565, tested where that decision lives.)
    expect(asked.map((p) => p.status)).not.toContain('done');
    for (const p of live) expect(p.limit).toBe(100);
  });
});

// ── The alarm ─────────────────────────────────────────────────────────────────────────────────

describe('stuck queue: the screen says so (printing#28)', () => {
  it('paints an alarm with the count of waiting jobs, the role and the age of the oldest', async () => {
    const el = await mount();
    const alarm = el.shadowRoot.querySelector('.queue-alert');
    expect(alarm, 'no alarm row is painted for undrained coverage').toBeTruthy();
    const text = alarm?.textContent ?? '';
    expect(text).toContain('2'); // waiting
    expect(text).toMatch(/cocina/i); // the role, translated
    expect(text).toMatch(/29\s*min/); // waitingSeconds 1757 → 29 min, human
  });

  it('paints one alarm per undrained role, not one global blob', async () => {
    const el = await mount();
    const alarms = el.shadowRoot.querySelectorAll('.queue-alert');
    expect(alarms.length).toBe(2); // kitchen AND receipt, per the coverage answer
    expect(alarms[1]?.textContent ?? '').toMatch(/recibo|caja/i);
  });

  it('names the fix: no device of that role is connected', async () => {
    const el = await mount();
    expect(el.shadowRoot.textContent ?? '').toMatch(/ningún dispositivo/i);
  });

  it('never claims a job errored when it simply never got attempted', async () => {
    const el = await mount();
    const job = el.shadowRoot.querySelector('.queue-job');
    expect(job?.textContent ?? '').not.toMatch(/error/i);
  });
});

// ── Whose homework is it? (printing#37) ───────────────────────────────────────────────────────
//
// The alarm used to end in ONE sentence for everybody: «install the ERPlora app on the device that
// is connected to the printer». Most of the time this screen is read FROM INSIDE that app, on the
// counter tablet — so it asked the person to install the application they were holding. They do it,
// it is already done, and the screen keeps saying the same thing: a dead end.
//
// The criterion is COPIED from the hub, which already solved this exact problem for the setup
// steps: `printerSetupStepKeys(inInstalledApp)` in `apps/web/src/lib/system-health.ts` drops the
// «download it / install it» steps on the surface where they are already done. Here the pair is a
// sentence instead of a list, and the surface signal is the one a module is allowed to ask for:
// `erplora.peripherals.detect().online` — the same one this screen already trusts to choose
// between `printerReady` and `hardwareUnavailable` two sections below.

describe('the alarm tells the person what is left to do ON THEIR surface (printing#37)', () => {
  it('inside the installed app it does NOT ask to install the app', async () => {
    stubErplora({ hardwareOnline: true });
    const el = await mount();
    const alarm = el.shadowRoot.querySelector('.queue-alert');
    expect(alarm, 'no alarm row is painted for undrained coverage').toBeTruthy();
    expect(alarm?.textContent ?? '').toContain(esUi.queueNoDeviceInApp);
    expect(alarm?.textContent ?? '').not.toContain(esUi.queueNoDeviceInBrowser);
  });

  it('in a plain browser it DOES, because there the app is genuinely missing', async () => {
    stubErplora({ hardwareOnline: false });
    const el = await mount();
    const alarm = el.shadowRoot.querySelector('.queue-alert');
    expect(alarm?.textContent ?? '').toContain(esUi.queueNoDeviceInBrowser);
    expect(alarm?.textContent ?? '').not.toContain(esUi.queueNoDeviceInApp);
  });

  it('the in-app sentence never sends anyone to install what they are already running', () => {
    // The defect itself, pinned on the STRING: whoever re-points the in-app branch at an
    // «install the app» sentence puts printing#37 straight back on screen.
    expect(enUi.queueNoDeviceInApp).not.toMatch(/install/i);
    expect(esUi.queueNoDeviceInApp).not.toMatch(/instala/i);
    expect(enUi.queueNoDeviceInBrowser).toMatch(/install/i);
    expect(esUi.queueNoDeviceInBrowser).toMatch(/instala/i);
  });

  it('picks the key by surface, and the two are not the same sentence', async () => {
    const { queueNoDeviceKey } = await import('./erp-printing-settings');
    expect(queueNoDeviceKey(true)).toBe('ui.queueNoDeviceInApp');
    expect(queueNoDeviceKey(false)).toBe('ui.queueNoDeviceInBrowser');
    expect(esUi.queueNoDeviceInApp).not.toBe(esUi.queueNoDeviceInBrowser);
    expect(enUi.queueNoDeviceInApp).not.toBe(enUi.queueNoDeviceInBrowser);
  });

  it('the retired single key is gone from both catalogs, so no surface can fall back to it', () => {
    expect(esUi.queueNoDevice, 'ui.queueNoDevice survived the split').toBeUndefined();
    expect(enUi.queueNoDevice, 'ui.queueNoDevice survived the split').toBeUndefined();
  });
});

// ── Per-role coverage ─────────────────────────────────────────────────────────────────────────

describe('per-role coverage rows', () => {
  it('list every role the hub answers, with waiting count and live hosts', async () => {
    const el = await mount();
    const roles = Array.from(el.shadowRoot.querySelectorAll('.queue-role'));
    expect(roles.length).toBe(2);
    const kitchen = roles.find((r) => /cocina/i.test(r.textContent ?? ''));
    expect(kitchen?.textContent ?? '').toContain('2');
    expect(kitchen?.querySelector('.queue-role-status.ready')).toBeNull();
  });

  it('paints the explicit healthy state when a role has a live host and nothing waiting', async () => {
    stubErplora({ coverage: COVERAGE_HEALTHY, jobs: {} });
    const el = await mount();
    const ready = el.shadowRoot.querySelector('.queue-role-status.ready');
    expect(ready, 'the ready badge is missing for a covered role').toBeTruthy();
    // The coverage view carries a COUNT of live hosts, not their labels: the screen says how many
    // are draining the station, and never invents a name the dispatcher did not send.
    expect(el.shadowRoot.textContent ?? '').toMatch(/1/);
  });

  it('a role with no live host and nothing waiting is painted unattended, not ready', async () => {
    stubErplora({
      coverage: [{ role: 'receipt', waiting: 0, liveHosts: 0, waitingSeconds: 0, undrained: false }],
      jobs: {},
    });
    const el = await mount();
    expect(el.shadowRoot.querySelector('.queue-role-status.ready')).toBeNull();
    expect(el.shadowRoot.querySelector('.queue-role-status.unattended')).toBeTruthy();
  });
});

// ── hub#1527: the healthy state NAMES the devices, it does not count them ─────────────────────
//
// «Imprime desde: Caja 1» is what the screen said before printing#30 moved the read to the
// dispatcher; `hub.print.coverage` only carried a count, so the sentence became "2 devices". The
// count is the alarm and it is fine — the names are the state an owner opens every day.
//
// The field arrives OPTIONAL on purpose: a hub older than hub#1527 answers coverage rows without
// it, and this screen ships to whatever hub has it installed. Falling back to the count is what
// keeps the module from going blank on a hub that has not been rolled out yet.

describe('the live devices of a station are NAMED (hub#1527)', () => {
  it('lists the names the hub sends instead of how many there are', async () => {
    stubErplora({ coverage: COVERAGE_NAMED, jobs: {} });
    const el = await mount();

    const hosts = el.shadowRoot.querySelector('.queue-role .hosts');
    expect(hosts, 'the station does not say who is printing').toBeTruthy();
    expect(hosts?.textContent ?? '').toContain('Caja 1');
    expect(hosts?.textContent ?? '').toContain('Tablet sala');
  });

  it('falls back to the count when the hub is older and sends no names', async () => {
    // Not a hypothetical: the module installs into hubs the fleet has not rolled out yet.
    stubErplora({ coverage: COVERAGE_HEALTHY, jobs: {} });
    const el = await mount();

    const hosts = el.shadowRoot.querySelector('.queue-role .hosts');
    expect(hosts?.textContent ?? '', 'the old sentence is the fallback, not a blank').toContain('1');
  });

  it('an empty list of names is treated as no names, never as an empty sentence', async () => {
    // `liveHosts > 0` with `liveHostLabels: []` cannot happen in one read of a healthy hub, but a
    // row assembled by anything other than `coverage_view` could hand it over — and «Imprime
    // desde: » with nothing after the colon reads as a bug on the owner's screen.
    stubErplora({
      coverage: [{ role: 'receipt', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false, liveHostLabels: [] }],
      jobs: {},
    });
    const el = await mount();

    const hosts = el.shadowRoot.querySelector('.queue-role .hosts');
    expect(hosts?.textContent ?? '').toContain('1');
    expect(hosts?.textContent ?? '').not.toMatch(/:\s*$/);
  });

  it('counts a device that covers two stations ONCE in the all-clear line', async () => {
    // The summary adds up `liveHosts` per role, so the till that prints both the receipts and the
    // kitchen used to be announced as two connected devices. With the names in hand the honest
    // answer is how many DEVICES there are, not how many station slots they fill.
    stubErplora({ coverage: COVERAGE_ONE_DEVICE_TWO_ROLES, jobs: {} });
    const el = await mount();

    const allClear = el.shadowRoot.querySelector('p.ok');
    expect(allClear, 'the all-clear line is missing').toBeTruthy();
    expect(allClear?.textContent ?? '').toContain('1');
    expect(allClear?.textContent ?? '', 'the same till counted twice').not.toContain('2');
  });

  it('two devices that share a name are still TWO devices in the all-clear line', async () => {
    // A name is not an identity: two tills both called «Caja» fill two slots of the same station,
    // and that station's own `liveHosts` says so. Collapsing the names into a set would announce
    // ONE device where the station reports two — the count must never drop below what any single
    // station can see (rv-hub-1557's finding on printing#33).
    stubErplora({
      coverage: [
        { role: 'receipt', waiting: 0, liveHosts: 2, waitingSeconds: 0, undrained: false, liveHostLabels: ['Caja', 'Caja'] },
        { role: 'kitchen', waiting: 0, liveHosts: 1, waitingSeconds: 0, undrained: false, liveHostLabels: ['Caja'] },
      ],
      jobs: {},
    });
    const el = await mount();

    const allClear = el.shadowRoot.querySelector('p.ok');
    expect(allClear, 'the all-clear line is missing').toBeTruthy();
    expect(allClear?.textContent ?? '', 'two same-named devices collapsed into one').toContain('2');
  });
});

// ── The job list ──────────────────────────────────────────────────────────────────────────────

describe('the queue listing', () => {
  it('lists each waiting job with role, document type, status, attempts and age', async () => {
    const el = await mount();
    const jobs = Array.from(el.shadowRoot.querySelectorAll('.queue-job'));
    expect(jobs.length).toBe(2);
    const first = jobs[0]?.textContent ?? '';
    expect(first).toContain('kitchen-order-1041');
    expect(first).toMatch(/comanda de cocina/i); // documentType translated, not the raw enum
    expect(first).toMatch(/pendiente/i); // status badge
    expect(first).toMatch(/0/); // attempts
  });

  it('shows the last error and the attempts of a dead job', async () => {
    stubErplora({
      coverage: [{ role: 'label', waiting: 0, liveHosts: 0, waitingSeconds: 0, undrained: false }],
      jobs: { dead: JOBS_DEAD },
    });
    const el = await mount();
    const dead = Array.from(el.shadowRoot.querySelectorAll('.queue-job')).find((j) =>
      /label-shelf-3/.test(j.textContent ?? ''),
    );
    const text = dead?.textContent ?? '';
    expect(text).toMatch(/muert[oa]/i);
    expect(text).toContain('printer not reachable: timeout');
    expect(text).toContain('3');
  });

  it('paints the all-clear line when nothing is waiting and a host is live', async () => {
    stubErplora({ coverage: COVERAGE_HEALTHY, jobs: {} });
    const el = await mount();
    expect(el.shadowRoot.textContent ?? '').toMatch(/todo al día|al día/i);
  });

  it('an empty queue with no live host is NOT painted as healthy', async () => {
    stubErplora({ coverage: [], jobs: {} });
    const el = await mount();
    expect(el.shadowRoot.textContent ?? '').not.toMatch(/al día/i);
  });
});

// ── Getting a job out of the jam (printing#30 · hub#1108) ─────────────────────────────────────

describe('retry and discard, the two gestures that unstick the queue', () => {
  it('offers Retry AND Discard on a dead job', async () => {
    stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    expect(action(el, 'label-shelf-3', 'retry'), 'a dead job cannot be retried').toBeTruthy();
    expect(action(el, 'label-shelf-3', 'discard'), 'a dead job cannot be retired').toBeTruthy();
  });

  it('offers only Discard on a pending job — a retry would be refused by the runtime', async () => {
    const el = await mount();
    expect(action(el, 'kitchen-order-1041', 'discard')).toBeTruthy();
    expect(action(el, 'kitchen-order-1041', 'retry'), 'a pending job is already waiting').toBeUndefined();
  });

  it('offers NEITHER on a job a print host is rendering', async () => {
    stubErplora({ coverage: [], jobs: { printing: JOBS_PRINTING } });
    const el = await mount();
    expect(actions(el, 'sale-2026-08-22-0031')).toHaveLength(0);
  });

  it('retries through the module-scoped SDK door, not a hand-built path', async () => {
    const spies = stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    expect(spies.forModule).toHaveBeenCalledWith('printing');
    expect(spies.retry).toHaveBeenCalledWith('label-shelf-3');
  });

  it('re-reads the queue after a retry, so the row stops claiming it is dead', async () => {
    const spies = stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    const before = spies.query.mock.calls.filter((c) => c[0] === 'hub.print.jobs').length;
    await click(el, action(el, 'label-shelf-3', 'retry'));
    const after = spies.query.mock.calls.filter((c) => c[0] === 'hub.print.jobs').length;
    expect(after, 'the list was left stale after the retry').toBeGreaterThan(before);
  });

  it('asks before retiring a job, and sends the reason typed in', async () => {
    const spies = stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'discard'));
    expect(spies.discard, 'a job was retired without asking').not.toHaveBeenCalled();

    const reason = el.shadowRoot.querySelector<HTMLInputElement>('.job-discard-reason');
    expect(reason, 'no reason field on the confirmation').toBeTruthy();
    reason?.dispatchEvent(new CustomEvent('ionInput', { detail: { value: 'se cambió el papel' } }));
    await settle(el);
    await click(el, el.shadowRoot.querySelector<HTMLElement>('.job-discard-confirm') ?? undefined);

    expect(spies.discard).toHaveBeenCalledWith('label-shelf-3', 'se cambió el papel');
  });

  it('retires with no reason at all when none is typed — an essay is not a precondition', async () => {
    const spies = stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'discard'));
    await click(el, el.shadowRoot.querySelector<HTMLElement>('.job-discard-confirm') ?? undefined);
    expect(spies.discard).toHaveBeenCalledWith('label-shelf-3', undefined);
  });

  it('cancelling the confirmation retires nothing', async () => {
    const spies = stubErplora({ coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'discard'));
    await click(el, el.shadowRoot.querySelector<HTMLElement>('.job-discard-cancel') ?? undefined);
    expect(spies.discard).not.toHaveBeenCalled();
    expect(el.shadowRoot.querySelector('.job-discard-confirm')).toBeNull();
  });
});

// ── Who may do it ─────────────────────────────────────────────────────────────────────────────

describe('the gestures are the owner’s, and the buttons are not offered otherwise', () => {
  it('a cashier session sees the queue but is offered no button', async () => {
    stubErplora({ admin: false, coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    // Reading is any local session on purpose (hub#987): the queue is still painted.
    expect(el.shadowRoot.querySelectorAll('.queue-job').length).toBe(1);
    // `disabled` would NOT do: Ionic eats the tap and the reason only lives in `title`.
    expect(actions(el, 'label-shelf-3'), 'the gestures are offered to a non-admin').toHaveLength(0);
  });
});

// ── The refusals, by CODE (ADR-0055) ──────────────────────────────────────────────────────────

describe('every refusal is told by its code, never by the sentence it arrived with', () => {
  it('a retry the runtime refuses names the state the job is really in', async () => {
    // The row went out to a host between the paint and the tap: the runtime says `pending`.
    let jobs: Record<string, unknown[]> = { dead: JOBS_DEAD };
    const spies = stubErplora({
      coverage: [],
      get jobs() {
        return jobs;
      },
      retry: async () => {
        throw new FakeErploraError('print.job_not_requeueable');
      },
    });
    const el = await mount();
    // The re-read after the refusal is what makes the named state TRUE, not the stale row.
    jobs = { pending: [{ ...JOBS_DEAD[0], status: 'pending', attempts: 0, lastError: '' }] };
    await click(el, action(el, 'label-shelf-3', 'retry'));

    const notice = el.shadowRoot.querySelector('.job-notice')?.textContent ?? '';
    expect(notice, 'the refusal is not explained').toMatch(/pendiente/i);
    expect(spies.retry).toHaveBeenCalledTimes(1);
  });

  it('a discard the runtime refuses says a printer is working on it', async () => {
    // A host claimed the job between the paint and the tap — which is exactly why the runtime says
    // no, and why the state named has to come from the re-read and not from the stale row.
    let jobs: Record<string, unknown[]> = { dead: JOBS_DEAD };
    stubErplora({
      coverage: [],
      get jobs() {
        return jobs;
      },
      discard: async () => {
        throw new FakeErploraError('print.job_not_discardable');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'discard'));
    jobs = { printing: [{ ...JOBS_DEAD[0], status: 'printing', lastError: '' }] };
    await click(el, el.shadowRoot.querySelector<HTMLElement>('.job-discard-confirm') ?? undefined);
    const notice = el.shadowRoot.querySelector('.job-notice')?.textContent ?? '';
    expect(notice).toMatch(/imprimiendo/i);
  });

  it('a job that is no longer in this hub tells the person to look at the fresh list', async () => {
    stubErplora({
      coverage: [],
      jobs: { dead: JOBS_DEAD },
      retry: async () => {
        throw new FakeErploraError('not_found');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    expect(el.shadowRoot.querySelector('.job-notice')?.textContent ?? '').toMatch(/ya no está|actualizad/i);
  });

  it('a missing `printer` grant ASKS for the permission instead of painting «error»', async () => {
    stubErplora({
      coverage: [],
      jobs: { dead: JOBS_DEAD },
      retry: async () => {
        throw new FakeErploraError('capability_denied');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    const notice = el.shadowRoot.querySelector('.job-notice');
    expect(notice?.textContent ?? '').toMatch(/permiso/i);
    const go = notice?.querySelector<HTMLElement>('.job-notice-permissions');
    expect(go, 'no way to go and grant it').toBeTruthy();
    go?.click();
    await settle(el);
    expect(window.location.pathname + window.location.hash).toBe('/settings#permissions');
  });

  it('reads the CODE and not the sentence, even when the two disagree', async () => {
    // The fixtures above let `message` default to the code, so a screen keyed on the PROSE would
    // pass every one of them. Here the two say different things on purpose (ADR-0055: the sentence
    // is what the runtime happens to have written, in one language, and a screen never parses it).
    // Keyed on the message, this would beg for a `printer` grant nobody ever denied.
    stubErplora({
      coverage: [],
      jobs: { dead: JOBS_DEAD },
      retry: async () => {
        throw new FakeErploraError('not_found', 'capability_denied');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    const notice = el.shadowRoot.querySelector('.job-notice');
    expect(notice?.textContent ?? '', 'the refusal was resolved by its prose').toContain(esUi.errJobGone);
    expect(
      notice?.querySelector('.job-notice-permissions'),
      'it asked for a grant that was never the refusal',
    ).toBeNull();
  });

  it('an unknown refusal still says something, and never a silent no-op', async () => {
    stubErplora({
      coverage: [],
      jobs: { dead: JOBS_DEAD },
      retry: async () => {
        throw new FakeErploraError('server_unavailable');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    expect(el.shadowRoot.querySelector('.job-notice')?.textContent ?? '').not.toBe('');
  });
});

// ── Errors and refresh ────────────────────────────────────────────────────────────────────────

describe('reading failures and refresh', () => {
  it('a refused read paints an error, never a silent empty queue', async () => {
    stubErplora({ queueFails: new FakeErploraError('permission_denied') });
    const el = await mount();
    const text = el.shadowRoot.textContent ?? '';
    expect(text).toMatch(/no se pudo leer la cola/i);
    expect(text).not.toMatch(/al día/i);
    expect(el.shadowRoot.querySelectorAll('.queue-job').length).toBe(0);
  });

  it('the refresh button re-reads the queue', async () => {
    const spies = stubErplora();
    const el = await mount();
    const before = spies.query.mock.calls.length;
    await click(el, el.shadowRoot.querySelector<HTMLElement>('.queue-refresh') ?? undefined);
    expect(spies.query.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-reads by itself every 30 s while mounted, and stops when disconnected', async () => {
    // shouldAdvanceTime lets the mount's own settle run on real time while the interval is faked.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spies = stubErplora();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const el = await mount();
    const afterMount = spies.query.mock.calls.length;
    vi.advanceTimersByTime(31_000);
    expect(spies.query.mock.calls.length).toBeGreaterThan(afterMount);
    el.remove();
    const afterRemove = spies.query.mock.calls.length;
    vi.advanceTimersByTime(120_000);
    expect(spies.query.mock.calls.length).toBe(afterRemove);
  });
});

// ── i18n ──────────────────────────────────────────────────────────────────────────────────────

const esUi = (esLocale as { ui: Record<string, string> }).ui;
const enUi = (enLocale as { ui: Record<string, string> }).ui;

describe('catalog parity for the queue strings (en source of truth, ADR-0055/0199)', () => {
  it('every queue key exists in both languages', () => {
    const keys = [
      'queueTitle', 'queueRefresh', 'queueRefreshing', 'queueAllClear', 'queueAllClearNoHost',
      'queueAlertWaiting', 'queueNoDeviceInApp', 'queueNoDeviceInBrowser',
      'queueWaitingJobs', 'queueOldest', 'queueLiveHosts',
      'queueLiveHostNames',
      'statusReady', 'statusStalled', 'statusUnattended',
      'jobPending', 'jobPrinting', 'jobDead', 'jobAttempts', 'jobLastError', 'jobAge',
      'errQueueLoad', 'docKitchenOrder', 'docReceipt', 'docBarcodeLabel',
      'unitS', 'unitMin', 'unitH',
    ];
    for (const k of keys) {
      expect(esUi[k], `es is missing ui.${k}`).toBeTruthy();
      expect(enUi[k], `en is missing ui.${k}`).toBeTruthy();
    }
  });

  it('every string the two new gestures need exists in both languages', () => {
    const keys = [
      'jobRetry', 'jobDiscard', 'jobDiscardTitle', 'jobDiscardReason', 'jobDiscardConfirm',
      'jobCancel', 'jobRetried', 'jobDiscarded',
      'errJobNotRequeueable', 'errJobNotRequeueableUnknown',
      'errJobNotDiscardable', 'errJobNotDiscardableUnknown',
      'errJobGone', 'errJobCapability', 'errJobGoPermissions', 'errJobForbidden', 'errJobAction',
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

  it('the refusals that carry a state NAME it', async () => {
    for (const k of ['errJobNotRequeueable', 'errJobNotDiscardable']) {
      expect(esUi[k], `es ui.${k} does not name the state`).toMatch(/\{status\}/);
      expect(enUi[k], `en ui.${k} does not name the state`).toMatch(/\{status\}/);
    }
  });
});

// ── …and the screen actually PAINTS them (printing#32 review) ─────────────────────────────────
//
// The parity block above proves the two CATALOGS agree. It cannot prove the screen reads them: a
// sentence hardcoded in the template passes it untouched, because the file it checks is the JSON
// and not the DOM. Nor is mounting in one language enough — an English literal in the source reads
// exactly like the `en` catalog value, so `en` alone is blind to precisely the regression this
// guards (the same hole ERPlora/hub#1521 found). Mounted in BOTH, each assertion pinned to the
// active catalog and to the ABSENCE of the other language's string, a hardcoded literal has
// nowhere to hide: it survives the language it was written in and dies in the other.

describe.each([
  ['es', esUi, enUi],
  ['en', enUi, esUi],
])('the queue gestures are painted FROM the catalog (%s)', (locale, ui, other) => {
  const lang = locale as 'es' | 'en';

  it('labels the two buttons with the active language, never a literal', async () => {
    stubErplora({ locale: lang, coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    const retry = action(el, 'label-shelf-3', 'retry');
    const discard = action(el, 'label-shelf-3', 'discard');
    expect(retry?.textContent?.trim(), `the retry button is not ui.jobRetry in ${locale}`).toBe(ui.jobRetry);
    expect(discard?.textContent?.trim(), `the discard button is not ui.jobDiscard in ${locale}`).toBe(ui.jobDiscard);
    expect(retry?.textContent?.trim()).not.toBe(other.jobRetry);
    expect(discard?.textContent?.trim()).not.toBe(other.jobDiscard);
  });

  it('writes the retire confirmation in the active language', async () => {
    stubErplora({ locale: lang, coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'discard'));
    const box = el.shadowRoot.querySelector('.job-discard');
    expect(box?.textContent ?? '', `the question is not ui.jobDiscardTitle in ${locale}`).toContain(ui.jobDiscardTitle);
    expect(box?.textContent ?? '').not.toContain(other.jobDiscardTitle);
    expect(el.shadowRoot.querySelector('.job-discard-confirm')?.textContent?.trim()).toBe(ui.jobDiscardConfirm);
    expect(el.shadowRoot.querySelector('.job-discard-cancel')?.textContent?.trim()).toBe(ui.jobCancel);
    const reason = el.shadowRoot.querySelector('.job-discard-reason');
    expect(reason?.getAttribute('label'), `the reason field is not labelled in ${locale}`).toBe(ui.jobDiscardReason);
  });

  it('explains a missing grant in the SENTENCE, not only in the link next to it', async () => {
    // Asserting on the notice as a whole would pass on the link alone — `errJobGoPermissions`
    // already says «Permisos» — while the sentence stayed hardcoded. The sentence is pinned here.
    stubErplora({
      locale: lang,
      coverage: [],
      jobs: { dead: JOBS_DEAD },
      retry: async () => {
        throw new FakeErploraError('capability_denied');
      },
    });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    const notice = el.shadowRoot.querySelector('.job-notice');
    expect(notice?.textContent ?? '', `the grant notice is not ui.errJobCapability in ${locale}`).toContain(
      ui.errJobCapability,
    );
    expect(notice?.textContent ?? '').not.toContain(other.errJobCapability);
    expect(notice?.querySelector('.job-notice-permissions')?.textContent?.trim()).toBe(ui.errJobGoPermissions);
  });

  it('says what a gesture achieved in the active language', async () => {
    stubErplora({ locale: lang, coverage: [], jobs: { dead: JOBS_DEAD } });
    const el = await mount();
    await click(el, action(el, 'label-shelf-3', 'retry'));
    const notice = el.shadowRoot.querySelector('.job-notice')?.textContent ?? '';
    expect(notice, `the outcome is not ui.jobRetried in ${locale}`).toContain(ui.jobRetried);
    expect(notice).not.toContain(other.jobRetried);
  });
});

describe.each([
  ['es', esUi, enUi],
  ['en', enUi, esUi],
])('the sentence that names the printing devices comes FROM the catalog (%s)', (locale, ui, other) => {
  const lang = locale as 'es' | 'en';

  it('writes «printing from» in the active language, never a literal', async () => {
    stubErplora({ locale: lang, coverage: COVERAGE_NAMED, jobs: {} });
    const el = await mount();

    const hosts = el.shadowRoot.querySelector('.queue-role .hosts')?.textContent ?? '';
    const expected = ui.queueLiveHostNames.replace('{hosts}', 'Caja 1, Tablet sala');
    expect(hosts.trim(), `the station sentence is not ui.queueLiveHostNames in ${locale}`).toBe(expected);
    // The other language's OPENING («Imprime desde: » / «Printing from: ») must be absent: a
    // sentence hardcoded in the template would survive the language it was written in.
    expect(hosts, `the ${locale} screen is speaking the other language`).not.toContain(
      other.queueLiveHostNames.split('{hosts}')[0],
    );
  });
});

// ── The 390 px contract (CSS — happy-dom does not lay out) ────────────────────────────────────

describe('the queue section folds at 390 px (printing#28, three viewports)', () => {
  it('roles fold in an auto-fit grid, never a fixed-width row', async () => {
    const el = await mount();
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const roles = cssText.match(/\.queue-roles\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(roles).toMatch(/grid-template-columns\s*:\s*repeat\(auto-fit,\s*minmax\(/);
    expect(roles).not.toMatch(/minmax\(\s*(2[5-9]\d|[3-9]\d\d)px/); // no card wider than a phone
    expect(el).toBeTruthy();
  });

  it('job rows wrap instead of overflowing', async () => {
    await mount();
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const job = cssText.match(/\.queue-job\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(job).toMatch(/flex-wrap\s*:\s*wrap/);
    const jobId = cssText.match(/\.queue-job \.id\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(jobId + job).toMatch(/min-width\s*:\s*0|overflow-wrap|word-break/); // long ids must break
  });

  it('the action row wraps too, so two buttons never push the row off a 390 px screen', async () => {
    await mount();
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const acts = cssText.match(/\.job-actions\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(acts, '.job-actions has no rule of its own').not.toBe('');
    expect(acts).toMatch(/flex-wrap\s*:\s*wrap/);
  });
});

// ── Reading the stamp back (hub#1565) ─────────────────────────────────────────────────────────
//
// hub#1108 and hub#1532 made the hub WRITE who retired a ticket, when, why and through which
// module; nothing ever read it back. The stamp reached the person who had just made the gesture —
// it comes in the response of the discard itself — and nobody else. The question a queue actually
// raises the NEXT day («¿quién me tiró este tique?», «¿por qué salió esta comanda dos veces?») had
// no answer outside `psql`.
//
// Two decisions arrive with the fields, both taken in the issue:
//
//  - **The stamp is the back office's** (`hub.administer`), the queue's STATE is not (hub#987). So
//    the hub simply does not send the stamp to a counter session, and the retired bucket — which is
//    nothing BUT stamp — is not even asked for.
//  - **The stamp names a PERSON.** `discardedBy` is `hub_user:<id>`, the only identity a request
//    body cannot forge and one no merchant can read. `discardedByName` travels beside it and is
//    what this screen prints, falling back to the principal so a deleted employee never renders as
//    «retirado por ——».
//
// Every field is OPTIONAL on the wire on purpose: this module installs into whatever hub is
// running, and one older than the fix answers the queue without them.

/** How the hub answers the retired bucket: NEWEST FIRST (`print_queue::list` orders `seq DESC`). */
const JOBS_DISCARDED = [
  {
    jobId: 'sale-2026-08-22-0007',
    role: 'receipt',
    documentType: 'receipt',
    format: 'receipt',
    status: 'discarded',
    attempts: 0,
    createdAt: '2026-08-22T00:20:00Z',
    lastError: '',
    discardedAt: '2026-08-22T10:05:00Z',
    discardedBy: 'hub_user:u9',
    discardedByName: 'Ana',
    discardedByModule: 'printing',
    discardReason: 'duplicado del ticket 42',
  },
  {
    jobId: 'kitchen-order-0990',
    role: 'kitchen',
    documentType: 'kitchen_order',
    format: 'receipt',
    status: 'discarded',
    attempts: 0,
    createdAt: '2026-08-21T22:00:00Z',
    lastError: '',
    // A person acting through the shell names no module (hub#1532), and nobody typed a reason.
    discardedAt: '2026-08-22T09:00:00Z',
    discardedBy: 'hub_user:u3',
    discardedByName: 'Leo',
    discardedByModule: '',
    discardReason: '',
  },
];

/** A job that was DEAD and somebody put back in front of the printers: it is pending again. */
const JOBS_RETRIED_PENDING = [
  {
    jobId: 'sale-2026-08-22-0031',
    role: 'receipt',
    documentType: 'receipt',
    format: 'receipt',
    status: 'pending',
    attempts: 3,
    createdAt: '2026-08-22T00:50:00Z',
    lastError: '',
    retriedAt: '2026-08-22T10:30:00Z',
    retriedBy: 'hub_user:u9',
    retriedByName: 'Ana',
    retriedByModule: 'printing',
  },
];

/** The stamp lines of a job row, in paint order. */
function stamps(el: Mounted, jobId: string): string[] {
  const row = Array.from(el.shadowRoot.querySelectorAll('.queue-job')).find((j) =>
    (j.textContent ?? '').includes(jobId),
  );
  return Array.from(row?.querySelectorAll('.job-stamp') ?? []).map((n) =>
    (n.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** The same moment the screen writes, so the assertion does not pin a timezone or a locale. */
function moment(iso: string, locale: 'es' | 'en'): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

describe('the back office reads the stamp back (hub#1565)', () => {
  it('asks the hub for the retired bucket too, with a small page of its own', async () => {
    const spies = stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    await mount();
    const asked = spies.query.mock.calls
      .filter((c) => c[0] === 'hub.print.jobs')
      .map((c) => c[1] as Record<string, unknown>);
    const retired = asked.find((p) => p.status === 'discarded');
    expect(retired, `the retired bucket is never read: ${JSON.stringify(asked)}`).toBeTruthy();
    // History, not state: it must not be able to bury the rows that are on fire.
    expect(Number(retired?.limit)).toBeLessThan(100);
  });

  it('a cashier is not served the retired bucket at all', async () => {
    const spies = stubErplora({ admin: false, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    await mount();
    const asked = spies.query.mock.calls
      .filter((c) => c[0] === 'hub.print.jobs')
      .map((c) => (c[1] as Record<string, unknown>).status);
    expect(asked.sort()).toEqual(['dead', 'pending', 'printing']);
  });

  it('says WHO retired the ticket, from which module and why', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    const lines = stamps(el, 'sale-2026-08-22-0007').join(' | ');
    expect(lines, `no stamp painted: ${el.shadowRoot.textContent}`).toContain('Ana');
    expect(lines).toContain('printing');
    expect(lines).toContain('duplicado del ticket 42');
    expect(lines, 'the moment is what makes it an answer and not an anecdote').toContain(
      moment('2026-08-22T10:05:00Z', 'es'),
    );
  });

  it('never prints the internal id in place of the person', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    expect(stamps(el, 'sale-2026-08-22-0007').join(' | ')).not.toContain('hub_user:u9');
  });

  it('falls back to the principal when the hub could not name the person', async () => {
    const gone = [{ ...JOBS_DISCARDED[0], discardedByName: undefined, discardedBy: 'hub_user:u-gone' }];
    stubErplora({ admin: true, coverage: [], jobs: { discarded: gone } });
    const el = await mount();
    const lines = stamps(el, 'sale-2026-08-22-0007').join(' | ');
    // A poor answer beats «retirado por ——»: the audit row keeps the only identity it has.
    expect(lines).toContain('hub_user:u-gone');
  });

  it('a person acting through the shell is named WITHOUT inventing a module', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    const lines = stamps(el, 'kitchen-order-0990');
    // The WHOLE sentence, not just "does it mention Leo": the `Via` template used with an empty
    // module reads «Retirado por Leo desde  · 22/8/26» — a dangling preposition a merchant reads
    // as a bug, and one that "does not contain 'printing'" would happily let through.
    expect(lines[0]).toBe(
      esUi.jobStampDiscarded
        .replace('{who}', 'Leo')
        .replace('{when}', moment('2026-08-22T09:00:00Z', 'es')),
    );
    expect(lines, 'and no reason line when nobody typed one').toHaveLength(1);
  });

  it('keeps the order the hub sent — the LAST ticket retired is the one somebody is asking about', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    const ids = Array.from(el.shadowRoot.querySelectorAll('.queue-job'))
      .map((n) => n.textContent ?? '')
      .filter((txt) => txt.includes('-0007') || txt.includes('0990'));
    expect(ids[0]).toContain('sale-2026-08-22-0007');
  });

  it('says who put a ticket back in front of the printers', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { pending: JOBS_RETRIED_PENDING } });
    const el = await mount();
    const lines = stamps(el, 'sale-2026-08-22-0031').join(' | ');
    expect(lines).toContain('Ana');
    expect(lines).toContain(moment('2026-08-22T10:30:00Z', 'es'));
  });

  it('a hub older than this module paints no ghost stamp', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { pending: JOBS_PENDING } });
    const el = await mount();
    expect(stamps(el, 'kitchen-order-1041')).toEqual([]);
  });

  it('the retired rows carry no gesture: neither can touch a job already binned', async () => {
    stubErplora({ admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    expect(actions(el, 'sale-2026-08-22-0007')).toEqual([]);
  });
});

describe.each([
  ['es', esUi, enUi],
  ['en', enUi, esUi],
])('the stamp is painted FROM the catalog (%s)', (locale, ui, other) => {
  const lang = locale as 'es' | 'en';

  it('every stamp key exists in both languages, and names its facts', () => {
    for (const k of [
      'queueRetiredTitle',
      'jobStatusDiscarded',
      'jobStampDiscarded',
      'jobStampDiscardedVia',
      'jobStampDiscardReason',
      'jobStampRetried',
      'jobStampRetriedVia',
    ]) {
      expect(esUi[k], `es is missing ui.${k}`).toBeTruthy();
      expect(enUi[k], `en is missing ui.${k}`).toBeTruthy();
    }
    for (const k of ['jobStampDiscarded', 'jobStampRetried']) {
      expect(esUi[k]).toMatch(/\{who\}/);
      expect(esUi[k]).toMatch(/\{when\}/);
      expect(enUi[k]).toMatch(/\{who\}/);
    }
    expect(esUi.jobStampDiscardedVia).toMatch(/\{module\}/);
    expect(enUi.jobStampDiscardedVia).toMatch(/\{module\}/);
    expect(esUi.jobStampDiscardReason).toMatch(/\{reason\}/);
  });

  it('writes the stamp in the active language, never a literal', async () => {
    stubErplora({ locale: lang, admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    const lines = stamps(el, 'sale-2026-08-22-0007').join(' | ');
    const head = (tpl: string): string => tpl.split('{')[0].trim();
    expect(lines, `the ${locale} screen is not reading ui.jobStampDiscardedVia`).toContain(
      head(ui.jobStampDiscardedVia),
    );
    expect(lines, `the ${locale} screen is speaking the other language`).not.toContain(
      head(other.jobStampDiscardedVia),
    );
    expect(lines).toContain(moment('2026-08-22T10:05:00Z', lang));
  });

  it('titles the retired list in the active language', async () => {
    stubErplora({ locale: lang, admin: true, coverage: [], jobs: { discarded: JOBS_DISCARDED } });
    const el = await mount();
    const title = el.shadowRoot.querySelector('.queue-retired-title')?.textContent?.trim();
    expect(title, `the retired list has no heading in ${locale}`).toBe(ui.queueRetiredTitle);
    expect(title).not.toBe(other.queueRetiredTitle);
  });
});
