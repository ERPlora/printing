// Contrato de la BARRA de las reglas de enrutado de impresión.
//
// La vista es un CRUD de filas: la `ok-data-table` lista las REGLAS (categoría → estación) y el
// formulario las crea/edita (`printing.routing.set` es un upsert por categoría). El formulario
// estaba suelto ENCIMA de la tabla; en /employees y en `inventory` el alta vive DENTRO, detrás del
// «+» de la barra (panel `slot="create"`), y «editar» reabre ESE MISMO panel pre-rellenado.
//
// Además se fija lo que el SERVIDOR soporta: `printing.routing.list` solo declara filtro por
// `station` (op eq) en su module.json → `category` NO puede anunciarse como filtrable (el embudo
// pintaría un control que el runtime ignora).
import { beforeEach, describe, expect, it } from 'vitest';

const REGLA = { id: 'r1', category: 'Bebidas', station: 'bar', created_at: '2026-07-13' };

const comandos: { name: string; payload: Record<string, unknown> }[] = [];

beforeEach(() => {
  comandos.length = 0;
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => ({ rows: [REGLA], total: 1 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      comandos.push({ name, payload });
      return {};
    },
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

async function montar() {
  await import('./erp-printing-routing');
  const el = document.createElement('erp-printing-routing');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

const tabla = (el: HTMLElement & { shadowRoot: ShadowRoot }) =>
  el.shadowRoot.querySelector('ok-data-table') as
    | (HTMLElement & { addable: boolean; fill: boolean; open: (p?: string) => void; close: () => void })
    | null;

describe('el alta de la regla vive DENTRO de la tabla', () => {
  it('la tabla declara `addable` → pinta el «+» en su barra', async () => {
    const el = await montar();
    expect(tabla(el)?.addable, 'sin `addable` no hay «+» en la barra de la tabla').toBe(true);
  });

  it('la tabla llena el alto (`fill`)', async () => {
    const el = await montar();
    expect(tabla(el)?.fill).toBe(true);
  });

  it('el formulario se proyecta en el panel `create` de la tabla', async () => {
    const el = await montar();
    const form = el.shadowRoot.querySelector('form[slot="create"]');
    expect(form, 'el formulario de la regla no está en el slot `create`').toBeTruthy();
    expect(form?.closest('ok-data-table'), 'el formulario cuelga fuera de la tabla').toBeTruthy();
  });

  it('no queda NINGÚN control de alta suelto fuera de la tabla', async () => {
    const el = await montar();
    const sueltos = [...el.shadowRoot.querySelectorAll('form, ion-input, ion-select, ion-button')].filter(
      (n) => !n.closest('ok-data-table'),
    );
    expect(sueltos.map((n) => n.tagName.toLowerCase()), 'hay controles de alta fuera de la tabla').toEqual([]);
  });
});

describe('alta y edición usan el MISMO panel', () => {
  it('asignar manda printing.routing.set y cierra el panel', async () => {
    const el = await montar();
    const t = tabla(el)!;
    let cerrado = false;
    t.close = () => { cerrado = true; };

    const wc = el as unknown as { newCategory: string; newStation: string; setRule: (ev: Event) => Promise<void> };
    wc.newCategory = 'Postres';
    wc.newStation = 'kitchen';
    await wc.setRule(new Event('submit'));

    const alta = comandos.find((c) => c.name === 'printing.routing.set');
    expect(alta, 'no se mandó la regla de enrutado').toBeTruthy();
    expect(alta!.payload).toEqual({ category: 'Postres', station: 'kitchen' });
    expect(cerrado, 'el panel no se cerró tras asignar').toBe(true);
  });

  it('la acción «editar» de una fila ABRE el panel con la regla cargada', async () => {
    const el = await montar();
    const t = tabla(el)!;
    const abiertos: (string | undefined)[] = [];
    t.open = (p?: string) => { abiertos.push(p); };

    const wc = el as unknown as {
      onRowAction: (ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => void;
      newCategory: string; newStation: string;
    };
    wc.onRowAction(new CustomEvent('rowAction', { detail: { actionId: 'edit', row: REGLA } }));

    expect(abiertos, 'editar no abre el panel `create` de la tabla').toEqual(['create']);
    expect(wc.newCategory).toBe('Bebidas');
    expect(wc.newStation).toBe('bar');
  });
});

describe('los filtros solo anuncian lo que el servidor sabe filtrar', () => {
  it('la estación se filtra con un select (dominio cerrado receipt|kitchen|bar)', async () => {
    const el = await montar();
    const cols = (el as unknown as { columns: { key: string; filterType?: string; options?: { value: string }[] }[] }).columns;
    const est = cols.find((c) => c.key === 'station');
    expect(est?.filterType).toBe('select');
    expect(est?.options?.map((o) => o.value)).toEqual(['receipt', 'kitchen', 'bar']);
  });

  it('la categoría NO se anuncia como filtrable: `printing.routing.list` no la filtra', async () => {
    const el = await montar();
    const cols = (el as unknown as { columns: { key: string; filterable?: boolean }[] }).columns;
    const cat = cols.find((c) => c.key === 'category');
    expect(cat?.filterable, 'el embudo ofrecería un filtro de categoría que el runtime ignora').toBeFalsy();
  });

  it('cambiar filas/página (`pageSizeChange`) llega al controlador', async () => {
    const el = await montar();
    tabla(el)!.dispatchEvent(new CustomEvent('pageSizeChange', { detail: 25 }));
    const wc = el as unknown as { ctrl: { state: { pageSize: number } } };
    expect(wc.ctrl.state.pageSize, 'la tabla no está escuchando `pageSizeChange`').toBe(25);
  });
});
