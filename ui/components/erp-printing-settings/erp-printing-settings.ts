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

interface ErploraClientLike {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
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

// ── The hub's print queue, over the wire (printing#28, hub#341/#342/#987) ──────────────────────
//
// `GET /api/print/hosts` and `GET /api/print/jobs` are core REST of the hub, and the module SDK has
// no door for them: `ErploraClient` never exposes its transport, `coreRequest` is private by design
// ("not reachable from module code", module-sdk), and the only core surfaces a module can reach
// (`forModule(…).flows/.events`) are pinned to flows and gated by `manage_flows`. The route that
// exists for a module is the document it lives in: the screen runs inside the shell's page, same
// origin (in dev the Vite proxy carries `/api`), and the session the runtime wants travels in the
// `X-Hub-Session` header — the same `localStorage` key the shell's own `runtimeHeaders()` reads
// (`erplora.hub_session`). That coupling is named HERE and kept to one function; the day the shell
// offers a proper door, `fetchQueueJson` is the single seam to swap.

/** `X-Hub-Session`: what `auth::require_user_session` reads on every core route. */
const HUB_SESSION_KEY = 'erplora.hub_session';

/** How often the screen re-reads the queue on its own: often enough to matter, rarely enough to idle. */
const QUEUE_REFRESH_MS = 30_000;

/** Page size per status bucket; the hub clamps to 500 and defaults to 100. */
const QUEUE_LIMIT = 100;

/** A registered print host, as `GET /api/print/hosts` returns it (camelCase over the wire). */
interface HostWire {
  deviceId: string;
  role: string;
  label: string;
  live: boolean;
}

/** Per-role coverage as the runtime computes and RESOLVES it: `undrained` arrives decided. */
interface CoverageWire {
  role: string;
  waiting: number;
  liveHosts: number;
  waitingSeconds: number;
  undrained: boolean;
}

/** A queued job as `GET /api/print/jobs` summarizes it — everything except the document. */
interface QueueJobWire {
  jobId: string;
  role: string;
  documentType: string;
  format: string;
  status: string;
  attempts: number;
  createdAt: string;
  lastError: string | null;
}

/** The three states of a role, worst first. Mirrors the hub's own coverage screen (`hub#800`). */
type RoleStatus = 'stalled' | 'unattended' | 'ready';

function classifyCoverage(c: CoverageWire): RoleStatus {
  if (c.liveHosts > 0) return 'ready';
  return c.waiting > 0 ? 'stalled' : 'unattended';
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
    .queue-job .badge.st-printing { background:#d0ebff; color:#1971c2; }
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

  // printing#28: the hub's queue — coverage per role, the host registry, the stuck jobs.
  @state() private coverage: CoverageWire[] = [];
  @state() private hosts: HostWire[] = [];
  @state() private queue: QueueJobWire[] = [];
  @state() private queueLoading = false;
  @state() private queueError = '';
  @state() private queueLoaded = false;
  private queueTimerId: number | undefined;

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
   * Same-origin read of a core route, carrying the session the runtime expects. The ONE place the
   * module touches shell state: `erplora.hub_session` is the same key `runtimeHeaders()` reads, and
   * no SDK door exists for these routes (see the block comment above `HUB_SESSION_KEY`).
   */
  private fetchQueueJson(path: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    const session = this.hubSession();
    if (session) headers['X-Hub-Session'] = session;
    return fetch(path, { headers, credentials: 'same-origin' }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  /** The hub session the shell keeps, or `null` where there is none to read (locked-down browser). */
  private hubSession(): string | null {
    try {
      return globalThis.localStorage?.getItem(HUB_SESSION_KEY) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * One read = the registry with its coverage plus the three buckets the screen shows. `done` is
   * deliberately NOT fetched: it is history, not state, and the hub lists in arrival order — with a
   * lifetime of completed tickets the interesting rows would never make it into the page.
   */
  private async loadQueue(): Promise<void> {
    this.queueLoading = true;
    try {
      const [hostsRes, pendingRes, printingRes, deadRes] = await Promise.all([
        this.fetchQueueJson('/api/print/hosts'),
        this.fetchQueueJson(`/api/print/jobs?status=pending&limit=${QUEUE_LIMIT}`),
        this.fetchQueueJson(`/api/print/jobs?status=printing&limit=${QUEUE_LIMIT}`),
        this.fetchQueueJson(`/api/print/jobs?status=dead&limit=${QUEUE_LIMIT}`),
      ]);
      const hostsBody = hostsRes as { hosts?: HostWire[]; coverage?: CoverageWire[] };
      const bucket = (r: unknown): QueueJobWire[] => ((r as { jobs?: QueueJobWire[] }).jobs ?? []);
      const oldest = (a: QueueJobWire, b: QueueJobWire): number =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt);
      this.hosts = hostsBody.hosts ?? [];
      this.coverage = hostsBody.coverage ?? [];
      // Worst first for the eye: what is waiting (oldest at top), what is out, what died.
      this.queue = [
        ...bucket(pendingRes).sort(oldest),
        ...bucket(printingRes).sort(oldest),
        ...bucket(deadRes).sort(oldest),
      ];
      this.queueError = '';
      this.queueLoaded = true;
    } catch (e) {
      // A refused read is a STATE, not an empty queue: painting "all clear" here would be the lie
      // this screen exists to stop.
      const detail = e instanceof Error && /^HTTP \d+$/.test(e.message) ? ` (${e.message})` : '';
      this.queueError = `${erplora().t(CATALOG, 'ui.errQueueLoad')}${detail}`;
    } finally {
      this.queueLoading = false;
    }
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

  private async test(printer: BridgePrinter): Promise<void> {
    this.hardwareError = '';
    try {
      await this.peripherals.testPrint(printer.id);
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
    };
    return keys[status] ?? status;
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

  render() {
    const s = this.settings;
    const t = (k: string, params?: Record<string, unknown>): string => erplora().t(CATALOG, k, params);
    return html`
      <h2>${t('ui.printersTitle')}</h2>
      <p class="muted">${t('ui.printersIntro')}</p>

      <section>
        <div class="row">
          <h3 style="margin:0">${t('ui.queueTitle')}</h3>
          <ion-button class="queue-refresh" size="small" fill="outline" ?disabled=${this.queueLoading}
            @click=${() => void this.loadQueue()}>
            ${this.queueLoading ? t('ui.queueRefreshing') : t('ui.queueRefresh')}
          </ion-button>
        </div>
        ${this.queueError ? html`<p class="err">${this.queueError}</p>` : nothing}
        ${this.queueLoaded && !this.queueError
          ? this.coverage
              .filter((c) => c.undrained)
              .map(
                (c) => html`
                  <div class="queue-alert">
                    ${t('ui.queueAlertWaiting', {
                      waiting: c.waiting,
                      role: this.roleLabel(c.role),
                      age: this.waitText(c.waitingSeconds, t),
                    })}
                    ${t('ui.queueNoDevice')}
                  </div>
                `,
              )
          : nothing}
        ${this.queueLoaded && !this.queueError && this.queue.length === 0
          ? this.hosts.some((h) => h.live)
            ? html`<p class="ok">${t('ui.queueAllClear', { n: this.hosts.filter((h) => h.live).length })}</p>`
            : html`<p class="muted">${t('ui.queueAllClearNoHost')}</p>`
          : nothing}
        <div class="queue-roles">
          ${this.coverage.map((c) => {
            const status = classifyCoverage(c);
            const liveHosts = this.hosts
              .filter((h) => h.live && h.role === c.role)
              .map((h) => h.label.trim() || h.deviceId);
            return html`
              <div class="queue-role">
                <div><span class="queue-role-status ${status}">${t(this.roleStatusKey(status))}</span></div>
                <div><strong>${this.roleLabel(c.role)}</strong></div>
                ${c.waiting > 0
                  ? html`<div>${t('ui.queueWaitingJobs', { waiting: c.waiting })} · ${t('ui.queueOldest', { age: this.waitText(c.waitingSeconds, t) })}</div>`
                  : nothing}
                ${liveHosts.length > 0
                  ? html`<div class="hosts">${t('ui.queueLiveHosts', { hosts: liveHosts.join(', ') })}</div>`
                  : nothing}
              </div>
            `;
          })}
        </div>
        ${this.queue.map(
          (j) => html`
            <div class="queue-job">
              <div class="grow">
                <div>${this.docLabel(j.documentType)} <span class="badge st-${j.status}">${t(this.jobStatusKey(j.status))}</span></div>
                <div class="id">${j.jobId} · ${this.roleLabel(j.role)} · ${t('ui.jobAge', { age: this.waitText((Date.now() - Date.parse(j.createdAt)) / 1000, t) })}</div>
                ${j.lastError ? html`<div class="err">${t('ui.jobLastError', { error: j.lastError })}</div>` : nothing}
              </div>
              <div class="meta">${t('ui.jobAttempts', { n: j.attempts })}</div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3>${t('ui.ticketSettings')}</h3>
        <div class="field">
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t('ui.receiptHeader')} .value=${s.receipt_header} placeholder=${t('ui.receiptHeaderPlaceholder')}
            @ionInput=${(e: Event) => this.set('receipt_header', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="field">
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t('ui.receiptFooter')} .value=${s.receipt_footer} placeholder=${t('ui.receiptFooterPlaceholder')}
            @ionInput=${(e: Event) => this.set('receipt_footer', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="row">
          <label>${t('ui.paperWidth')}</label>
          <ion-select .value=${String(s.paper_width)} interface="popover"
            @ionChange=${(e: Event) => this.set('paper_width', Number((e.target as HTMLInputElement).value))}>
            <ion-select-option value="80">80 mm</ion-select-option>
            <ion-select-option value="58">58 mm</ion-select-option>
          </ion-select>
        </div>
        <div class="row">
          <label>${t('ui.autoPrintOnSale')}</label>
          <ion-toggle ?checked=${s.auto_print_on_sale === 1}
            @ionChange=${(e: Event) => this.set('auto_print_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <div class="row">
          <label>${t('ui.openDrawerOnSale')}</label>
          <ion-toggle ?checked=${s.open_drawer_on_sale === 1}
            @ionChange=${(e: Event) => this.set('open_drawer_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <ion-button size="small" ?disabled=${this.saving} @click=${() => this.saveSettings()}>
          ${this.saving ? t('ui.saving') : t('ui.saveSettings')}
        </ion-button>
        ${this.saved ? html`<span class="ok"> ${t('ui.saved')}</span>` : nothing}
        ${this.error ? html`<p class="err">${this.error}</p>` : nothing}
      </section>

      <section>
        <div class="row">
          <h3 style="margin:0">${t('ui.networkPrinters')}</h3>
          <ion-button size="small" fill="outline" ?disabled=${this.scanning} @click=${() => this.refreshHardware()}>
            ${this.scanning ? t('ui.scanning') : t('ui.rescan')}
          </ion-button>
        </div>
        ${this.hardwareOnline
          ? html`<p class="muted">${t('ui.printerReady')}${this.appVersion ? html` · v${this.appVersion}` : nothing}.</p>`
          : html`<p class="err">${t('ui.hardwareUnavailable')}</p>`}
        ${this.hardwareError ? html`<p class="err">${this.hardwareError}</p>` : nothing}
        ${this.hardwareOnline && this.printers.length === 0 && !this.scanning
          ? html`<p class="muted">${t('ui.noPrintersFound')}</p>`
          : nothing}
        ${this.printers.map(
          (p) => html`
            <div class="printer">
              <div class="grow">
                <div>${p.name} <span class="badge">${p.status}</span></div>
                <div class="id">${p.id}${p.mac ? html` · ${p.mac}` : nothing}</div>
              </div>
              <ion-select placeholder=${t('ui.rolePlaceholder')} .value=${this.roleOf(p)} interface="popover"
                @ionChange=${(e: Event) => this.assignRole(p, (e.target as HTMLInputElement).value)}>
                ${ROLES.map((r) => html`<ion-select-option value=${r}>${this.roleLabel(r)}</ion-select-option>`)}
              </ion-select>
              <ion-button size="small" fill="outline" @click=${() => this.test(p)}>${t('ui.test')}</ion-button>
            </div>
          `,
        )}
      </section>
    `;
  }
}

define('erp-printing-settings', ErpPrintingSettings);
