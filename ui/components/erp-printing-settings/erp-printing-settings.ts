import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import { BridgeClient } from '@erplora/module-sdk';
import type { BridgePrinter, BridgeDevice } from '@erplora/module-sdk';

// Web Component del módulo 'printing': ajustes de impresión (BD, vía el SDK) + impresoras
// detectadas por el Bridge local (canal de hardware, vía BridgeClient → ws://localhost:12321).
// NO toca la BD directamente: datos por globalThis.erplora; hardware por el Bridge.

interface ErploraClientLike {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
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

  private bridge = new BridgeClient();

  async firstUpdated(): Promise<void> {
    await this.loadSettings();
    await this.refreshBridge();
  }

  private async loadSettings(): Promise<void> {
    try {
      const rows = await erplora().query<PrintingSettings[]>('printing.settings.get');
      if (Array.isArray(rows) && rows[0]) this.settings = { ...DEFAULTS, ...rows[0] };
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron cargar los ajustes';
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
      this.error = e instanceof Error ? e.message : 'No se pudo guardar';
    } finally {
      this.saving = false;
    }
  }

  private async refreshBridge(): Promise<void> {
    this.bridgeError = '';
    const status = await this.bridge.detect();
    this.bridgeOnline = status.online;
    this.bridgeVersion = status.version ?? '';
    if (status.online) await this.scan();
  }

  private async scan(): Promise<void> {
    this.scanning = true;
    this.bridgeError = '';
    try {
      this.printers = await this.bridge.discoverPrinters();
      this.devices = await this.bridge.getDevices();
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : 'Error al escanear';
    } finally {
      this.scanning = false;
    }
  }

  private async assignRole(printer: BridgePrinter, role: string): Promise<void> {
    if (!printer.mac) {
      this.bridgeError = 'La impresora no tiene MAC; no se puede asignar rol.';
      return;
    }
    try {
      this.devices = await this.bridge.setDeviceRole(printer.mac, role);
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : 'No se pudo asignar el rol';
    }
  }

  private async test(printer: BridgePrinter): Promise<void> {
    this.bridgeError = '';
    try {
      await this.bridge.testPrint(printer.id);
    } catch (e) {
      this.bridgeError = e instanceof Error ? e.message : 'Falló la impresión de prueba';
    }
  }

  private roleOf(printer: BridgePrinter): string {
    const d = this.devices.find((x) => printer.mac && x.mac === printer.mac);
    return d?.role ?? '';
  }

  private set<K extends keyof PrintingSettings>(key: K, value: PrintingSettings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.saved = false;
  }

  render() {
    const s = this.settings;
    return html`
      <h2>Printers</h2>
      <p class="muted">Configura la impresión de tickets y las impresoras de red detectadas por el Bridge.</p>

      <section>
        <h3>Ajustes del ticket</h3>
        <div class="field">
          <label>Cabecera del recibo</label>
          <ion-input .value=${s.receipt_header} placeholder="Mi negocio · NIF · dirección"
            @ionInput=${(e: Event) => this.set('receipt_header', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="field">
          <label>Pie del recibo</label>
          <ion-input .value=${s.receipt_footer} placeholder="¡Gracias por su compra!"
            @ionInput=${(e: Event) => this.set('receipt_footer', (e.target as HTMLInputElement).value)}></ion-input>
        </div>
        <div class="row">
          <label>Ancho de papel</label>
          <ion-select .value=${String(s.paper_width)} interface="popover"
            @ionChange=${(e: Event) => this.set('paper_width', Number((e.target as HTMLInputElement).value))}>
            <ion-select-option value="80">80 mm</ion-select-option>
            <ion-select-option value="58">58 mm</ion-select-option>
          </ion-select>
        </div>
        <div class="row">
          <label>Imprimir ticket al cobrar</label>
          <ion-toggle ?checked=${s.auto_print_on_sale === 1}
            @ionChange=${(e: Event) => this.set('auto_print_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <div class="row">
          <label>Abrir cajón al cobrar</label>
          <ion-toggle ?checked=${s.open_drawer_on_sale === 1}
            @ionChange=${(e: Event) => this.set('open_drawer_on_sale', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <div class="row">
          <label>Enrutar comandas a cocina/barra</label>
          <ion-toggle ?checked=${s.print_kitchen === 1}
            @ionChange=${(e: Event) => this.set('print_kitchen', (e.target as HTMLInputElement).checked ? 1 : 0)}></ion-toggle>
        </div>
        <ion-button size="small" ?disabled=${this.saving} @click=${() => this.saveSettings()}>
          ${this.saving ? 'Guardando…' : 'Guardar ajustes'}
        </ion-button>
        ${this.saved ? html`<span class="ok"> ✓ Guardado</span>` : nothing}
        ${this.error ? html`<p class="err">${this.error}</p>` : nothing}
      </section>

      <section>
        <div class="row">
          <h3 style="margin:0">Impresoras en la red</h3>
          <ion-button size="small" fill="outline" ?disabled=${this.scanning} @click=${() => this.refreshBridge()}>
            ${this.scanning ? 'Escaneando…' : 'Re-escanear'}
          </ion-button>
        </div>
        ${this.bridgeOnline
          ? html`<p class="muted">Bridge conectado${this.bridgeVersion ? html` · v${this.bridgeVersion}` : nothing}.</p>`
          : html`<p class="err">El Bridge no está corriendo en este equipo. Instálalo y arráncalo para detectar impresoras.</p>`}
        ${this.bridgeError ? html`<p class="err">${this.bridgeError}</p>` : nothing}
        ${this.bridgeOnline && this.printers.length === 0 && !this.scanning
          ? html`<p class="muted">No se encontraron impresoras de red (puerto 9100) en esta subred.</p>`
          : nothing}
        ${this.printers.map(
          (p) => html`
            <div class="printer">
              <div class="grow">
                <div>${p.name} <span class="badge">${p.status}</span></div>
                <div class="id">${p.id}${p.mac ? html` · ${p.mac}` : nothing}</div>
              </div>
              <ion-select placeholder="Rol" .value=${this.roleOf(p)} interface="popover"
                @ionChange=${(e: Event) => this.assignRole(p, (e.target as HTMLInputElement).value)}>
                ${ROLES.map((r) => html`<ion-select-option value=${r}>${r}</ion-select-option>`)}
              </ion-select>
              <ion-button size="small" fill="outline" @click=${() => this.test(p)}>Probar</ion-button>
            </div>
          `,
        )}
      </section>
    `;
  }
}

define('erp-printing-settings', ErpPrintingSettings);
