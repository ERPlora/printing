import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';

// Web Component del módulo 'printing': enrutado categoría de producto → estación lógica
// (receipt|kitchen|bar). Lista con ok-data-table sobre printing.routing.list y gestiona las
// reglas con printing.routing.set (upsert por categoría) / printing.routing.remove. El rol
// físico de cada impresora NO vive aquí (lo gestiona el Bridge en devices.json); este WC solo
// decide a qué estación lógica van los ítems — ver architecture/modules/printing.md.

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
}

interface RoutingRule {
  id: string;
  category: string;
  station: string;
  created_at: string | null;
}

const STATIONS = ['receipt', 'kitchen', 'bar'];

const STATION_LABELS: Record<string, string> = {
  receipt: 'Recibo',
  kitchen: 'Cocina',
  bar: 'Barra',
};

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpPrintingRouting extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.25rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .muted { opacity:.65; font-size:.85rem; margin:0 0 .75rem; }
    .form { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { --background:var(--surface-2,#f7f4ec); border:1px solid var(--line,#e7e2d6); border-radius:8px; min-width:10rem; }
    .err { color:#d9480f; font-weight:600; }
  `;

  @state() private saving = false;

  @state() private formError = '';

  @state() private newCategory = '';

  @state() private newStation = 'kitchen';

  private ctrl!: ListController<RoutingRule>;

  private columns: DataTableColumn[] = [
    { key: 'category', header: 'Categoría', sortable: true, filterable: true, filterType: 'text' },
    {
      key: 'station',
      header: 'Estación',
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: STATIONS.map((s) => ({ value: s, label: STATION_LABELS[s] ?? s })),
      format: (r) => STATION_LABELS[r.station as string] ?? (r.station as string),
    },
  ];

  private actions = [
    { id: 'edit', label: 'Editar', icon: 'pencil' },
    { id: 'remove', label: 'Eliminar', icon: 'trash', color: 'danger' },
  ];

  async connectedCallback() {
    super.connectedCallback();
    this.ctrl = createListController<RoutingRule>(erplora(), 'printing.routing.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'category',
      dir: 'asc',
    });
    await this.ctrl.load();
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
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo guardar la regla';
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
      this.formError = e instanceof Error ? e.message : 'No se pudo eliminar la regla';
    }
  }

  private onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) {
    const { actionId, row } = ev.detail;
    const rule = row as unknown as RoutingRule;
    if (actionId === 'remove') {
      this.removeRule(rule.category);
    } else if (actionId === 'edit') {
      // Carga la regla en el formulario; guardar = upsert sobre la misma categoría.
      this.newCategory = rule.category;
      this.newStation = STATIONS.includes(rule.station) ? rule.station : 'kitchen';
    }
  }

  render() {
    return html`<div>
        <header>
          <h2>Enrutado de comandas</h2>
        </header>
        <p class="muted">
          Asigna cada categoría de producto a una estación (recibo, cocina o barra). Sin regla, los
          productos van a cocina por defecto; la estación «recibo» se excluye de las comandas.
        </p>
        <form class="form" @submit=${(e: Event) => this.setRule(e)}>
          <ion-input placeholder="Categoría (p.ej. Bebidas)" .value=${this.newCategory}
            @ionInput=${(e: Event) => (this.newCategory = (e.target as HTMLInputElement).value)}></ion-input>
          <ion-select placeholder="Estación…" interface="popover" .value=${this.newStation}
            @ionChange=${(e: Event) => (this.newStation = (e.target as HTMLInputElement).value)}>
            ${STATIONS.map((s) => html`<ion-select-option .value=${s}>${STATION_LABELS[s] ?? s}</ion-select-option>`)}
          </ion-select>
          <ion-button type="submit" size="small" ?disabled=${this.saving || !this.newCategory.trim()}>
            ${this.saving ? 'Guardando…' : 'Asignar'}
          </ion-button>
        </form>
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table
          .serverSide=${true}
          .columns=${this.columns}
          .rows=${this.ctrl?.rows ?? []}
          .total=${this.ctrl?.total ?? 0}
          .page=${this.ctrl?.state.page ?? 0}
          .pageSize=${this.ctrl?.state.pageSize ?? 50}
          .sort=${this.ctrl?.state.sort}
          .sortDir=${this.ctrl?.state.dir ?? 'asc'}
          .searchable=${true}
          .searchPlaceholder=${'Buscar categoría o estación…'}
          .actions=${this.actions}
          .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin reglas: todo va a cocina por defecto.'}
          @rowAction=${(e: CustomEvent) => this.onRowAction(e)}
          @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)}
          @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)}
          @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)}
          @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}
        ></ok-data-table>
      </div>`;
  }
}

define('erp-printing-routing', ErpPrintingRouting);
