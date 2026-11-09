import contactCore from '../../src/core/contact.ts';
import { responseMessage } from '../../src/lib/util.ts';
import { getContactWidgets } from '../../src/service/contactWidgetService.ts';
import { loadModule } from '../helpers/loadModule';
import { rememberMatchedContacts, resetContactWidgetsForTest, setContactWidgets } from '../../src/lib/contactWidget.ts';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/contact.ts', () => ({
  default: { getContact: vi.fn() },
}));

vi.mock('../../src/lib/util.ts', () => ({
  responseMessage: vi.fn(),
}));

vi.mock('../../src/service/contactWidgetService.ts', () => ({
  getContactWidgets: vi.fn(),
}));

const PAGE_PATH = '/sidebarApps/app-connect-contact';
const manifest = { serverUrl: 'https://server.example' };
const matchedContact = { id: 'c1', name: 'Jane', type: 'Contact' };
const widget = {
  schema: { type: 'object', properties: { title: { type: 'string' }, caseList: { type: 'string' } } },
  uiSchema: { title: { 'ui:field': 'typography' }, caseList: { 'ui:field': 'list' } },
  formData: { title: 'Open cases' },
  actions: [{ id: 'open-crm', label: 'Open in CRM' }],
  links: { 'open-crm': 'https://crm.example/c1', 'case-1': 'https://crm.example/cases/1' },
};
const pageRequest = (requestId: string) => ({ data: { requestId, path: PAGE_PATH, body: { contact: { phoneNumber: '+16505550100' } } }, manifest, platformName: 'clio' });

async function loadHandler() {
  return loadModule('../../src/eventHandlers/rc-post-message-request/sidebarApps/appConnectContact.ts');
}

const lastPage = () => (vi.mocked(responseMessage).mock.calls.at(-1)![1] as any).data.page;

describe('App Connect Contact widget request handler', () => {
  beforeEach(async () => {
    resetContactWidgetsForTest();
    vi.mocked(responseMessage).mockReset();
    vi.mocked(contactCore.getContact).mockReset();
    vi.mocked(getContactWidgets).mockReset().mockResolvedValue({ successful: true, widgets: [{ contactId: 'c1', widget }] });
    vi.spyOn(window, 'open').mockImplementation(() => null);
    seedStorage({ implementedInterfaces: { getContactWidget: true } });
    await rememberMatchedContacts({ phoneNumber: '+16505550100', contacts: [matchedContact], platformName: 'clio' });
  });

  it('fetches the widgets for the matched contacts when the app is opened and answers with the page', async () => {
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r1'));

    expect(getContactWidgets).toHaveBeenCalledWith({ serverUrl: 'https://server.example', phoneNumber: '+16505550100', contacts: [matchedContact] });
    const response = vi.mocked(responseMessage).mock.calls[0];
    expect(response[0]).toBe('r1');
    expect((response[1] as any).data.page).toMatchObject({ type: 'json-schema', formData: { title: 'Open cases' } });
    expect((response[1] as any).data.actions).toEqual([{ id: 'open-crm', label: 'Open in CRM' }]);
  });

  it('asks the connector again on every page request, so refresh is never served from a cache', async () => {
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r1'));
    await handler.onEvent(pageRequest('r2'));

    expect(getContactWidgets).toHaveBeenCalledTimes(2);
  });

  it('matches the contact itself when the page is requested before the call handler has stored it', async () => {
    resetContactWidgetsForTest();
    vi.mocked(contactCore.getContact).mockResolvedValue({ matched: true, contactInfo: [matchedContact] });
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r6'));

    expect(contactCore.getContact).toHaveBeenCalledWith({ serverUrl: 'https://server.example', phoneNumber: '+16505550100', platformName: 'clio', isExtensionNumber: false });
    expect(lastPage().formData).toEqual({ title: 'Open cases' });
  });

  it('says so when no contact matched', async () => {
    resetContactWidgetsForTest();
    vi.mocked(contactCore.getContact).mockResolvedValue({ matched: false, contactInfo: [{ id: 'createNewContact', isNewContact: true }] });
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r7'));

    expect(getContactWidgets).not.toHaveBeenCalled();
    expect(lastPage().schema.properties.message.description).toBe('No matched contact for this number.');
  });

  it('says so when the connector returns no widget for the matched contacts', async () => {
    vi.mocked(getContactWidgets).mockResolvedValue({ successful: true, widgets: [] });
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r8'));

    expect(lastPage().schema.properties.message.description).toBe('No contact widget to show for this number.');
  });

  it('shows the connector message when the request is not successful', async () => {
    vi.mocked(getContactWidgets).mockResolvedValue({ successful: false, returnMessage: { message: 'Session expired' }, widgets: [] });
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r9'));

    expect(lastPage().schema.properties.message.description).toBe('Session expired');
    expect(lastPage().uiSchema.message['ui:severity']).toBe('warning');
  });

  it('shows an error line when fetching fails', async () => {
    vi.mocked(getContactWidgets).mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = await loadHandler();

    await handler.onEvent(pageRequest('r10'));

    expect(lastPage().uiSchema.message['ui:severity']).toBe('error');
  });

  describe('after the widgets were fetched', () => {
    it('answers a contact dropdown change with the page of the newly selected contact', async () => {
      const second = { id: 'c2', name: 'John', type: 'Contact' };
      const secondWidget = { ...widget, formData: { title: 'John cases' }, links: { 'open-crm': 'https://crm.example/c2' } };
      setContactWidgets({
        phoneNumber: '+16505550100',
        contacts: [matchedContact, second],
        widgets: [{ contactId: 'c1', widget }, { contactId: 'c2', widget: secondWidget }],
      });
      const handler = await loadHandler();

      await handler.onEvent({
        data: {
          requestId: 'r11',
          path: `${PAGE_PATH}/inputChanged`,
          body: { contact: { phoneNumber: '+16505550100' }, changedKeys: ['contactSelect'], formData: { contactSelect: 'c2', title: 'Open cases' } },
        },
      });

      expect(lastPage().formData).toEqual({ contactSelect: 'c2', title: 'John cases' });
      expect(window.open).not.toHaveBeenCalled();
      expect(getContactWidgets).not.toHaveBeenCalled();

      await handler.onEvent({ data: { requestId: 'r12', path: `${PAGE_PATH}/button-click`, body: { button: { id: 'open-crm' } } } });

      expect(window.open).toHaveBeenCalledWith('https://crm.example/c2', '_blank', 'noopener');
    });

    it('opens the connector link on an action button click', async () => {
      const handler = await loadHandler();
      await handler.onEvent(pageRequest('r1'));

      await handler.onEvent({ data: { requestId: 'r2', path: `${PAGE_PATH}/button-click`, body: { button: { id: 'open-crm' } } } });

      expect(window.open).toHaveBeenCalledWith('https://crm.example/c1', '_blank', 'noopener');
      expect(responseMessage).toHaveBeenLastCalledWith('r2', { data: 'ok' });
    });

    it('opens the link of a selected list item', async () => {
      const handler = await loadHandler();
      await handler.onEvent(pageRequest('r1'));

      await handler.onEvent({
        data: {
          requestId: 'r3',
          path: `${PAGE_PATH}/inputChanged`,
          body: { changedKeys: ['caseList'], formData: { caseList: 'case-1' } },
        },
      });

      expect(window.open).toHaveBeenCalledWith('https://crm.example/cases/1', '_blank', 'noopener');
      expect(responseMessage).toHaveBeenLastCalledWith('r3', { data: 'ok' });
    });

    it('acknowledges unknown clicks without opening anything', async () => {
      const handler = await loadHandler();
      await handler.onEvent(pageRequest('r1'));

      await handler.onEvent({ data: { requestId: 'r4', path: `${PAGE_PATH}/button-click`, body: { button: { id: 'nope' } } } });
      await handler.onEvent({ data: { requestId: 'r5', path: `${PAGE_PATH}/inputChanged`, body: {} } });

      expect(window.open).not.toHaveBeenCalled();
      expect(responseMessage).toHaveBeenCalledTimes(3);
    });
  });
});
