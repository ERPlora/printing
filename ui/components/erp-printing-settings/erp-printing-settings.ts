import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import type { BridgePrinter, BridgeDevice, BridgeTransport } from '@erplora/module-sdk';
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

// Web Component del módulo 'printing': ajustes de impresión (BD) + impresoras detectadas por el
// Bridge. TODO pasa por el cliente del Hub (globalThis.erplora): datos por .query/.command y
// hardware por .peripherals. El módulo NUNCA habla con el Bridge directo — el shell elige el
// transporte (ws-localhost en web-PWA, invoke en Tauri). ARQUITECTURA.md §2.7.

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
    .row { display:flex; align-items:center; gap:.5rem; justify-content:space-between; max-width:520px; }
    .printer { display:flex; align-items:center; gap:.6rem; padding:.6rem .75rem; border:1px solid #0001; border-radius:.5rem; margin-bottom:.5rem; flex-wrap:wrap; }
    .printer .id { font-family:ui-monospace, monospace; font-size:.8rem; opacity:.7; }
    .grow { flex:1; min-width:160px; }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; }
    .muted { opacity:.65; font-size:.85rem; }
    .badge { font-size:.7rem; padding:.1rem .45rem; border-radius:999px; background:#0001; }
  `;

  @state() private settings: PrintingSettings = { ...DEFAULTS };
  @state() private saving = false;
  @state() private saved = false;
  @state() private error = '';

  @state() private bridgeOnline = false;
  @state() private bridgeVersion = '';
  @state() private scanning = false;
  @state() private printers: BridgePrinter[] = [];
  @state() private devices: BridgeDevice[] = [];
  @state() private bridgeError = '';

  /** Hardware vía el cliente del Hub (no un BridgeClient propio). */
  private get peripherals(): BridgeTransport {
    return erplora().peripherals;
  }

  async firstUpdated(): Promise<void> {
    await this.loadSettings();
    await this.refreshBridge();
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

  private async refreshBridge(): Promise<void> {
    this.bridgeError = '';
    const status = await this.peripherals.detect();
    this.bridgeOnline = status.online;
    this.bridgeVersion = status.version ?? '';
    if (status.online) await this.scan();
  }

  private async scan(): Promise<void> {
    this.scanning = true;
    this.bridgeError = '';
    try {
      this.printers = await this.peripherals.discoverPrinters();
      this.devices = await this.peripherals.getDevices();
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errScan');
    } finally {
      this.scanning = false;
    }
  }

  private async assignRole(printer: BridgePrinter, role: string): Promise<void> {
    if (!printer.mac) {
      this.bridgeError = erplora().t(CATALOG, 'ui.errNoMac');
      return;
    }
    try {
      this.devices = await this.peripherals.setDeviceRole(printer.mac, role);
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errAssignRole');
    }
  }

  private async test(printer: BridgePrinter): Promise<void> {
    this.bridgeError = '';
    try {
      await this.peripherals.testPrint(printer.id);
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errTestPrint');
    }
  }

  private roleOf(printer: BridgePrinter): string {
    const d = this.devices.find((x) => printer.mac && x.mac === printer.mac);
    return d?.role ?? '';
  }

  // Etiqueta i18n para un rol/estación lógica (el `value=` enviado al Bridge sigue siendo el enum).
  private roleLabel(role: string): string {
    const keys: Record<string, string> = {
      receipt: 'ui.roleReceipt',
      kitchen: 'ui.roleKitchen',
      bar: 'ui.roleBar',
      label: 'ui.roleLabel',
    };
    return keys[role] ? erplora().t(CATALOG, keys[role]) : role;
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
        <h3>${t('ui.ticketSettings')}</h3>
        <div class="field">
          <ion-input fill="outline" label-placement="floating" label=${t('ui.receiptHeader')} .value=${s.receipt_header} placeholder=${t('ui.receiptHeaderPlaceholder')}
            @ionInput=${(e: Event) => this.set('receipt_header', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="field">
          <ion-input fill="outline" label-placement="floating" label=${t('ui.receiptFooter')} .value=${s.receipt_footer} placeholder=${t('ui.receiptFooterPlaceholder')}
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
        <div class="row">
          <label>${t('ui.routeToKitchen')}</label>
          <ion-toggle ?checked=${s.print_kitchen === 1}
            @ionChange=${(e: Event) => this.set('print_kitchen', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
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
          <ion-button size="small" fill="outline" ?disabled=${this.scanning} @click=${() => this.refreshBridge()}>
            ${this.scanning ? t('ui.scanning') : t('ui.rescan')}
          </ion-button>
        </div>
        ${this.bridgeOnline
          ? html`<p class="muted">${t('ui.bridgeConnected')}${this.bridgeVersion ? html` · v${this.bridgeVersion}` : nothing}.</p>`
          : html`<p class="err">${t('ui.bridgeOffline')}</p>`}
        ${this.bridgeError ? html`<p class="err">${this.bridgeError}</p>` : nothing}
        ${this.bridgeOnline && this.printers.length === 0 && !this.scanning
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
