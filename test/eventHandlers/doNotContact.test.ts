import enUS from '../../src/i18n/locales/en-US.json';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

function mockEnglishTranslations() {
  vi.doMock('../../src/i18n', () => ({
    t: (key: string, params: Record<string, string> = {}) => String(
      key.split('.').reduce((node: any, part) => node?.[part], enUS) ?? key,
    ).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? ''),
  }));
}

async function loadHandler() {
  vi.resetModules();
  mockEnglishTranslations();
  return loadModule('../../src/eventHandlers/rc-post-message-request/doNotContact.ts');
}

function lastResponse() {
  const responses = getWidgetPostMessages()
    .map(({ message }) => message)
    .filter((message) => message.type === 'rc-post-message-response');
  expect(responses).toHaveLength(1);
  return responses[0];
}

function callRequest(phoneNumber: string) {
  return { requestId: 'req-1', path: '/doNotContact', body: { actionType: 'call', phoneNumber } };
}

function smsRequest(...phoneNumbers: string[]) {
  return {
    requestId: 'req-1',
    path: '/doNotContact',
    body: { actionType: 'sms', recipients: phoneNumbers.map((phoneNumber) => ({ phoneNumber })) },
  };
}

function seedLists({ restrict = [], warn = [], region = 'US' }: { restrict?: string[]; warn?: string[]; region?: string } = {}) {
  seedStorage({
    selectedRegion: region,
    userSettings: {
      doNotContactRestrictNumbers: { value: restrict },
      doNotContactWarnNumbers: { value: warn },
    },
  });
}

describe('/doNotContact handler', () => {
  it('allows the action when no lists are configured', async () => {
    seedStorage({ userSettings: {} });
    const handler = await loadHandler();

    await handler.onEvent({ data: callRequest('+14155552671') });

    expect(lastResponse()).toEqual({
      type: 'rc-post-message-response',
      responseId: 'req-1',
      response: { data: { result: false } },
    });
  });

  it('restricts a call to a number on the block list', async () => {
    seedLists({ restrict: ['(415) 555-2671'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: callRequest('+14155552671') });

    expect(lastResponse().response).toEqual({
      data: {
        result: true,
        mode: 'restrict',
        message: "This number is on your organization's Do Not Contact list.",
      },
    });
  });

  it('warns without a restrict mode for a number on the warn list', async () => {
    seedLists({ warn: ['+1415*'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: callRequest('+14155552671') });

    expect(lastResponse().response).toEqual({
      data: {
        result: true,
        message: 'This number is on a Do Not Contact warning list. Do you want to continue?',
      },
    });
  });

  it('allows a call to a number that is on neither list', async () => {
    seedLists({ restrict: ['+16505550100'], warn: ['+1212*'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: callRequest('+14155552671') });

    expect(lastResponse().response).toEqual({ data: { result: false } });
  });

  it('restricts an SMS when any recipient is blocked and names only the blocked numbers', async () => {
    seedLists({ restrict: ['+16505550100', '+16505550101'], warn: ['+14155552671'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: smsRequest('+14155552671', '+16505550100', '+16505550101') });

    expect(lastResponse().response).toEqual({
      data: {
        result: true,
        mode: 'restrict',
        message: "These numbers are on your organization's Do Not Contact list: +16505550100, +16505550101",
      },
    });
  });

  it('warns for an SMS when recipients are only on the warn list', async () => {
    seedLists({ warn: ['+14155552671'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: smsRequest('+16505550100', '+14155552671') });

    expect(lastResponse().response).toEqual({
      data: {
        result: true,
        message: 'This number is on a Do Not Contact warning list. Do you want to continue?',
      },
    });
  });

  it('reads national numbers using the selected region', async () => {
    seedLists({ restrict: ['+442079460958'], region: 'GB' });
    const handler = await loadHandler();

    await handler.onEvent({ data: callRequest('020 7946 0958') });

    expect(lastResponse().response.data).toMatchObject({ result: true, mode: 'restrict' });
  });

  it('allows requests that carry no numbers or an unknown action type', async () => {
    seedLists({ restrict: ['+14155552671'] });
    const handler = await loadHandler();

    await handler.onEvent({ data: { requestId: 'req-1', path: '/doNotContact', body: { actionType: 'call' } } });

    expect(lastResponse().response).toEqual({ data: { result: false } });
  });

  it('allows the action and logs when the check throws', async () => {
    seedLists({ restrict: ['+14155552671'] });
    vi.resetModules();
    mockEnglishTranslations();
    vi.doMock('../../src/core/user.ts', () => ({
      default: {
        getDoNotContactNumbers: () => {
          throw new Error('settings unreadable');
        },
      },
    }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/doNotContact.ts');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await handler.onEvent({ data: callRequest('+14155552671') });

      expect(lastResponse().response).toEqual({ data: { result: false } });
      expect(error).toHaveBeenCalled();
    }
    finally {
      error.mockRestore();
      vi.doUnmock('../../src/core/user.ts');
    }
  });
});
