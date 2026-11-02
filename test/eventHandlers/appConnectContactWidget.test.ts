import contactCore from '../../src/core/contact.ts';
import { responseMessage } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { rememberContactWidgets, resetContactWidgetsForTest } from '../../src/lib/contactWidget.ts';

vi.mock('../../src/core/contact.ts', () => ({
  default: { getContact: vi.fn() },
}));

vi.mock('../../src/lib/util.ts', () => ({
  responseMessage: vi.fn(),
}));

const contact = {
  id: 'c1',
  name: 'Jane',
  widget: {
    schema: { type: 'object', properties: { title: { type: 'string' }, caseList: { type: 'string' } } },
    uiSchema: { title: { 'ui:field': 'typography' }, caseList: { 'ui:field': 'list' } },
    formData: { title: 'Open cases' },
    actions: [{ id: 'open-crm', label: 'Open in CRM' }],
    links: { 'open-crm': 'https://crm.example/c1', 'case-1': 'https://crm.example/cases/1' },
  },
};

async function loadHandler() {
  return loadModule('../../src/eventHandlers/rc-post-message-request/sidebarApps/appConnectContact.ts');
}

describe('App Connect Contact widget request handler', () => {
  beforeEach(() => {
    resetContactWidgetsForTest();
    vi.mocked(responseMessage).mockReset();
    vi.mocked(contactCore.getContact).mockReset();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    rememberContactWidgets({ phoneNumber: '+16505550100', contacts: [contact] });
  });

  it('answers the page request with the widget for the call contact', async () => {
    const handler = await loadHandler();

    await handler.onEvent({ data: { requestId: 'r1', path: '/sidebarApps/app-connect-contact', body: { contact: { phoneNumber: '+16505550100' } } } });

    const response = vi.mocked(responseMessage).mock.calls[0];
    expect(response[0]).toBe('r1');
    expect((response[1] as any).data.page).toMatchObject({ type: 'json-schema', formData: { title: 'Open cases' } });
    expect((response[1] as any).data.actions).toEqual([{ id: 'open-crm', label: 'Open in CRM' }]);
  });

  it('looks the contact up itself when the page is requested before the call handler has stored it', async () => {
    resetContactWidgetsForTest();
    vi.mocked(contactCore.getContact).mockResolvedValue({ matched: true, isFromLocalCache: true, contactInfo: [contact] });
    const handler = await loadHandler();

    await handler.onEvent({
      data: { requestId: 'r6', path: '/sidebarApps/app-connect-contact', body: { contact: { phoneNumber: '+16505550100' } } },
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'clio',
    });

    expect(contactCore.getContact).toHaveBeenCalledWith({ serverUrl: 'https://server.example', phoneNumber: '+16505550100', platformName: 'clio', isExtensionNumber: false });
    expect((vi.mocked(responseMessage).mock.calls[0][1] as any).data.page.formData).toEqual({ title: 'Open cases' });
  });

  it('answers with an empty page when the lookup fails', async () => {
    resetContactWidgetsForTest();
    vi.mocked(contactCore.getContact).mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = await loadHandler();

    await handler.onEvent({
      data: { requestId: 'r7', path: '/sidebarApps/app-connect-contact', body: { contact: { phoneNumber: '+16505550100' } } },
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'clio',
    });

    expect((vi.mocked(responseMessage).mock.calls[0][1] as any).data.page.schema.properties).toEqual({});
  });

  it('answers a contact dropdown change with the page of the newly selected contact', async () => {
    const second = { id: 'c2', name: 'John', widget: { ...contact.widget, formData: { title: 'John cases' }, links: { 'open-crm': 'https://crm.example/c2' } } };
    rememberContactWidgets({ phoneNumber: '+16505550100', contacts: [{ ...contact, id: 'c1' }, second] });
    const handler = await loadHandler();

    await handler.onEvent({
      data: {
        requestId: 'r8',
        path: '/sidebarApps/app-connect-contact/inputChanged',
        body: { changedKeys: ['contactSelect'], formData: { contactSelect: 'c2', title: 'Open cases' } },
      },
    });

    const page = (vi.mocked(responseMessage).mock.calls[0][1] as any).data.page;
    expect(page.formData).toEqual({ contactSelect: 'c2', title: 'John cases' });
    expect(window.open).not.toHaveBeenCalled();

    await handler.onEvent({ data: { requestId: 'r9', path: '/sidebarApps/app-connect-contact/button-click', body: { button: { id: 'open-crm' } } } });

    expect(window.open).toHaveBeenCalledWith('https://crm.example/c2', '_blank', 'noopener');
  });

  it('opens the connector link on an action button click', async () => {
    const handler = await loadHandler();

    await handler.onEvent({ data: { requestId: 'r2', path: '/sidebarApps/app-connect-contact/button-click', body: { button: { id: 'open-crm' } } } });

    expect(window.open).toHaveBeenCalledWith('https://crm.example/c1', '_blank', 'noopener');
    expect(responseMessage).toHaveBeenCalledWith('r2', { data: 'ok' });
  });

  it('opens the link of a selected list item', async () => {
    const handler = await loadHandler();

    await handler.onEvent({
      data: {
        requestId: 'r3',
        path: '/sidebarApps/app-connect-contact/inputChanged',
        body: { changedKeys: ['caseList'], formData: { caseList: 'case-1' } },
      },
    });

    expect(window.open).toHaveBeenCalledWith('https://crm.example/cases/1', '_blank', 'noopener');
    expect(responseMessage).toHaveBeenCalledWith('r3', { data: 'ok' });
  });

  it('acknowledges unknown clicks without opening anything', async () => {
    const handler = await loadHandler();

    await handler.onEvent({ data: { requestId: 'r4', path: '/sidebarApps/app-connect-contact/button-click', body: { button: { id: 'nope' } } } });
    await handler.onEvent({ data: { requestId: 'r5', path: '/sidebarApps/app-connect-contact/inputChanged', body: {} } });

    expect(window.open).not.toHaveBeenCalled();
    expect(responseMessage).toHaveBeenCalledTimes(2);
  });
});
