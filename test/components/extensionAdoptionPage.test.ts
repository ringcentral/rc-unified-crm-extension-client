import { loadModule } from '../helpers/loadModule';

async function loadPage() {
  vi.resetModules();
  return loadModule('../../src/components/admin/extensionAdoptionPage.ts');
}

const stats = { installedCount: 40, connectedCount: 30, lastActiveAt: '2026-09-21T08:15:30.000Z' };
const rcExtensions = Array.from({ length: 80 }, (_, index) => ({ id: `${100 + index}` }));

function metric(page, key) {
  return page.schema.properties.adoptionSummary.oneOf.find((item) => item.const === key);
}

describe('extension adoption page render', () => {
  it('renders three metric cards, percentages, and the last activity line', async () => {
    const page = await loadPage();
    const render = page.getExtensionAdoptionPageRender({ stats, rcExtensions });

    expect(render.id).toBe('extensionAdoptionPage');
    expect(render.type).toBe('page');
    expect(metric(render, 'rcUsers').value).toBe('80');
    expect(metric(render, 'installedCount').value).toBe('40');
    expect(metric(render, 'connectedCount').value).toBe('30');
    expect(render.uiSchema.adoptionSummary['ui:itemType']).toBe('metric');
    expect(render.uiSchema.adoptionSummary['ui:readonly']).toBe(true);
    // t() falls back to the key when translations are not loaded, so interpolation is asserted via formatPercentage
    expect(page.formatPercentage(40, 80)).toBe('50%');
    expect(page.formatPercentage(30, 40)).toBe('75%');
    expect(render.schema.properties.lastActiveAt).toBeDefined();
    expect(render.uiSchema.lastActiveAt['ui:field']).toBe('typography');
    expect(render.schema.properties.unsupported).toBeUndefined();
  });

  it('shows N/A for the RingCentral total when the directory is unavailable', async () => {
    const page = await loadPage();
    const render = page.getExtensionAdoptionPageRender({ stats, rcExtensions: null });

    expect(metric(render, 'rcUsers').value).toBe('pages.extensionAdoption.notAvailable');
    expect(page.formatPercentage(40, null)).toBe('pages.extensionAdoption.notAvailable');
  });

  it('uses N/A for the connected share when nothing is activated and hides the activity line', async () => {
    const page = await loadPage();
    const render = page.getExtensionAdoptionPageRender({
      stats: { installedCount: 0, connectedCount: 0, lastActiveAt: null },
      rcExtensions,
    });

    expect(page.formatPercentage(0, 0)).toBe('pages.extensionAdoption.notAvailable');
    expect(page.formatPercentage(0, 80)).toBe('0%');
    expect(render.schema.properties.lastActiveAt).toBeUndefined();
    expect(render.uiSchema.lastActiveAt).toBeUndefined();
  });

  it('ignores an unparsable lastActiveAt', async () => {
    const page = await loadPage();
    const render = page.getExtensionAdoptionPageRender({
      stats: { ...stats, lastActiveAt: 'not a date' },
      rcExtensions,
    });

    expect(render.schema.properties.lastActiveAt).toBeUndefined();
  });

  it('renders only an unsupported notice when the connector server has no stats', async () => {
    const page = await loadPage();
    const render = page.getExtensionAdoptionPageRender({ stats: null, rcExtensions });

    expect(Object.keys(render.schema.properties)).toEqual(['unsupported']);
    expect(render.uiSchema.unsupported).toEqual({ 'ui:field': 'admonition', 'ui:severity': 'warning' });
  });
});
