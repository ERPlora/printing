// What the printing settings tell the user when there is no hardware on this device.
//
// The advice used to be «the Bridge is not running on this device — install and start it». The
// standalone Bridge is dead by decision (ADR-0196 §3) and its binary is being removed (hub#340):
// there is nothing left to install or to start. Following that sentence leads nowhere while the
// POS is not printing — the same failure mode as hub#338, where showing another state's message
// sent the user to fix something that was never broken.
//
// The sentence that has a next step in it names the app, and it must be the SAME one the shell
// already shows (`hardware.unavailable` in apps/web): two different explanations of one situation
// is how a user learns not to trust either.
import { beforeEach, describe, expect, it } from 'vitest';

import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

const SETTINGS = {
  receipt_header: '', receipt_footer: '', paper_width: 80,
  auto_print_on_sale: 1, open_drawer_on_sale: 0, print_kitchen: 0,
};

/** `detect()` answering `{online:false}` IS the browser-without-the-app case (ADR-0196 §3). */
function mountWith(online: boolean) {
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => SETTINGS,
    command: async () => ({}),
    peripherals: {
      detect: async () => ({ online, version: online ? '1.0.0' : undefined }),
      discoverPrinters: async () => [],
      getDevices: async () => [],
    },
    locale: 'es',
    // Resolve for real against the shipped catalog: asserting on a key that returns the key would
    // pass no matter what the text says.
    t: (catalog: Record<string, { ui: Record<string, string> }>, key: string) => {
      const [, k] = key.split('.');
      return catalog.es?.ui?.[k] ?? key;
    },
  };
}

async function montar() {
  await import('./erp-printing-settings');
  const el = document.createElement('erp-printing-settings');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

const catalogs = { es: (esLocale as { ui: Record<string, string> }).ui, en: (enLocale as { ui: Record<string, string> }).ui };

describe('no hardware on this device: the advice has to be followable', () => {
  beforeEach(() => mountWith(false));

  it('tells the user to install the app, and never mentions the Bridge', async () => {
    const el = await montar();
    const texto = el.shadowRoot.textContent ?? '';
    expect(texto.toLowerCase(), 'the settings still advertise the Bridge, which no longer exists').not.toContain('bridge');
    expect(texto).toMatch(/app de ERPlora/i);
  });
});

describe('the catalog says the same thing the shell says', () => {
  it('no catalog string mentions the Bridge in any language', () => {
    for (const [lang, ui] of Object.entries(catalogs)) {
      const culpables = Object.entries(ui).filter(([, v]) => /bridge/i.test(String(v)));
      expect(culpables, `«${lang}» still names the Bridge in: ${culpables.map(([k]) => k).join(', ')}`).toEqual([]);
    }
  });

  it('the unavailable advice names the app and where to open the business, in both languages', () => {
    expect(catalogs.en.hardwareUnavailable).toMatch(/install the ERPlora app/i);
    expect(catalogs.es.hardwareUnavailable).toMatch(/instala la app de ERPlora/i);
  });

  it('every English key has its Spanish translation — English is the source (ADR-0055/0199)', () => {
    expect(Object.keys(catalogs.es).sort()).toEqual(Object.keys(catalogs.en).sort());
  });
});

// printing#17: «Route orders to kitchen/bar» (`print_kitchen`) is a DEAD control since ADR-0144 —
// the kitchen ticket fires from the order, routed by `kitchen`'s stations, and nobody reads that
// setting. A switch that promises a behaviour that does not exist has to leave the screen.
describe('the dead «route to kitchen» switch is gone (ADR-0144, printing#17)', () => {
  beforeEach(() => mountWith(false));

  it('renders exactly two toggles: print receipt + open drawer on checkout', async () => {
    const el = await montar();
    const toggles = Array.from(el.shadowRoot.querySelectorAll('ion-toggle'));
    expect(toggles).toHaveLength(2);
    const text = el.shadowRoot.textContent ?? '';
    expect(text).not.toMatch(/cocina\/barra|kitchen\/bar/i);
  });

  it('the i18n key `ui.routeToKitchen` is removed from both catalogs', () => {
    expect(catalogs.en).not.toHaveProperty('routeToKitchen');
    expect(catalogs.es).not.toHaveProperty('routeToKitchen');
  });
});

// printing#17 §1: the three `.row` toggles rendered flush against each other (no vertical gap),
// reading as one overlapped block. happy-dom does not lay out, so the contract is fixed on the
// stylesheet: `.row` carries the same bottom margin as `.field`.
describe('the setting rows are vertically separated (printing#17)', () => {
  it('`.row` declares a margin-bottom like `.field` does', async () => {
    const mod = await import('./erp-printing-settings');
    const cssText = String((mod.ErpPrintingSettings as unknown as { styles: { cssText: string } }).styles.cssText);
    const row = cssText.match(/\.row\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(row, '`.row` has no margin-bottom: the toggles stack flush').toMatch(/margin-bottom\s*:/);
  });
});
