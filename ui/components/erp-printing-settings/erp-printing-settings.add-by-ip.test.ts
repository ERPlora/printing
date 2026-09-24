// Adding a printer by typing its IP when the scan cannot see it (hub#1924).
//
// The scan only sweeps this device's own subnet and mDNS stops at the router: a printer on another
// subnet or an isolated guest Wi-Fi never appears, and the owner — who has its address on the
// printer's own configuration sheet — had nowhere to type it. Every POS offers this (Square «Add
// printer → Network → IP address», Loyverse, Toast, Odoo). These pin the flow the owner walks:
// open the form, type the IP, keep 9100, add — and the printer is in the list and has printed its
// test page; or, when it does not answer, a sentence in their language that says so.
import { beforeEach, describe, expect, it } from 'vitest';

import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

const SETTINGS = {
  receipt_header: '', receipt_footer: '', paper_width: 80,
  auto_print_on_sale: 1, open_drawer_on_sale: 0, print_kitchen: 0,
};

const ES = (esLocale as { ui: Record<string, string> }).ui;
const EN = (enLocale as { ui: Record<string, string> }).ui;

const TYPED = {
  id: 'network:192.168.100.243:9100',
  name: 'Network Printer (192.168.100.243)',
  type: 'network',
  status: 'ready',
  paper_width: 80,
};

interface Bench {
  added: { host: string; port?: number }[];
  testPrints: string[];
}

/** An `erplora` whose app finds NOTHING on the scan, and answers the typed address with `answer`. */
function mountWith(
  answer: ((host: string, port?: number) => Promise<unknown>) | undefined,
  online = true,
): Bench {
  const bench: Bench = { added: [], testPrints: [] };
  const peripherals: Record<string, unknown> = {
    detect: async () => ({ online, version: online ? '1.2.0' : undefined }),
    discoverPrinters: async () => [],
    getDevices: async () => [],
    setDeviceRole: async () => [],
    testPrint: async (printerId: string) => {
      bench.testPrints.push(printerId);
    },
  };
  if (answer) {
    peripherals.addNetworkPrinter = async (host: string, port?: number) => {
      bench.added.push({ host, port });
      return answer(host, port);
    };
  }
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => (name === 'printing.settings.get' ? [SETTINGS] : []),
    queryOptional: async () => undefined,
    commandOptional: async () => undefined,
    command: async () => ({}),
    hasPermission: () => true,
    forModule: () => ({ printQueue: { retry: async () => ({}), discard: async () => ({}) } }),
    peripherals,
    locale: 'es',
    t: (catalog: Record<string, { ui: Record<string, string> }>, key: string, params?: Record<string, unknown>) => {
      const [, k] = key.split('.');
      let text = catalog.es?.ui?.[k] ?? key;
      for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
      return text;
    },
  };
  return bench;
}

type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function settle(el: Mounted): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

async function mount(): Promise<Mounted> {
  await import('./erp-printing-settings');
  document.body.innerHTML = '';
  const el = document.createElement('erp-printing-settings') as Mounted;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const byTestId = (el: Mounted, id: string) => el.shadowRoot.querySelector<HTMLElement>(`[data-testid=${JSON.stringify(id)}]`);

function type(el: Mounted, id: string, value: string): void {
  const input = byTestId(el, id);
  expect(input, `no «${id}» on the form`).toBeTruthy();
  input!.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
}

/** Opens the form, types the address and presses «Add» — what the owner does. */
async function addByIp(el: Mounted, ip: string, port?: string): Promise<void> {
  byTestId(el, 'printing-add-printer-open')!.click();
  await settle(el);
  type(el, 'printing-add-printer-ip', ip);
  if (port !== undefined) type(el, 'printing-add-printer-port', port);
  await settle(el);
  byTestId(el, 'printing-add-printer-submit')!.click();
  await settle(el);
}

describe('a printer the scan does not find can be added by typing its IP (hub#1924)', () => {
  let bench: Bench;

  describe('the printer answers', () => {
    beforeEach(() => {
      bench = mountWith(async () => TYPED);
    });

    it('offers the way in right under the empty result of the scan', async () => {
      const el = await mount();
      expect(byTestId(el, 'printing-hardware-empty'), 'the scan found nothing').toBeTruthy();
      expect(byTestId(el, 'printing-add-printer-open')).toBeTruthy();
      expect(byTestId(el, 'printing-add-printer-form'), 'the form opens on demand').toBeNull();
    });

    it('adds it on 9100 by default, lists it and prints its test page', async () => {
      const el = await mount();
      await addByIp(el, ' 192.168.100.243 ');

      expect(bench.added).toEqual([{ host: '192.168.100.243', port: 9100 }]);
      expect(byTestId(el, `printing-printer-${TYPED.id}`), 'the added printer is not in the list').toBeTruthy();
      expect(bench.testPrints, 'added but not tested').toEqual([TYPED.id]);
      expect(byTestId(el, 'printing-add-printer-added')?.textContent).toContain(ES.addPrinterAdded);
      expect(byTestId(el, 'printing-add-printer-error')).toBeNull();
      expect(byTestId(el, 'printing-add-printer-form'), 'the form closes once it worked').toBeNull();
    });

    it('sends the port the owner typed', async () => {
      const el = await mount();
      await addByIp(el, '192.168.100.243', '9101');
      expect(bench.added).toEqual([{ host: '192.168.100.243', port: 9101 }]);
    });

    it('refuses a port that is not one before asking the app', async () => {
      const el = await mount();
      for (const bad of ['0', '70000', 'abc', '91.5']) {
        await addByIp(el, '192.168.100.243', bad);
        expect(byTestId(el, 'printing-add-printer-error')?.textContent, bad).toContain(ES.errAddPrinterAddress);
        byTestId(el, 'printing-add-printer-cancel')!.click();
        await settle(el);
      }
      expect(bench.added).toEqual([]);
    });
  });

  it('says in the user language that nobody answered, and does not list it', async () => {
    bench = mountWith(async () => {
      throw Object.assign(new Error('192.168.100.243:9100: connection refused'), { code: 'printer_unreachable' });
    });
    const el = await mount();
    await addByIp(el, '192.168.100.243');

    const error = byTestId(el, 'printing-add-printer-error')?.textContent ?? '';
    expect(error).toContain(ES.errAddPrinterUnreachable.replace('{address}', '192.168.100.243:9100'));
    expect(error, 'the raw log message is not what the owner reads').not.toContain('connection refused');
    expect(byTestId(el, `printing-printer-${TYPED.id}`)).toBeNull();
    expect(bench.testPrints).toEqual([]);
    expect(byTestId(el, 'printing-add-printer-form'), 'the form stays open to fix it').toBeTruthy();
  });

  it('tells a typo apart from a printer that did not answer', async () => {
    bench = mountWith(async () => {
      throw Object.assign(new Error('not an IPv4 address'), { code: 'invalid_printer_address' });
    });
    const el = await mount();
    await addByIp(el, '192.168.100');

    expect(byTestId(el, 'printing-add-printer-error')?.textContent).toContain(ES.errAddPrinterAddress);
  });

  it('any other refusal still says something, never nothing', async () => {
    bench = mountWith(async () => {
      throw Object.assign(new Error('Command erplora_add_network_printer not found'), { code: 'printer_add_failed' });
    });
    const el = await mount();
    await addByIp(el, '192.168.100.243');

    expect(byTestId(el, 'printing-add-printer-error')?.textContent).toContain(ES.errAddPrinter);
  });

  it('is not offered where it cannot work: an older hub SDK, or no app on this device', async () => {
    mountWith(undefined);
    expect(byTestId(await mount(), 'printing-add-printer-open')).toBeNull();

    mountWith(async () => TYPED, false);
    expect(byTestId(await mount(), 'printing-add-printer-open')).toBeNull();
  });

  it('every new sentence exists in English (the source) and in Spanish', () => {
    for (const key of [
      'addPrinterByIp', 'addPrinterIp', 'addPrinterPort', 'addPrinterSubmit', 'addPrinterAdding',
      'addPrinterAdded', 'addPrinterHint', 'errAddPrinterAddress', 'errAddPrinterUnreachable', 'errAddPrinter',
    ]) {
      expect(EN[key], `en.${key}`).toBeTruthy();
      expect(ES[key], `es.${key}`).toBeTruthy();
      expect(ES[key], `es.${key} is not translated`).not.toBe(EN[key]);
    }
  });
});
