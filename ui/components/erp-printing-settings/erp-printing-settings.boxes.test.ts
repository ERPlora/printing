// printing#50 — every field of the printing settings shows its BOX.
//
// The Hub shell pins `mode: 'ios'` (ADR-0143), and there Ionic never paints `fill` on
// ion-input/ion-select/ion-textarea: a control with no `fill` renders as loose text with no border.
// The IP and port of «Add printer», the paper width and the role of each printer were exactly that,
// so the owner could not see where to type nor that the value could be changed. The combination
// that paints on its own is `fill="outline" mode="md"`, the convention of the shell (hub#760) and of
// the modules swept by ERPlora/pm#152 — and the one the module-toolkit ratchet asks for (pm#479).
import { beforeEach, describe, expect, it } from 'vitest';

const SETTINGS = {
  receipt_header: '', receipt_footer: '', paper_width: 80,
  auto_print_on_sale: 1, open_drawer_on_sale: 0, print_kitchen: 0,
};

const PRINTER = {
  id: 'network:192.168.1.50:9100',
  name: 'Counter printer',
  type: 'network',
  status: 'ready',
  paper_width: 80,
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => (name === 'printing.settings.get' ? [SETTINGS] : []),
    queryOptional: async () => undefined,
    commandOptional: async () => undefined,
    command: async () => ({}),
    hasPermission: () => true,
    forModule: () => ({ printQueue: { retry: async () => ({}), discard: async () => ({}) } }),
    peripherals: {
      detect: async () => ({ online: true, version: '1.2.0' }),
      discoverPrinters: async () => [PRINTER],
      getDevices: async () => [],
      setDeviceRole: async () => [],
      testPrint: async () => undefined,
      addNetworkPrinter: async () => PRINTER,
    },
    locale: 'en',
    t: (_catalog: unknown, key: string) => key,
  };
});

type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function settle(el: Mounted): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

async function mountWithAddFormOpen(): Promise<Mounted> {
  await import('./erp-printing-settings');
  document.body.innerHTML = '';
  const el = document.createElement('erp-printing-settings') as Mounted;
  document.body.appendChild(el);
  await settle(el);
  const open = el.shadowRoot.querySelector<HTMLElement>('[data-testid="printing-add-printer-open"]');
  expect(open, 'the «Add printer» button is on the screen').toBeTruthy();
  open!.click();
  await settle(el);
  return el;
}

function expectBox(f: Element): void {
  const id = f.getAttribute('data-testid') ?? f.tagName;
  expect(f.getAttribute('fill'), `${id}: no fill → no box in ios mode`).toBe('outline');
  expect(f.getAttribute('mode'), `${id}: fill without mode="md" never paints in ios mode`).toBe('md');
}

describe('printing settings: every field has its box in ios mode (printing#50)', () => {
  it('the IP, the port, the paper width and the role of a printer are boxed', async () => {
    const el = await mountWithAddFormOpen();
    for (const id of [
      'printing-add-printer-ip',
      'printing-add-printer-port',
      'printing-paper-width',
      `printing-printer-${PRINTER.id}-role`,
    ]) {
      const f = el.shadowRoot.querySelector(`[data-testid=${JSON.stringify(id)}]`);
      expect(f, `${id} is on the screen`).not.toBeNull();
      expectBox(f!);
    }
  });

  it('every control on the screen, with a printer listed and the add form open', async () => {
    const el = await mountWithAddFormOpen();
    const fields = [...el.shadowRoot.querySelectorAll('ion-input, ion-select, ion-textarea')];
    expect(fields.length, 'the walk sees the four fields').toBeGreaterThanOrEqual(4);
    for (const f of fields) expectBox(f);
  });
});
