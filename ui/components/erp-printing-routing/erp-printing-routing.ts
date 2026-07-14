import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

// Web Component del módulo 'printing': enrutado categoría de producto → estación lógica
// (receipt|kitchen|bar). Lista con ok-data-table sobre printing.routing.list y gestiona las
// reglas con printing.routing.set (upsert por categoría) / printing.routing.remove. El rol
// físico de cada impresora NO vive aquí (lo gestiona el Bridge en devices.json); este WC solo
// decide a qué estación lógica van los ítems — ver architecture/modules/printing.md.

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  /** i18n del módulo (ADR-0055): idioma activo + traducción del catálogo `ui`. */
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

interface RoutingRule {
  id: string;
  category: string;
  station: string;
  created_at: string | null;
}

const STATIONS = ['receipt', 'kitchen', 'bar'];

// Etiqueta i18n de una estación lógica; el `value=`/enum enviado al runtime sigue siendo el código.
const STATION_LABEL_KEYS: Record<string, string> = {
  receipt: 'ui.stationReceipt',
  kitchen: 'ui.stationKitchen',
  bar: 'ui.stationBar',
};

function stationLabel(station: string): string {
  const key = STATION_LABEL_KEYS[station];
  return key ? erplora().t(CATALOG, key) : station;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpPrintingRouting extends LitElement {
  static styles = css`
    :host { display:flex; flex-direction:column; height:100%; min-height:0; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    /* La vista llena el alto: el data-table ocupa el resto (scroll interno, pie fijo). */
    .page { display:flex; flex-direction:column; min-height:0; flex:1 1 auto; }
    .page > ok-data-table { flex:1 1 auto; min-height:0; }
    .muted { opacity:.65; font-size:.85rem; margin:0; }
    /* La regla se crea/edita en el panel lateral de la tabla (estrecho) → columna, no fila. */
    .form { display:flex; flex-direction:column; gap:.7rem; }
    .form ion-button { align-self:flex-end; }
    .err { color:#d9480f; font-weight:600; }
  `;

  @state() private saving = false;

  @state() private formError = '';

  @state() private newCategory = '';

  @state() private newStation = 'kitchen';

  private ctrl!: ListController<RoutingRule>;

  // Getters (no campos): se re-evalúan en cada render, así los textos cambian con el idioma activo
  // (ADR-0055). El re-render lo dispara `erplora:locale-changed` vía `onLocaleChange`.
  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
      // `category` NO se anuncia como filtrable: `printing.routing.list` solo declara el filtro
      // `station` (op eq) en module.json — el embudo pintaría un control que el runtime ignora en
      // silencio. Buscar por categoría sí funciona (va en `list.search`), por el buscador de la barra.
      { key: 'category', header: t('ui.colCategory'), sortable: true },
      {
        key: 'station',
        header: t('ui.colStation'),
        sortable: true,
        filterable: true,
        filterType: 'select',
        options: STATIONS.map((s) => ({ value: s, label: stationLabel(s) })),
        format: (r) => stationLabel(r.station as string),
      },
    ];
  }

  private get actions() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
      { id: 'edit', label: t('ui.actionEdit'), icon: 'pencil' },
      { id: 'remove', label: t('ui.actionDelete'), icon: 'trash', color: 'danger' },
    ];
  }

  // Referencia al ok-data-table para abrir/cerrar su panel lateral (la regla se crea Y se edita ahí).
  private dataTable(): { open(p?: 'filters' | 'create'): void; close(): void } | null {
    return this.renderRoot.querySelector('ok-data-table') as
      | { open(p?: 'filters' | 'create'): void; close(): void }
      | null;
  }

  // Re-render al cambiar el idioma del shell (ADR-0055): getters `columns`/`actions` y el template
  // se re-evalúan con el nuevo `erplora.locale`.
  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    this.ctrl = createListController<RoutingRule>(erplora(), 'printing.routing.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'category',
      dir: 'asc',
    });
    await this.ctrl.load();
  }

  disconnectedCallback() {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    super.disconnectedCallback();
  }

  private async setRule(ev: Event) {
    ev.preventDefault();
    const category = this.newCategory.trim();
    if (!category || !STATIONS.includes(this.newStation)) return;
    this.saving = true;
    this.formError = '';
    try {
      // Upsert por unique (hub_id, category): asignar de nuevo una categoría existente la edita.
      await erplora().command('printing.routing.set', { category, station: this.newStation });
      this.newCategory = '';
      this.newStation = 'kitchen';
      this.dataTable()?.close(); // cierra el panel lateral tras asignar
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errSaveRule');
    } finally {
      this.saving = false;
    }
  }

  private async removeRule(category: string) {
    this.formError = '';
    try {
      await erplora().command('printing.routing.remove', { category });
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.errRemoveRule');
    }
  }

  private onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) {
    const { actionId, row } = ev.detail;
    const rule = row as unknown as RoutingRule;
    if (actionId === 'remove') {
      this.removeRule(rule.category);
    } else if (actionId === 'edit') {
      // Editar reabre el MISMO panel de alta, pre-rellenado: `printing.routing.set` es un upsert por
      // categoría, así que guardar sobre una categoría existente la reasigna.
      this.newCategory = rule.category;
      this.newStation = STATIONS.includes(rule.station) ? rule.station : 'kitchen';
      this.dataTable()?.open('create');
    }
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div class="page">
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table
          .serverSide=${true}
          .fill=${true}
          .addable=${true}
          .columns=${this.columns}
          .views=${true}
          .cardTitle=${(r: Record<string, unknown>) => String(r.category ?? '—')}
          .cardIcon=${() => 'print-outline'}
          .rows=${this.ctrl?.rows ?? []}
          .total=${this.ctrl?.total ?? 0}
          .page=${this.ctrl?.state.page ?? 0}
          .pageSize=${this.ctrl?.state.pageSize ?? 50}
          .sort=${this.ctrl?.state.sort}
          .sortDir=${this.ctrl?.state.dir ?? 'asc'}
          .searchable=${true}
          .searchPlaceholder=${t('ui.searchRouting')}
          .actions=${this.actions}
          .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyRouting')}
          @rowAction=${(e: CustomEvent) => this.onRowAction(e)}
          @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)}
          @pageSizeChange=${(e: CustomEvent<number>) => this.ctrl.setPageSize(e.detail)}
          @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)}
          @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)}
          @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}
        >
          <!-- Regla (alta Y edición): se proyecta SIEMPRE, aunque el panel esté cerrado. Si solo se
               renderizara con el panel abierto, el «+» de la barra desplegaría un panel vacío. -->
          <form slot="create" class="form" @submit=${(e: Event) => this.setRule(e)}>
            <p class="muted">${t('ui.routingIntro')}</p>
            <ion-input fill="outline" label-placement="floating" label=${t('ui.colCategory')} placeholder=${t('ui.categoryPlaceholder')} .value=${this.newCategory}
              @ionInput=${(e: Event) => (this.newCategory = (e.target as HTMLInputElement).value)}></ion-input>
            <ion-select fill="outline" label-placement="floating" label=${t('ui.colStation')} placeholder=${t('ui.stationPlaceholder')} interface="popover" .value=${this.newStation}
              @ionChange=${(e: Event) => (this.newStation = (e.target as HTMLInputElement).value)}>
              ${STATIONS.map((s) => html`<ion-select-option .value=${s}>${stationLabel(s)}</ion-select-option>`)}
            </ion-select>
            <ion-button type="submit" ?disabled=${this.saving || !this.newCategory.trim()}>
              ${this.saving ? t('ui.saving') : t('ui.assign')}
            </ion-button>
          </form>
        </ok-data-table>
      </div>`;
  }
}

define('erp-printing-routing', ErpPrintingRouting);
