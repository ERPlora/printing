import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import type { BridgePrinter, BridgeDevice, BridgeTransport } from '@erplora/module-sdk';
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

// Web Component del módulo 'printing': ajustes de impresión (BD) + impresoras alcanzables desde
// ESTE dispositivo. TODO pasa por el cliente del Hub (globalThis.erplora): datos por
// .query/.command y hardware por .peripherals. El módulo NUNCA habla con el hardware directo.
//
// ADR-0196 §3: el Bridge standalone y su canal WS a localhost ya NO existen. Quien tiene el
// hardware es la app instalada (`erplora-app`); en un navegador a secas `detect()` contesta
// `{online:false}` y toda operación de periférico rechaza con `hardware_unavailable`. Por eso el
// aviso de este panel manda a instalar LA APP, no a arrancar nada. ARQUITECTURA.md §2.7.

/**
 * The two gestures that get a stuck job out of the jam (hub#1108), as the SDK hands them over:
 * `erplora.forModule('printing').printQueue`. NOT `erplora.print(req)` — that is the published call
 * every module uses to ENQUEUE a document.
 */
interface PrintQueueApiLike {
  retry(jobId: string): Promise<unknown>;
  discard(jobId: string, reason?: string): Promise<unknown>;
}

interface ErploraClientLike {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  /** This client acting FOR this module — the only way to reach the print recovery gestures. */
  forModule(moduleId: string): { printQueue: PrintQueueApiLike };
  /** UI gating ONLY: the runtime re-checks every call and refuses on its own. */
  hasPermission(perm: string): boolean;
  peripherals: BridgeTransport;
  /** i18n del módulo (ADR-0055): idioma activo + traducción del catálogo `ui`. */
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

interface PrintingSettings {
  receipt_header: string;
  receipt_footer: string;
  paper_width: number;
  auto_print_on_sale: number;
  open_drawer_on_sale: number;
  /**
   * Legacy column, kept only so `printing.settings.update` keeps validating: since ADR-0144 the
   * kitchen ticket fires from the order (routed by `kitchen`'s stations) and nobody reads this
   * flag, so it has no control on screen (printing#17). Round-tripped as stored.
   */
  print_kitchen: number;
}

const DEFAULTS: PrintingSettings = {
  receipt_header: '',
  receipt_footer: '',
  paper_width: 80,
  auto_print_on_sale: 1,
  open_drawer_on_sale: 0,
  print_kitchen: 0,
};

const ROLES = ['receipt', 'kitchen', 'bar', 'label'];

// ── The hub's print queue, through the DISPATCHER (printing#28/#30, hub#1107/#1108) ────────────
//
// This screen used to pull `GET /api/print/hosts` / `GET /api/print/jobs` with a raw `fetch`,
// carrying the shell's session out of `localStorage` (`erplora.hub_session`) — because when
// printing#28 shipped the SDK had no door for those routes. It worked only while the session stayed
// in `localStorage`, and it broke the WC → SDK → dispatcher contract (ADR-0192): the day the shell
// moves the session to an `httpOnly` cookie, the merchant loses sight of the queue exactly when the
// paper stops coming out.
//
// hub#1107 landed the doors, so the read is a query like any other. The runtime serves both the
// HTTP route and the core query from ONE definition (`print_hosts::coverage_view`,
// `print_queue::status_view`), so the shapes below are unchanged — `undrained` and `waitingSeconds`
// still arrive RESOLVED by the runtime and are never re-derived here.
//
// The gate is `hub.users.view`, which any local session carries (hub#987: whoever is standing next
// to the printer). The two RECOVERY gestures are the opposite — admin + the `printer` capability —
// and travel through {@link PrintQueueApiLike}.

/** The module this screen belongs to: what `forModule` names to reach the recovery gestures. */
const MODULE_ID = 'printing';

/** Administering the hub (`hub_users::ADMINISTER_PERMISSION`): who may move a job in the queue. */
const ADMINISTER_PERMISSION = 'hub.administer';

/** Where the owner grants a module's declared capabilities — `printer`, in our case. */
const PERMISSIONS_ROUTE = '/settings#permissions';

/** How often the screen re-reads the queue on its own: often enough to matter, rarely enough to idle. */
const QUEUE_REFRESH_MS = 30_000;

/** Page size per status bucket; the hub clamps to 500 and defaults to 100. */
const QUEUE_LIMIT = 100;

/** The buckets the screen paints, worst-last so `pending` is read first. `done` is history. */
const QUEUE_STATUSES = ['pending', 'printing', 'dead'] as const;

/**
 * The bucket of tickets somebody retired — read ONLY by whoever administers the hub (hub#1565).
 *
 * It is history and not state, so it is asked for separately, painted under its own heading and
 * capped far below {@link QUEUE_LIMIT}: a year of retired tickets must not push the rows that are
 * on fire off the screen. `done` stays unasked for exactly the same reason and has no such
 * question behind it.
 */
const RETIRED_STATUS = 'discarded';

/** Page size of the retired bucket: enough to answer «who binned my ticket?», never a ledger. */
const RETIRED_LIMIT = 20;

/** Per-role coverage as the runtime computes and RESOLVES it: `undrained` arrives decided. */
interface CoverageWire {
  role: string;
  waiting: number;
  liveHosts: number;
  waitingSeconds: number;
  undrained: boolean;
  /**
   * The NAME of every device counted in `liveHosts` (hub#1527) — «Imprime desde: Caja 1».
   *
   * Optional because it is younger than the query: a hub the fleet has not rolled out yet answers
   * coverage rows without it, and this module installs into whatever hub is running. Absent, the
   * screen falls back to the count it has always shown; it never invents a name.
   */
  liveHostLabels?: string[];
}

/** A queued job as `hub.print.jobs` summarizes it — everything except the document. */
interface QueueJobWire {
  jobId: string;
  role: string;
  documentType: string;
  format: string;
  status: string;
  attempts: number;
  createdAt: string;
  lastError: string | null;
  /**
   * **The stamp** a person left on this job (hub#1108/#1532, readable since hub#1565).
   *
   * Every field is optional twice over, and both reasons matter:
   *
   *  - The hub only sends the block when the gesture actually HAPPENED — a job waiting its turn
   *    carries none of it, and answering `discardedBy: ''` on it would have this screen render
   *    "retired by —" on a perfectly healthy ticket.
   *  - The stamp is the BACK OFFICE's (hub#1565): a counter session is served the same queue
   *    without it. Not a refusal — the state of the queue stays open to whoever is standing next
   *    to the printer (hub#987) — just a smaller answer.
   *
   * And a hub older than this module answers without them either way: a module installs into
   * whatever runtime is running.
   *
   * `discardedByName` is the person; `discardedBy` is the `hub_user:<id>` the door resolved from
   * the session and the only identity a request body cannot forge. The screen prints the name and
   * falls back to the id — never to an empty label.
   */
  discardedAt?: string;
  discardedBy?: string;
  discardedByName?: string;
  discardedByModule?: string;
  discardReason?: string;
  retriedAt?: string;
  retriedBy?: string;
  retriedByName?: string;
  retriedByModule?: string;
}

/** The job states each recovery gesture applies to, mirrored from `print_queue` (hub#1108). */
const RETRYABLE_STATUS = 'dead';
const DISCARDABLE_STATUSES = ['pending', 'dead'];

/**
 * What the screen owes the person after a gesture — the outcome, or the refusal BY ITS CODE.
 *
 * The code is the contract (ADR-0055); the sentence that arrived with it is prose the runtime
 * writes in one language and is never what a screen reads.
 */
interface JobNotice {
  jobId: string;
  kind: 'retried' | 'discarded' | 'refused';
  code?: string;
}

/** The stable refusal codes this screen knows how to explain (`crates/server/src/print.rs`). */
const NOT_REQUEUEABLE = 'print.job_not_requeueable';
const NOT_DISCARDABLE = 'print.job_not_discardable';
const NOT_FOUND = 'not_found';
const CAPABILITY_DENIED = 'capability_denied';
const FORBIDDEN = 'forbidden';

/** The `code` of an `ErploraError`, or `''` for anything that did not travel with one. */
function codeOf(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}

/** The three states of a role, worst first. Mirrors the hub's own coverage screen (`hub#800`). */
type RoleStatus = 'stalled' | 'unattended' | 'ready';

function classifyCoverage(c: CoverageWire): RoleStatus {
  if (c.liveHosts > 0) return 'ready';
  return c.waiting > 0 ? 'stalled' : 'unattended';
}

/**
 * The sentence that closes the stuck-queue alarm, for the surface the person is standing on
 * (printing#37).
 *
 * There used to be one sentence for everybody and it said «install the ERPlora app on the device
 * that is connected to the printer». Most of the time this screen is read FROM INSIDE that app, on
 * the counter tablet — so it asked the person to install the application they were already using.
 * A step that is already done is a dead end: they do it, nothing changes, and the screen repeats
 * itself.
 *
 * Criterion COPIED from the hub, which solved this for the setup steps:
 * `printerSetupStepKeys(inInstalledApp)` (`apps/web/src/lib/system-health.ts`) drops «download»
 * and «install» on the surface where they are already behind the user. Here the pair is a sentence
 * instead of a list, but the rule is the same one.
 *
 * The surface signal is `erplora.peripherals.detect().online` — the only one a module is given
 * (`contracts/kernel/sdk.d.ts` has no `isTauri`), and the one this screen already trusts to choose
 * between `printerReady` and `hardwareUnavailable`: a plain browser gets the shell's
 * `UnavailableBridgeTransport`, which always answers `{online:false}`. When in doubt it falls to
 * the browser sentence, which is the one that was always shown.
 */
export function queueNoDeviceKey(inInstalledApp: boolean): string {
  return inInstalledApp ? 'ui.queueNoDeviceInApp' : 'ui.queueNoDeviceInBrowser';
}

/** Seconds → `{value, unit}` for i18n: 1757 → 29 min, 4500 → 1 h. Never re-derives “stuck”. */
export function formatWait(seconds: number): { value: number; unit: string } {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return { value: s, unit: 'ui.unitS' };
  if (s < 3600) return { value: Math.floor(s / 60), unit: 'ui.unitMin' };
  return { value: Math.floor(s / 3600), unit: 'ui.unitH' };
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpPrintingSettings extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    h2 { margin:0 0 .25rem; font-size:1.15rem; }
    h3 { margin:1.25rem 0 .5rem; font-size:1rem; }
    section { margin-bottom:1rem; }
    .field { display:flex; flex-direction:column; gap:.25rem; margin-bottom:.6rem; max-width:520px; }
    .row { display:flex; align-items:center; gap:.5rem; justify-content:space-between; max-width:520px; margin-bottom:.6rem; }
    .printer { display:flex; align-items:center; gap:.6rem; padding:.6rem .75rem; border:1px solid #0001; border-radius:.5rem; margin-bottom:.5rem; flex-wrap:wrap; }
    .printer .id { font-family:ui-monospace, monospace; font-size:.8rem; opacity:.7; }
    .grow { flex:1; min-width:160px; }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; }
    .muted { opacity:.65; font-size:.85rem; }
    .badge { font-size:.7rem; padding:.1rem .45rem; border-radius:999px; background:#0001; }
    /* printing#28 — the queue. Cards, not a table: at 390 px a table is the failure mode of
       sales#126, and this data is one-line-per-job anyway. The roles fold by themselves
       (auto-fit + minmax capped at 230 px, narrower than any phone viewport) and every row wraps
       and breaks long job ids instead of overflowing the outlet. */
    .queue-alert { border:1px solid #e8590c66; border-left:4px solid #e8590c; background:#fff4e6; color:#a6410c; padding:.6rem .75rem; border-radius:.5rem; margin-bottom:.5rem; min-width:0; overflow-wrap:anywhere; }
    .queue-roles { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:.5rem; margin:.5rem 0 .75rem; }
    .queue-role { border:1px solid #0001; border-radius:.5rem; padding:.6rem .75rem; min-width:0; }
    .queue-role-status { display:inline-block; font-size:.7rem; padding:.1rem .45rem; border-radius:999px; margin-bottom:.35rem; }
    .queue-role-status.ready { background:#d3f9d8; color:#2b8a3e; }
    .queue-role-status.stalled { background:#ffe3e3; color:#c92a2a; }
    .queue-role-status.unattended { background:#fff3bf; color:#a68100; }
    .queue-role .hosts { font-size:.85rem; opacity:.75; }
    .queue-job { display:flex; align-items:flex-start; gap:.6rem; padding:.6rem .75rem; border:1px solid #0001; border-radius:.5rem; margin-bottom:.5rem; flex-wrap:wrap; min-width:0; overflow-wrap:anywhere; }
    .queue-job .id { font-family:ui-monospace, monospace; font-size:.8rem; opacity:.7; }
    .queue-job .meta { font-size:.8rem; opacity:.75; white-space:nowrap; }
    .queue-job .badge.st-dead { background:#ffe3e3; color:#c92a2a; }
    .queue-job .badge.st-discarded { background:#0001; color:#495057; }
    /* The stamp is an audit line, not the headline: readable, secondary, and it wraps like the
       rest of the row (a reason somebody typed can be long and a 390 px screen is the floor). */
    .queue-job .job-stamp { font-size:.8rem; opacity:.75; margin-top:.15rem; overflow-wrap:anywhere; }
    .queue-job.retired { opacity:.85; }
    .queue-retired-title { margin:1rem 0 .5rem; font-size:.9rem; opacity:.75; font-weight:600; }
    .queue-job .badge.st-printing { background:#d0ebff; color:#1971c2; }
    /* printing#30 — the two recovery gestures. The row already wraps; the action group wraps too
       and takes the full width so that at 390 px the buttons drop under the job instead of
       squeezing the id off the card. The retire confirmation reuses the same box. */
    .job-actions { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; width:100%; margin-top:.4rem; min-width:0; }
    .job-actions.job-discard { border-top:1px dashed #0002; padding-top:.5rem; }
    .job-actions .job-discard-reason { min-width:180px; }
    .job-notice { margin:.25rem 0 .5rem; display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; min-width:0; overflow-wrap:anywhere; }
  `;

  @state() private settings: PrintingSettings = { ...DEFAULTS };
  @state() private saving = false;
  @state() private saved = false;
  @state() private error = '';

  @state() private hardwareOnline = false;
  @state() private appVersion = '';
  @state() private scanning = false;
  @state() private printers: BridgePrinter[] = [];
  @state() private devices: BridgeDevice[] = [];
  @state() private hardwareError = '';

  // printing#28: the hub's queue — coverage per role and the stuck jobs.
  @state() private coverage: CoverageWire[] = [];
  @state() private queue: QueueJobWire[] = [];
  /** The retired bucket, kept apart: it is history, and only the back office is served it. */
  @state() private retired: QueueJobWire[] = [];
  @state() private queueLoading = false;
  @state() private queueError = '';
  @state() private queueLoaded = false;
  private queueTimerId: number | undefined;

  // printing#30 · hub#1108: getting ONE job out of the jam.
  /** The job whose retire confirmation is open — `''` when none is. */
  @state() private discardingId = '';
  @state() private discardReason = '';
  /** The job a gesture is in flight for, so its buttons cannot be tapped twice. */
  @state() private jobBusyId = '';
  @state() private jobNotice: JobNotice | null = null;

  /** Hardware vía el cliente del Hub (nunca un cliente de periféricos propio). */
  private get peripherals(): BridgeTransport {
    return erplora().peripherals;
  }

  async firstUpdated(): Promise<void> {
    void this.loadQueue();
    this.startQueueTimer();
    await this.loadSettings();
    await this.refreshHardware();
  }

  // ── Cola del hub (printing#28) ─────────────────────────────────────────────────────────────

  /**
   * One read = the per-role coverage plus the three buckets the screen shows, all of them core
   * queries through the dispatcher (hub#1107). `done` is deliberately NOT asked for: it is history,
   * not state, and the hub lists in arrival order — with a lifetime of completed tickets the
   * interesting rows would never make it into the page.
   */
  private async loadQueue(): Promise<void> {
    this.queueLoading = true;
    try {
      // The retired bucket is asked for ONLY by the audience that is served its stamp (hub#1565).
      // Asking for it as a cashier would spend a round trip on rows the hub answers stripped of the
      // only thing that makes them worth reading.
      const retiring = this.canManageQueue;
      const [coverage, ...buckets] = await Promise.all([
        // Both names are written as LITERALS on purpose: ADR-0127 extracts the module's
        // interoperability contract from the call site, and a constant hides the dependency.
        // `hub.print.coverage` = per-role coverage; `hub.print.jobs` = the queue as a STATUS
        // view (the document itself never travels through this door).
        erplora().query<CoverageWire[]>('hub.print.coverage'),
        ...QUEUE_STATUSES.map((status) =>
          erplora().query<QueueJobWire[]>('hub.print.jobs', { status, limit: QUEUE_LIMIT }),
        ),
        ...(retiring
          ? [
              erplora().query<QueueJobWire[]>('hub.print.jobs', {
                status: RETIRED_STATUS,
                limit: RETIRED_LIMIT,
              }),
            ]
          : []),
      ]);
      const oldest = (a: QueueJobWire, b: QueueJobWire): number =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt);
      const rows = (v: unknown): QueueJobWire[] => (Array.isArray(v) ? (v as QueueJobWire[]) : []);
      this.coverage = Array.isArray(coverage) ? coverage : [];
      // Worst first for the eye: what is waiting (oldest at top), what is out, what died.
      this.queue = buckets
        .slice(0, QUEUE_STATUSES.length)
        .flatMap((bucket) => [...rows(bucket)].sort(oldest));
      // 🔴 NOT sorted. The hub reads a closed bucket `seq DESC` on purpose (hub#1565): the ticket
      // somebody is asking about is always one of the LAST retired, and `sort(oldest)` here would
      // turn the page it hands back into the twenty oldest of the whole page — the exact opposite.
      this.retired = retiring ? rows(buckets[QUEUE_STATUSES.length]) : [];
      this.queueError = '';
      this.queueLoaded = true;
    } catch (e) {
      // A refused read is a STATE, not an empty queue: painting "all clear" here would be the lie
      // this screen exists to stop. The CODE is appended (never the runtime's prose) so a support
      // call has something stable to name.
      const code = codeOf(e);
      this.retired = [];
      this.queueError = `${erplora().t(CATALOG, 'ui.errQueueLoad')}${code ? ` (${code})` : ''}`;
    } finally {
      this.queueLoading = false;
    }
  }

  // ── Getting ONE job out of the jam (printing#30 · hub#1108) ────────────────────────────────

  /**
   * Whether to OFFER the two gestures at all. UI only — the runtime re-checks the admin session and
   * the `printer` capability on every call and refuses on its own.
   *
   * Not offered is not the same as `disabled`: an Ionic control that is disabled eats the tap and
   * leaves the reason in a `title` nobody on a touch screen will ever see.
   */
  private get canManageQueue(): boolean {
    return erplora().hasPermission(ADMINISTER_PERMISSION);
  }

  private get printQueueApi(): PrintQueueApiLike {
    return erplora().forModule(MODULE_ID).printQueue;
  }

  /** Runs one recovery gesture and ALWAYS re-reads the queue, so what is painted next is the truth. */
  private async runJobGesture(
    jobId: string,
    kind: 'retried' | 'discarded',
    gesture: () => Promise<unknown>,
  ): Promise<void> {
    this.jobBusyId = jobId;
    this.jobNotice = null;
    try {
      await gesture();
      this.jobNotice = { jobId, kind };
    } catch (e) {
      this.jobNotice = { jobId, kind: 'refused', code: codeOf(e) };
    } finally {
      this.jobBusyId = '';
      // Also on refusal, and that is the point: `job_not_requeueable` means the row on screen was
      // stale, so the state the message names has to come from a FRESH read, never from that row.
      await this.loadQueue();
    }
  }

  private retryJob(jobId: string): Promise<void> {
    return this.runJobGesture(jobId, 'retried', () => this.printQueueApi.retry(jobId));
  }

  private confirmDiscard(jobId: string): Promise<void> {
    // An empty reason travels as NO reason at all: demanding an essay to close a row is how a
    // recovery queue stops being drained.
    const reason = this.discardReason.trim() || undefined;
    this.discardingId = '';
    this.discardReason = '';
    return this.runJobGesture(jobId, 'discarded', () => this.printQueueApi.discard(jobId, reason));
  }

  private openDiscard(jobId: string): void {
    this.discardingId = jobId;
    this.discardReason = '';
    this.jobNotice = null;
  }

  private cancelDiscard(): void {
    this.discardingId = '';
    this.discardReason = '';
  }

  /** Same in-shell navigation the other modules use: push the route and let the router pick it up. */
  private go(path: string): void {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  /** Self-refresh, paused while the tab is hidden — a background tab polling every 30 s is noise. */
  private startQueueTimer(): void {
    this.queueTimerId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.loadQueue();
    }, QUEUE_REFRESH_MS);
  }

  private async loadSettings(): Promise<void> {
    try {
      const rows = await erplora().query<PrintingSettings[]>('printing.settings.get');
      if (Array.isArray(rows) && rows[0]) this.settings = { ...DEFAULTS, ...rows[0] };
    } catch (e) {
      this.error = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errLoadSettings');
    }
  }

  private async saveSettings(): Promise<void> {
    this.saving = true;
    this.saved = false;
    this.error = '';
    try {
      await erplora().command('printing.settings.update', { ...this.settings });
      this.saved = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errSaveSettings');
    } finally {
      this.saving = false;
    }
  }

  private async refreshHardware(): Promise<void> {
    this.hardwareError = '';
    const status = await this.peripherals.detect();
    this.hardwareOnline = status.online;
    this.appVersion = status.version ?? '';
    if (status.online) await this.scan();
  }

  private async scan(): Promise<void> {
    this.scanning = true;
    this.hardwareError = '';
    try {
      this.printers = await this.peripherals.discoverPrinters();
      this.devices = await this.peripherals.getDevices();
    } catch (e) {
      this.hardwareError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errScan');
    } finally {
      this.scanning = false;
    }
  }

  /**
   * Clave estable de la impresora en el registro de periféricos: su MAC si el sistema la resolvió por
   * ARP y, si no, su propio `id` (`network:{ip}:{port}`).
   *
   * Antes esto exigía MAC y abortaba sin ella, así que en Android —donde ARP **nunca** resuelve—
   * no se podía asignar ninguna impresora a cocina/barra/caja.
   */
  private deviceKeyOf(printer: BridgePrinter): string {
    return printer.mac ?? printer.id;
  }

  private async assignRole(printer: BridgePrinter, role: string): Promise<void> {
    // Aviso, no bloqueo: el descubrimiento solo puede afirmar "es de oficina" cuando la impresora
    // anuncia IPP, así que una A4 que no lo anuncie llegaría igual aquí. Bloquear daría una falsa
    // sensación de garantía; avisar informa sin impedir el caso raro legítimo.
    this.hardwareError =
      printer.category === 'a4' ? erplora().t(CATALOG, 'ui.warnA4Printer') : '';
    try {
      this.devices = await this.peripherals.setDeviceRole(this.deviceKeyOf(printer), role);
    } catch (e) {
      this.hardwareError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errAssignRole');
    }
  }

  /**
   * The envelope the test sheet is printed with (hub#1803).
   *
   * It is the SAME envelope every other document carries, with the two fields the renderer knows
   * how to read: `locale` — the language the paper comes out in (`Locale::from_document`,
   * hub#1159) — and `business_name` — the header, as on the ticket. Without it the sheet is
   * rendered from the printer id alone and comes out in English signed with the product's name,
   * which is what was happening: the ticket printed beside it came out in Spanish under the
   * shop's own name.
   *
   * The name is the FIRST LINE of `receipt_header` — the contract that field already has for the
   * ticket: first line the name, the rest the address — and it is the sign the shopkeeper typed on
   * this very screen, never a constant. Empty, the field is left out: the renderer falls back to
   * the product's name, which is today's sheet.
   */
  private testPageEnvelope(): Record<string, unknown> {
    const businessName = (this.settings.receipt_header ?? '').split('\n')[0].trim();
    return {
      locale: erplora().locale,
      ...(businessName ? { business_name: businessName } : {}),
    };
  }

  private async test(printer: BridgePrinter): Promise<void> {
    this.hardwareError = '';
    try {
      await this.peripherals.testPrint(printer.id, this.testPageEnvelope());
    } catch (e) {
      this.hardwareError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errTestPrint');
    }
  }

  private roleOf(printer: BridgePrinter): string {
    // Se casa por `key` (siempre presente en el host Rust), no por MAC: `key` cae al
    // `printer_id` cuando no hay ARP, que es el caso permanente en Android.
    // El `?? x.mac` es el puente para el host Kotlin, que aún no emite `key`; se puede quitar
    // cuando ese host se retire.
    const key = this.deviceKeyOf(printer);
    const d = this.devices.find((x) => (x.key ?? x.mac) === key);
    return d?.role ?? '';
  }

  // Etiqueta i18n para un rol/estación lógica (el `value=` enviado al host sigue siendo el enum).
  private roleLabel(role: string): string {
    const keys: Record<string, string> = {
      receipt: 'ui.roleReceipt',
      kitchen: 'ui.roleKitchen',
      bar: 'ui.roleBar',
      label: 'ui.roleLabel',
    };
    return keys[role] ? erplora().t(CATALOG, keys[role]) : role;
  }

  // Etiqueta i18n de un tipo de documento del vocabulario de la cola (`print_queue::DOCUMENT_TYPES`).
  // Fuera del vocabulario (un hub más nuevo que este módulo) se muestra el enum crudo, no un fallo.
  private docLabel(documentType: string): string {
    const keys: Record<string, string> = {
      kitchen_order: 'ui.docKitchenOrder',
      receipt: 'ui.docReceipt',
      invoice: 'ui.docInvoice',
      delivery_note: 'ui.docDeliveryNote',
      barcode_label: 'ui.docBarcodeLabel',
      cash_session_report: 'ui.docCashSessionReport',
      prebill: 'ui.docPrebill',
      generic: 'ui.docGeneric',
    };
    return keys[documentType] ? erplora().t(CATALOG, keys[documentType]) : documentType;
  }

  /** `{value} {unit}` ya traducido: «29 min», «45 s», «1 h». */
  private waitText(seconds: number, t: (k: string, p?: Record<string, unknown>) => string): string {
    const w = formatWait(seconds);
    return `${w.value} ${t(w.unit)}`;
  }

  /** Badge y frase de estado de un rol — la misma clasificación que la pantalla del hub (hub#800). */
  private roleStatusKey(status: RoleStatus): string {
    return { ready: 'ui.statusReady', stalled: 'ui.statusStalled', unattended: 'ui.statusUnattended' }[status];
  }

  private jobStatusKey(status: string): string {
    const keys: Record<string, string> = {
      pending: 'ui.jobPending',
      printing: 'ui.jobPrinting',
      dead: 'ui.jobDead',
      [RETIRED_STATUS]: 'ui.jobStatusDiscarded',
    };
    return keys[status] ?? status;
  }

  /** The job status in the person's words, or the raw enum for a state this module has no name for. */
  private jobStatusLabel(status: string): string {
    const key = this.jobStatusKey(status);
    return key === status ? status : erplora().t(CATALOG, key);
  }

  /**
   * The state of a PRINTER, keyed — `crates/peripherals/src/usb.rs` answers one of these three.
   *
   * Separate from `roleStatusKey()` on purpose: that one names how a ROLE is covered, this one
   * names a device, and Spanish does not even agree on the gender («el rol está Listo» vs «la
   * impresora está Lista»). One vocabulary borrowed for two meanings drifts the moment either
   * side gains a state.
   */
  private printerStatusKey(status: string): string {
    const keys: Record<string, string> = {
      ready: 'ui.printerStatusReady',
      stopped: 'ui.printerStatusStopped',
      unknown: 'ui.printerStatusUnknown',
    };
    return keys[status] ?? status;
  }

  /**
   * The printer state in the person's words, or the raw word for a state this module cannot name.
   *
   * The fallback is the point: this module installs into whatever hub is running, and a hub newer
   * than it can answer a fourth word. Blanking the badge would hide exactly what the person at the
   * counter reads to choose a printer — the raw word at least says something.
   */
  private printerStatusLabel(status: string): string {
    const key = this.printerStatusKey(status);
    return key === status ? status : erplora().t(CATALOG, key);
  }

  /**
   * What to say after a gesture — resolved by CODE, never by the sentence the runtime sent
   * (ADR-0055).
   *
   * The two `409`s carry the state the job is really in, and the SDK's `ErploraError` does not
   * surface that field — so the state is read from the queue as it stands AFTER the re-read the
   * gesture always does. That is the authoritative answer: the refusal happened precisely because
   * the row on screen was stale. When the job is no longer in any bucket we have nothing to name and
   * say so, rather than naming a state we would be guessing.
   */
  private noticeSpeech(notice: JobNotice): { key: string; params?: Record<string, unknown> } {
    if (notice.kind === 'retried') return { key: 'ui.jobRetried' };
    if (notice.kind === 'discarded') return { key: 'ui.jobDiscarded' };
    const fresh = this.queue.find((j) => j.jobId === notice.jobId)?.status;
    const named = (key: string, fallback: string): { key: string; params?: Record<string, unknown> } =>
      fresh ? { key, params: { status: this.jobStatusLabel(fresh) } } : { key: fallback };
    switch (notice.code) {
      case NOT_REQUEUEABLE:
        return named('ui.errJobNotRequeueable', 'ui.errJobNotRequeueableUnknown');
      case NOT_DISCARDABLE:
        return named('ui.errJobNotDiscardable', 'ui.errJobNotDiscardableUnknown');
      case NOT_FOUND:
        return { key: 'ui.errJobGone' };
      case CAPABILITY_DENIED:
        return { key: 'ui.errJobCapability' };
      case FORBIDDEN:
        return { key: 'ui.errJobForbidden' };
      default:
        return { key: 'ui.errJobAction' };
    }
  }

  // Re-render al cambiar el idioma del shell (ADR-0055): el template se re-evalúa con el nuevo
  // `erplora.locale`.
  private readonly onLocaleChange = (): void => this.requestUpdate();
  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
  }
  disconnectedCallback(): void {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    window.clearInterval(this.queueTimerId);
    this.queueTimerId = undefined;
    super.disconnectedCallback();
  }

  private set<K extends keyof PrintingSettings>(key: K, value: PrintingSettings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.saved = false;
  }

  /**
   * How many DEVICES are draining this hub right now, across every station.
   *
   * Counted by name and not by adding up `liveHosts` (hub#1527): the coverage rows are per
   * station, so the till that prints both the receipts and the kitchen appears in two of them and
   * the sum announced it as two connected devices. The names are what tell the two cases apart.
   *
   * A name is not an identity, though: two tills both called «Caja» in the receipt station ARE
   * two devices there, and its own `liveHosts` says so. So each name counts as the most slots it
   * fills in any ONE station — the fewest devices that every station's own count still allows,
   * never fewer than a station can see on its own.
   *
   * A hub older than hub#1527 sends no names, and there the sum is still the only answer there
   * is — the old behaviour, on the hubs that had it, rather than a zero.
   */
  private get liveHostCount(): number {
    const perName = new Map<string, number>();
    let unnamed = 0;
    for (const c of this.coverage) {
      const labels = c.liveHostLabels ?? [];
      if (!labels.length) {
        unnamed += c.liveHosts;
        continue;
      }
      const here = new Map<string, number>();
      for (const name of labels) here.set(name, (here.get(name) ?? 0) + 1);
      for (const [name, n] of here) perName.set(name, Math.max(perName.get(name) ?? 0, n));
    }
    let named = 0;
    for (const n of perName.values()) named += n;
    return named + unnamed;
  }

  /**
   * Who is printing this station's work: their names when the hub sends them, how many when it
   * does not (hub#1527).
   *
   * The count answers the alarm ("nobody is taking the kitchen's tickets"); the names answer the
   * healthy state, which is the one an owner opens every day — with a till and a tablet, "2
   * devices" leaves them to go and try which of the two is doing it.
   *
   * An EMPTY list falls back to the count rather than painting «Imprime desde: » with nothing
   * after the colon, which would read as a bug on the owner's screen.
   */
  private liveHostsText(
    c: CoverageWire,
    t: (k: string, p?: Record<string, unknown>) => string,
  ): string {
    const names = c.liveHostLabels ?? [];
    return names.length
      ? t('ui.queueLiveHostNames', { hosts: names.join(', ') })
      : t('ui.queueLiveHosts', { n: c.liveHosts });
  }

  /** The outcome of the last gesture, or the refusal explained by its code. */
  private renderJobNotice(t: (k: string, p?: Record<string, unknown>) => string) {
    const notice = this.jobNotice;
    if (!notice) return nothing;
    const { key, params } = this.noticeSpeech(notice);
    const refused = notice.kind === 'refused';
    return html`
      <p data-testid="printing-queue-notice" class="job-notice ${refused ? 'err' : 'ok'}">
        ${t(key, params)}
        ${notice.code === CAPABILITY_DENIED
          ? html`<ion-button data-testid="printing-queue-notice-permissions" class="job-notice-permissions" size="small" fill="outline"
              @click=${() => this.go(PERMISSIONS_ROUTE)}>${t('ui.errJobGoPermissions')}</ion-button>`
          : nothing}
      </p>
    `;
  }

  /**
   * The moment a gesture happened, in the person's own locale — or `''` for anything that is not
   * a date. «Invalid Date» painted on an audit line is worse than no line at all.
   */
  private momentText(iso?: string): string {
    if (!iso) return '';
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
      ? ''
      : at.toLocaleString(erplora().locale, { dateStyle: 'short', timeStyle: 'short' });
  }

  /** Who a stamp names: the person, falling back to the principal, never to an empty label. */
  private actor(name?: string, principal?: string): string {
    return (name ?? '').trim() || (principal ?? '').trim();
  }

  /**
   * **The stamp, read back** (hub#1565) — «Retirado por Ana desde printing · 22/8/26, 12:05».
   *
   * Whole sentences from the catalog, one per case, instead of gluing fragments together: a
   * translation is a sentence, and «by» + «from» + a date assembled in source order is how a
   * screen ends up reading like a telegram in every language but the one it was written in.
   *
   * A gesture that never happened paints nothing at all, and neither does one whose stamp did not
   * travel — a counter session, or a hub older than the fix.
   */
  private renderJobStamp(j: QueueJobWire, t: (k: string, p?: Record<string, unknown>) => string) {
    const lines: string[] = [];
    const discardedWhen = this.momentText(j.discardedAt);
    const discardedWho = this.actor(j.discardedByName, j.discardedBy);
    if (discardedWhen && discardedWho) {
      const via = (j.discardedByModule ?? '').trim();
      lines.push(
        via
          ? t('ui.jobStampDiscardedVia', { who: discardedWho, module: via, when: discardedWhen })
          : t('ui.jobStampDiscarded', { who: discardedWho, when: discardedWhen }),
      );
      const reason = (j.discardReason ?? '').trim();
      // The half only the person knew. Absent when nobody typed one: demanding an essay to close a
      // row is how a recovery queue stops being drained, so an empty reason is a normal outcome.
      if (reason) lines.push(t('ui.jobStampDiscardReason', { reason }));
    }
    const retriedWhen = this.momentText(j.retriedAt);
    const retriedWho = this.actor(j.retriedByName, j.retriedBy);
    if (retriedWhen && retriedWho) {
      const via = (j.retriedByModule ?? '').trim();
      lines.push(
        via
          ? t('ui.jobStampRetriedVia', { who: retriedWho, module: via, when: retriedWhen })
          : t('ui.jobStampRetried', { who: retriedWho, when: retriedWhen }),
      );
    }
    if (lines.length === 0) return nothing;
    return html`${lines.map((line) => html`<div class="job-stamp">${line}</div>`)}`;
  }

  /**
   * The two gestures, offered only where they can work.
   *
   * A `printing` job gets neither: its lease already covers a host that died, and binning a ticket a
   * live host is rendering is the silent loss the queue exists to prevent. And nothing at all is
   * offered without the admin session — NOT a disabled button, which on a touch screen swallows the
   * tap and hides the reason in a `title`.
   */
  private renderJobActions(j: QueueJobWire, t: (k: string, p?: Record<string, unknown>) => string) {
    if (!this.canManageQueue) return nothing;
    const canRetry = j.status === RETRYABLE_STATUS;
    const canDiscard = DISCARDABLE_STATUSES.includes(j.status);
    if (!canRetry && !canDiscard) return nothing;
    const busy = this.jobBusyId === j.jobId;
    if (this.discardingId === j.jobId) {
      return html`
        <div data-testid=${`printing-job-${j.jobId}-discard-form`} class="job-actions job-discard">
          <span class="grow">${t('ui.jobDiscardTitle')}</span>
          <ion-input data-testid=${`printing-job-${j.jobId}-discard-reason`} class="job-discard-reason grow" mode="md" fill="outline" label-placement="floating"
            label=${t('ui.jobDiscardReason')} .value=${this.discardReason}
            @ionInput=${(e: Event) => {
              const detail = (e as CustomEvent<{ value?: string | null }>).detail;
              this.discardReason = detail?.value ?? (e.target as HTMLInputElement).value ?? '';
            }}></ion-input>
          <ion-button data-testid=${`printing-job-${j.jobId}-discard-confirm`} class="job-discard-confirm" size="small" color="danger" ?disabled=${busy}
            @click=${() => void this.confirmDiscard(j.jobId)}>${t('ui.jobDiscardConfirm')}</ion-button>
          <ion-button data-testid=${`printing-job-${j.jobId}-discard-cancel`} class="job-discard-cancel" size="small" fill="outline"
            @click=${() => this.cancelDiscard()}>${t('ui.jobCancel')}</ion-button>
        </div>
      `;
    }
    return html`
      <div class="job-actions">
        ${canRetry
          ? html`<ion-button data-testid=${`printing-job-${j.jobId}-retry`} class="job-action-retry" size="small" fill="outline" ?disabled=${busy}
              @click=${() => void this.retryJob(j.jobId)}>${t('ui.jobRetry')}</ion-button>`
          : nothing}
        ${canDiscard
          ? html`<ion-button data-testid=${`printing-job-${j.jobId}-discard`} class="job-action-discard" size="small" fill="outline" ?disabled=${busy}
              @click=${() => this.openDiscard(j.jobId)}>${t('ui.jobDiscard')}</ion-button>`
          : nothing}
      </div>
    `;
  }

  render() {
    const s = this.settings;
    const t = (k: string, params?: Record<string, unknown>): string => erplora().t(CATALOG, k, params);
    return html`
      <h2>${t('ui.printersTitle')}</h2>
      <p class="muted">${t('ui.printersIntro')}</p>

      <section>
        <div class="row">
          <h3 style="margin:0">${t('ui.queueTitle')}</h3>
          <ion-button data-testid="printing-queue-refresh" class="queue-refresh" size="small" fill="outline" ?disabled=${this.queueLoading}
            @click=${() => void this.loadQueue()}>
            ${this.queueLoading ? t('ui.queueRefreshing') : t('ui.queueRefresh')}
          </ion-button>
        </div>
        ${this.queueError ? html`<p data-testid="printing-queue-error" class="err">${this.queueError}</p>` : nothing}
        ${this.renderJobNotice(t)}
        ${this.queueLoaded && !this.queueError
          ? this.coverage
              .filter((c) => c.undrained)
              .map(
                (c) => html`
                  <div data-testid=${`printing-queue-alert-${c.role}`} class="queue-alert">
                    ${t('ui.queueAlertWaiting', {
                      waiting: c.waiting,
                      role: this.roleLabel(c.role),
                      age: this.waitText(c.waitingSeconds, t),
                    })}
                    ${t(queueNoDeviceKey(this.hardwareOnline))}
                  </div>
                `,
              )
          : nothing}
        ${this.queueLoaded && !this.queueError && this.queue.length === 0
          ? this.liveHostCount > 0
            ? html`<p data-testid="printing-queue-clear" class="ok">${t('ui.queueAllClear', { n: this.liveHostCount })}</p>`
            : html`<p data-testid="printing-queue-clear-no-host" class="muted">${t('ui.queueAllClearNoHost')}</p>`
          : nothing}
        <div class="queue-roles">
          ${this.coverage.map((c) => {
            const status = classifyCoverage(c);
            return html`
              <div data-testid=${`printing-queue-role-${c.role}`} class="queue-role">
                <div><span class="queue-role-status ${status}">${t(this.roleStatusKey(status))}</span></div>
                <div><strong>${this.roleLabel(c.role)}</strong></div>
                ${c.waiting > 0
                  ? html`<div>${t('ui.queueWaitingJobs', { waiting: c.waiting })} · ${t('ui.queueOldest', { age: this.waitText(c.waitingSeconds, t) })}</div>`
                  : nothing}
                ${c.liveHosts > 0
                  ? html`<div class="hosts">${this.liveHostsText(c, t)}</div>`
                  : nothing}
              </div>
            `;
          })}
        </div>
        ${this.queue.map(
          (j) => html`
            <div data-testid=${`printing-job-${j.jobId}`} class="queue-job">
              <div class="grow">
                <div>${this.docLabel(j.documentType)} <span data-testid=${`printing-job-${j.jobId}-status`} class="badge st-${j.status}">${t(this.jobStatusKey(j.status))}</span></div>
                <div class="id">${j.jobId} · ${this.roleLabel(j.role)} · ${t('ui.jobAge', { age: this.waitText((Date.now() - Date.parse(j.createdAt)) / 1000, t) })}</div>
                ${j.lastError ? html`<div data-testid=${`printing-job-${j.jobId}-error`} class="err">${t('ui.jobLastError', { error: j.lastError })}</div>` : nothing}
                ${this.renderJobStamp(j, t)}
              </div>
              <div class="meta">${t('ui.jobAttempts', { n: j.attempts })}</div>
              ${this.renderJobActions(j, t)}
            </div>
          `,
        )}
        ${this.retired.length > 0
          ? html`
              <h4 class="queue-retired-title">${t('ui.queueRetiredTitle')}</h4>
              ${this.retired.map(
                (j) => html`
                  <div data-testid=${`printing-retired-${j.jobId}`} class="queue-job retired">
                    <div class="grow">
                      <div>${this.docLabel(j.documentType)} <span data-testid=${`printing-retired-${j.jobId}-status`} class="badge st-${j.status}">${t(this.jobStatusKey(j.status))}</span></div>
                      <div class="id">${j.jobId} · ${this.roleLabel(j.role)}</div>
                      ${this.renderJobStamp(j, t)}
                    </div>
                  </div>
                `,
              )}
            `
          : nothing}
      </section>

      <section>
        <h3>${t('ui.ticketSettings')}</h3>
        <div class="field">
          <ion-input data-testid="printing-receipt-header" mode="md" fill="outline" label-placement="floating" label=${t('ui.receiptHeader')} .value=${s.receipt_header} placeholder=${t('ui.receiptHeaderPlaceholder')}
            @ionInput=${(e: Event) => this.set('receipt_header', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="field">
          <ion-input data-testid="printing-receipt-footer" mode="md" fill="outline" label-placement="floating" label=${t('ui.receiptFooter')} .value=${s.receipt_footer} placeholder=${t('ui.receiptFooterPlaceholder')}
            @ionInput=${(e: Event) => this.set('receipt_footer', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="row">
          <label>${t('ui.paperWidth')}</label>
          <ion-select data-testid="printing-paper-width" .value=${String(s.paper_width)} interface="popover"
            @ionChange=${(e: Event) => this.set('paper_width', Number((e.target as HTMLInputElement).value))}>
            <ion-select-option value="80">80 mm</ion-select-option>
            <ion-select-option value="58">58 mm</ion-select-option>
          </ion-select>
        </div>
        <div class="row">
          <label>${t('ui.autoPrintOnSale')}</label>
          <ion-toggle data-testid="printing-auto-print" ?checked=${s.auto_print_on_sale === 1}
            @ionChange=${(e: Event) => this.set('auto_print_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <div class="row">
          <label>${t('ui.openDrawerOnSale')}</label>
          <ion-toggle data-testid="printing-open-drawer" ?checked=${s.open_drawer_on_sale === 1}
            @ionChange=${(e: Event) => this.set('open_drawer_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <ion-button data-testid="printing-settings-save" size="small" ?disabled=${this.saving} @click=${() => this.saveSettings()}>
          ${this.saving ? t('ui.saving') : t('ui.saveSettings')}
        </ion-button>
        ${this.saved ? html`<span data-testid="printing-settings-saved" class="ok"> ${t('ui.saved')}</span>` : nothing}
        ${this.error ? html`<p data-testid="printing-settings-error" class="err">${this.error}</p>` : nothing}
      </section>

      <section>
        <div class="row">
          <h3 style="margin:0">${t('ui.networkPrinters')}</h3>
          <ion-button data-testid="printing-hardware-rescan" size="small" fill="outline" ?disabled=${this.scanning} @click=${() => this.refreshHardware()}>
            ${this.scanning ? t('ui.scanning') : t('ui.rescan')}
          </ion-button>
        </div>
        ${this.hardwareOnline
          ? html`<p data-testid="printing-hardware-ready" class="muted">${t('ui.printerReady')}${this.appVersion ? html` · v${this.appVersion}` : nothing}.</p>`
          : html`<p data-testid="printing-hardware-unavailable" class="err">${t('ui.hardwareUnavailable')}</p>`}
        ${this.hardwareError ? html`<p data-testid="printing-hardware-error" class="err">${this.hardwareError}</p>` : nothing}
        ${this.hardwareOnline && this.printers.length === 0 && !this.scanning
          ? html`<p data-testid="printing-hardware-empty" class="muted">${t('ui.noPrintersFound')}</p>`
          : nothing}
        ${this.printers.map(
          (p) => html`
            <div data-testid=${`printing-printer-${p.id}`} class="printer">
              <div class="grow">
                <div>${p.name} <span class="badge">${this.printerStatusLabel(p.status)}</span></div>
                <div class="id">${p.id}${p.mac ? html` · ${p.mac}` : nothing}</div>
              </div>
              <ion-select data-testid=${`printing-printer-${p.id}-role`} placeholder=${t('ui.rolePlaceholder')} .value=${this.roleOf(p)} interface="popover"
                @ionChange=${(e: Event) => this.assignRole(p, (e.target as HTMLInputElement).value)}>
                ${ROLES.map((r) => html`<ion-select-option value=${r}>${this.roleLabel(r)}</ion-select-option>`)}
              </ion-select>
              <ion-button data-testid=${`printing-printer-${p.id}-test`} size="small" fill="outline" @click=${() => this.test(p)}>${t('ui.test')}</ion-button>
            </div>
          `,
        )}
      </section>
    `;
  }
}

define('erp-printing-settings', ErpPrintingSettings);
