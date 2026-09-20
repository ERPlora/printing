// The receipt text is configured in ONE place, and this screen is not it (printing#44).
//
// Until hub#1921 the ticket that came out on its own at checkout was built by the shell from
// `printing.settings.get` → `receipt_header`/`receipt_footer`. Since then BOTH papers — the
// automatic one and the one the print button sends — are the sales viewer's document, which reads
// `sales.pos_settings.get`. So these two boxes stopped reaching any paper: a shop typed its
// branding here, pressed Save, got a success, and its ticket kept coming out with the legal name.
//
// What this pins:
//
//   1. The two boxes are GONE, and in their place the screen names the one place the ticket is
//      configured — the way Square, Shopify POS and Loyverse all do it: one «Receipts» screen.
//   2. The text a shop typed here is not lost: while it is stranded and Sales has none, the screen
//      shows it and offers to move it over, in one press.
//   3. It never overwrites what the shop wrote in Sales — with Sales configured there is nothing
//      to offer, only the way there.
//   4. When the move cannot be made (Sales is not installed, the till settings are somebody
//      else's to change), the text stays ON SCREEN with the reason, so it can be copied by hand.
//      A migration that fails silently is how the text is lost for good.
//   5. The test sheet takes the business name from the same place the TICKET takes it
//      (`sales.pos_settings.get` → first line of `receipt_header`, and the legal name when there
//      is none) instead of from a field no paper reads.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PRINTING_DEFAULTS = {
  receipt_header: '',
  receipt_footer: '',
  paper_width: 80,
  auto_print_on_sale: 1,
  open_drawer_on_sale: 0,
  print_kitchen: 0,
};

const PRINTER = {
  id: 'network:192.168.1.50:9100',
  name: 'EPSON TM-T20',
  type: 'thermal',
  status: 'online',
  paper_width: 80,
};

interface Call {
  name: string;
  payload: unknown;
}

interface Bench {
  calls: Call[];
  testPrints: { printerId: string; envelope: Record<string, unknown> }[];
  salesSettings: { receipt_header: string; receipt_footer: string } | null;
  failAdoptWith?: { message: string; code: string };
  /** The command answers, and changes nothing: an older `sales` without the door, or one whose
   *  receipt was filled in between the offer and the press. */
  adoptDoesNothing?: boolean;
}

let bench: Bench;

/** The shell's client, answering each door by NAME — a single stubbed answer for every query is
 *  how a screen that reads the wrong door still passes. */
function mountWith(options: {
  printing?: Partial<typeof PRINTING_DEFAULTS>;
  sales?: { receipt_header: string; receipt_footer: string } | null;
  business?: { name: string } | null;
  salesInstalled?: boolean;
  /** Sales IS in this hub and refuses the read: `queryOptional` forgives an ABSENT module and
   *  nothing else, so a denied permission or a broken handler REJECTS (module-sdk, ADR-0127). */
  salesReadFailsWith?: { message: string; code: string };
  failAdoptWith?: { message: string; code: string };
  adoptDoesNothing?: boolean;
  printers?: (typeof PRINTER)[];
}) {
  const salesInstalled = options.salesInstalled ?? true;
  bench = {
    calls: [],
    testPrints: [],
    salesSettings: options.sales === undefined ? { receipt_header: '', receipt_footer: '' } : options.sales,
    failAdoptWith: options.failAdoptWith,
    adoptDoesNothing: options.adoptDoesNothing,
  };
  const runCommand = (name: string, payload: unknown): unknown => {
    bench.calls.push({ name, payload });
    if (name === 'sales.settings.adopt_receipt_text') {
      if (bench.failAdoptWith) {
        const e = new Error(bench.failAdoptWith.message) as Error & { code: string };
        e.code = bench.failAdoptWith.code;
        throw e;
      }
      if (bench.adoptDoesNothing) return {};
      // The real command fills ONLY what is empty there, per field: the bench has to do the same,
      // or a screen that offered to overwrite would still look green here.
      const p = payload as { receipt_header?: string; receipt_footer?: string };
      const current = bench.salesSettings ?? { receipt_header: '', receipt_footer: '' };
      bench.salesSettings = {
        receipt_header: current.receipt_header.trim() === '' ? p.receipt_header ?? '' : current.receipt_header,
        receipt_footer: current.receipt_footer.trim() === '' ? p.receipt_footer ?? '' : current.receipt_footer,
      };
    }
    return {};
  };
  const salesQuery = (name: string): unknown => {
    // `queryOptional` answers `undefined` for an app that is not in this hub (ADR-0400/ADR-0127) —
    // never an empty array, which is what «installed and nothing configured» looks like.
    if (!salesInstalled) return undefined;
    if (options.salesReadFailsWith) {
      const e = new Error(options.salesReadFailsWith.message) as Error & { code: string };
      e.code = options.salesReadFailsWith.code;
      throw e;
    }
    if (name === 'sales.pos_settings.get') return bench.salesSettings ? [bench.salesSettings] : [];
    if (name === 'sales.business.get') return options.business ? [options.business] : [];
    return [];
  };
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'printing.settings.get') return [{ ...PRINTING_DEFAULTS, ...(options.printing ?? {}) }];
      if (name.startsWith('sales.')) throw new Error(`\`${name}\` is an OPTIONAL read: it goes through queryOptional`);
      return [];
    },
    queryOptional: async (name: string) => salesQuery(name),
    commandOptional: async (name: string, payload: unknown) => {
      if (!salesInstalled) return undefined;
      return runCommand(name, payload);
    },
    command: async (name: string, payload: unknown) => runCommand(name, payload),
    forModule: () => ({ printQueue: { retry: async () => ({}), discard: async () => ({}) } }),
    hasPermission: () => true,
    peripherals: {
      detect: async () => ({ online: true, version: '1.1.28' }),
      discoverPrinters: async () => options.printers ?? [],
      getDevices: async () => [],
      setDeviceRole: async () => [],
      testPrint: async (printerId: string, envelope: Record<string, unknown>) => {
        bench.testPrints.push({ printerId, envelope });
        return {};
      },
    },
    locale: 'es',
    t: (catalog: Record<string, { ui: Record<string, string> }>, key: string) => {
      const [, k] = key.split('.');
      return catalog.es?.ui?.[k] ?? key;
    },
  };
}

type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mount(): Promise<Mounted> {
  await import('./erp-printing-settings');
  const el = document.createElement('erp-printing-settings') as Mounted;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

async function settle(el: Mounted): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
  await el.updateComplete;
}

// The selector interpolates through `JSON.stringify` and not inside the quotes on purpose: the
// module's own hook guard (`ui/testids.test.ts` §4) refuses the quoted-binding spelling anywhere in
// the tree, including a comment that merely shows it.
const byId = (el: Mounted, id: string): HTMLElement | null =>
  el.shadowRoot.querySelector(`[data-testid=${JSON.stringify(id)}]`);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the two boxes that reached no paper', () => {
  beforeEach(() => mountWith({ printing: { receipt_header: 'Bar Manolo', receipt_footer: 'Gracias' } }));

  it('are not on this screen any more', async () => {
    const el = await mount();
    expect(byId(el, 'printing-receipt-header'), 'the header box still writes to a field no ticket reads').toBeNull();
    expect(byId(el, 'printing-receipt-footer'), 'the footer box still writes to a field no ticket reads').toBeNull();
  });

  it('and the screen points at the one place the ticket is configured', async () => {
    const el = await mount();
    const link = byId(el, 'printing-receipt-settings-link');
    expect(link, 'nothing on this screen says where the receipt is configured').not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/m/sales/settings');
  });
});

describe('the text a shop already typed here', () => {
  it('is shown and moved over in one press, when Sales has none', async () => {
    mountWith({
      printing: { receipt_header: 'Bar Manolo\nC/ Mayor 1', receipt_footer: 'Gracias por su visita' },
      sales: { receipt_header: '', receipt_footer: '' },
    });
    const el = await mount();
    const offer = byId(el, 'printing-receipt-text-pending');
    expect(offer, 'the stranded text is not offered anywhere').not.toBeNull();
    expect(offer?.textContent ?? '').toContain('Bar Manolo');

    const move = byId(el, 'printing-receipt-text-move') as HTMLElement;
    expect(move, 'there is no way to move the text over').not.toBeNull();
    move.click();
    await settle(el);

    expect(bench.calls.map((c) => c.name)).toContain('sales.settings.adopt_receipt_text');
    expect(bench.calls.find((c) => c.name === 'sales.settings.adopt_receipt_text')?.payload).toEqual({
      receipt_header: 'Bar Manolo\nC/ Mayor 1',
      receipt_footer: 'Gracias por su visita',
    });
    expect(byId(el, 'printing-receipt-text-moved'), 'the move said nothing').not.toBeNull();
    expect(byId(el, 'printing-receipt-text-move'), 'the offer is still there after the move').toBeNull();
  });

  it('is never offered on top of what the shop wrote in Sales', async () => {
    mountWith({
      printing: { receipt_header: 'Plantilla Demo', receipt_footer: '' },
      sales: { receipt_header: 'Peluquería Aurora', receipt_footer: '' },
    });
    const el = await mount();
    expect(byId(el, 'printing-receipt-text-move'), 'it offers to overwrite the shop’s own receipt').toBeNull();
    expect(byId(el, 'printing-receipt-settings-link'), 'and the way there is gone too').not.toBeNull();
  });

  it('stays on screen with the reason when the move cannot be made', async () => {
    mountWith({
      printing: { receipt_header: 'Bar Manolo', receipt_footer: '' },
      sales: { receipt_header: '', receipt_footer: '' },
      failAdoptWith: { message: 'permission denied', code: 'permission_denied' },
    });
    const el = await mount();
    (byId(el, 'printing-receipt-text-move') as HTMLElement).click();
    await settle(el);
    const failed = byId(el, 'printing-receipt-text-error');
    expect(failed, 'a move that failed said nothing at all').not.toBeNull();
    expect(failed?.textContent ?? '').toContain('permission_denied');
    expect(byId(el, 'printing-receipt-text-pending')?.textContent ?? '', 'the text to copy is gone').toContain('Bar Manolo');
  });

  it('does not claim to have moved text the till settings did not take', async () => {
    // The command answered and wrote nothing — an older `sales` without the door, or a receipt
    // filled in between the offer and the press. Believing the CALL instead of the re-read would
    // tell somebody their text is safe while it is still stranded here.
    mountWith({
      printing: { receipt_header: 'Bar Manolo', receipt_footer: '' },
      sales: { receipt_header: '', receipt_footer: '' },
      adoptDoesNothing: true,
    });
    const el = await mount();
    (byId(el, 'printing-receipt-text-move') as HTMLElement).click();
    await settle(el);
    expect(byId(el, 'printing-receipt-text-moved'), 'it says the text was moved, and it was not').toBeNull();
    expect(byId(el, 'printing-receipt-text-error')?.textContent ?? '').toContain('receipt_text_not_applied');
    expect(byId(el, 'printing-receipt-text-pending')?.textContent ?? '').toContain('Bar Manolo');
  });

  it('is still shown, with no way out, when there is no Sales app to move it to', async () => {
    mountWith({ printing: { receipt_header: 'Bar Manolo', receipt_footer: '' }, salesInstalled: false });
    const el = await mount();
    expect(byId(el, 'printing-receipt-text-move'), 'it offers to move text into an app that is not here').toBeNull();
    expect(byId(el, 'printing-receipt-settings-link'), 'it links to a screen that does not exist here').toBeNull();
    expect(
      byId(el, 'printing-receipt-text-pending')?.textContent ?? '',
      'the text vanished from the only screen it was ever on',
    ).toContain('Bar Manolo');
  });
});

// `printing` does NOT depend on `sales` (printing#44): whatever Sales does — absent, or present and
// refusing — the Printers screen keeps doing its own job. The cases above look at the receipt
// block; these look at everything ELSE, which is what a hard dependency would take down: the read
// of Sales is awaited before the hardware is probed, so a rejection that escaped it would leave
// the printer list empty and the screen half-loaded.
describe('the rest of the screen does not need Sales', () => {
  const SALES_STATES = [
    { label: 'is not in this hub', options: { salesInstalled: false } },
    {
      label: 'refuses the read (a manager of printers who may not see the till settings)',
      options: { salesReadFailsWith: { message: 'permission denied', code: 'permission_denied' } },
    },
  ];

  for (const { label, options } of SALES_STATES) {
    it(`lists the printers and saves its own settings when Sales ${label}`, async () => {
      mountWith({
        printing: { receipt_header: 'Bar Manolo', receipt_footer: 'Gracias', paper_width: 58 },
        printers: [PRINTER],
        ...options,
      });
      const el = await mount();

      expect(el.shadowRoot.textContent ?? '', 'the hardware was never probed').toContain(PRINTER.name);
      expect(byId(el, 'printing-receipt-settings-link'), 'it links to a screen it could not read').toBeNull();
      expect(byId(el, 'printing-receipt-text-move'), 'it offers a move it cannot check').toBeNull();
      expect(
        byId(el, 'printing-receipt-text-pending')?.textContent ?? '',
        'the text vanished from the only screen it was ever on',
      ).toContain('Bar Manolo');

      (byId(el, 'printing-settings-save') as HTMLElement).click();
      await settle(el);
      expect(byId(el, 'printing-settings-saved'), 'saving broke with Sales out of reach').not.toBeNull();
      const saved = bench.calls.find((c) => c.name === 'printing.settings.update');
      // Exactly what this screen still owns — and never the stranded text, which the door would
      // ignore today and an older module version would blank or overwrite.
      expect(saved?.payload).toEqual({
        paper_width: 58,
        auto_print_on_sale: 1,
        open_drawer_on_sale: 0,
        print_kitchen: 0,
      });
    });
  }
});

describe('the test sheet is signed the way the ticket is', () => {
  it('takes the business name from the receipt Sales prints', async () => {
    mountWith({
      printing: { receipt_header: 'Nombre viejo de Impresión' },
      sales: { receipt_header: 'Bar Manolo\nC/ Mayor 1', receipt_footer: '' },
      printers: [PRINTER],
    });
    const el = await mount();
    (byId(el, `printing-printer-${PRINTER.id}-test`) as HTMLElement).click();
    await settle(el);
    expect(bench.testPrints).toHaveLength(1);
    expect(bench.testPrints[0].envelope.business_name).toBe('Bar Manolo');
  });

  it('falls back to the legal name, which is what the ticket prints with no header', async () => {
    mountWith({
      sales: { receipt_header: '', receipt_footer: '' },
      business: { name: 'Manolo Pérez SL' },
      printers: [PRINTER],
    });
    const el = await mount();
    (byId(el, `printing-printer-${PRINTER.id}-test`) as HTMLElement).click();
    await settle(el);
    expect(bench.testPrints[0].envelope.business_name).toBe('Manolo Pérez SL');
  });

  it('is left unsigned when there is no Sales app to ask', async () => {
    mountWith({ salesInstalled: false, printers: [PRINTER] });
    const el = await mount();
    (byId(el, `printing-printer-${PRINTER.id}-test`) as HTMLElement).click();
    await settle(el);
    expect(bench.testPrints[0].envelope).not.toHaveProperty('business_name');
  });
});
