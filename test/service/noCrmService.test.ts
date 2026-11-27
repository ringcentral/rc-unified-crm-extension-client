import { loadModule } from '../helpers/loadModule';
import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadNoCrmService() {
  vi.resetModules();
  return loadModule('../../src/service/noCrmService.ts');
}

describe('noCrmService', () => {
  it('defaults to false and persists the choice until cleared', async () => {
    const service = await loadNoCrmService();

    expect(await service.getNoCrmChosen()).toBe(false);
    await service.setNoCrmChosen();
    expect(readStorage().noCrmChosen).toBe(true);
    expect(await service.getNoCrmChosen()).toBe(true);
    await service.clearNoCrmChosen();
    expect(await service.getNoCrmChosen()).toBe(false);
  });

  it('only treats a literal true as chosen', async () => {
    seedStorage({ noCrmChosen: 'yes' });
    const service = await loadNoCrmService();

    expect(await service.getNoCrmChosen()).toBe(false);
  });

  it('builds the survey url with hidden RingCentral ids prefilled', async () => {
    const service = await loadNoCrmService();

    const url = new URL(service.getNoCrmSurveyUrl({ rcAccountId: 111, rcExtensionId: '222' }));

    expect(url.origin + url.pathname).toBe('https://docs.google.com/forms/d/e/1FAIpQLSfUcyZtneMBlCTw2sXlm8LQOZmUeX6lHZEyMKQSOfib_O-QNg/viewform');
    expect(url.searchParams.get('entry.1862074204')).toBe('111');
    expect(url.searchParams.get('entry.23574002')).toBe('222');
  });

  it('leaves the ids empty when the RingCentral identity is unavailable', async () => {
    const service = await loadNoCrmService();

    const url = new URL(service.getNoCrmSurveyUrl({}));

    expect(url.searchParams.get('entry.1862074204')).toBe('');
    expect(url.searchParams.get('entry.23574002')).toBe('');
  });
});
