import {
  buildContactWidgetPage,
  forgetContactWidgets,
  getChangedValueIds,
  getSelectedContact,
  getContactsWithWidget,
  registerContactWidgetApp,
  orderContactsBySelection,
  getMatchedContacts,
  buildContactWidgetMessagePage,
  rememberMatchedContacts,
  resetContactWidgetsForTest,
  resolveContactWidgetLink,
  selectContactWidget,
  setContactWidgets,
} from '../../src/lib/contactWidget.ts';
import { seedStorage } from '../setup/storageHelpers';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

const widget = (overrides = {}) => ({
  schema: { type: 'object', properties: { title: { type: 'string' } } },
  uiSchema: { title: { 'ui:field': 'typography' } },
  formData: { title: 'Open cases' },
  ...overrides,
});

describe('contactWidget', () => {
  beforeEach(() => {
    resetContactWidgetsForTest();
  });

  describe('registration and storage', () => {
    it('registers the App Connect Contact widget app', () => {
      registerContactWidgetApp();

      const registrations = getWidgetPostMessages().filter(({ message }) => message.type === 'rc-adapter-register-widget-app');
      expect(registrations).toHaveLength(1);
      expect(registrations[0].message.app).toEqual({
        id: 'app-connect-contact',
        name: 'App Connect Contact',
        iconUri: expect.stringMatching(/^(data:image\/png|.*contactWidgetIcon)/),
        pagePath: '/sidebarApps/app-connect-contact',
        inputChangedPath: '/sidebarApps/app-connect-contact/inputChanged',
        buttonEventPath: '/sidebarApps/app-connect-contact/button-click',
      });
    });

    it('names the widget app after the CRM', () => {
      registerContactWidgetApp('Clio');
      registerContactWidgetApp('Salesforce');

      const names = getWidgetPostMessages()
        .filter(({ message }) => message.type === 'rc-adapter-register-widget-app')
        .map(({ message }) => message.app.name);
      expect(names).toEqual(['Clio Contact', 'Salesforce Contact']);
    });

    it('registers the app once a real contact matched and the connector implements getContactWidget', async () => {
      seedStorage({ implementedInterfaces: { getContactWidget: true } });

      expect(await rememberMatchedContacts({ phoneNumber: '+1650', contacts: [{ id: 'createNewContact', isNewContact: true }] })).toBe(false);
      expect(await rememberMatchedContacts({ phoneNumber: '+1650', contacts: null })).toBe(false);
      expect(getWidgetPostMessages()).toHaveLength(0);

      expect(await rememberMatchedContacts({ phoneNumber: '+1650', contacts: [{ id: '1' }, { id: 'createNewContact', isNewContact: true }], crmName: 'Clio' })).toBe(true);

      expect(getMatchedContacts('+1650').map(c => c.id)).toEqual(['1']);
      const registrations = getWidgetPostMessages().filter(({ message }) => message.type === 'rc-adapter-register-widget-app');
      expect(registrations).toHaveLength(1);
      expect(registrations[0].message.app.name).toBe('Clio Contact');
    });

    it('does not register the app when the connector does not implement getContactWidget', async () => {
      seedStorage({ implementedInterfaces: { getContactWidget: false } });

      expect(await rememberMatchedContacts({ phoneNumber: '+1650', contacts: [{ id: '1' }] })).toBe(false);
      seedStorage({ implementedInterfaces: null });
      expect(await rememberMatchedContacts({ phoneNumber: '+1650', contacts: [{ id: '1' }] })).toBe(false);

      expect(getMatchedContacts('+1650')).toEqual([]);
      expect(getWidgetPostMessages()).toHaveLength(0);
    });

    it('ignores a missing phone number', async () => {
      seedStorage({ implementedInterfaces: { getContactWidget: true } });

      expect(await rememberMatchedContacts({ phoneNumber: '', contacts: [{ id: '1' }] })).toBe(false);
      forgetContactWidgets('');
    });

    it('pairs matched contacts with their widgets by id and leaves out contacts without one', () => {
      const contacts = [{ id: 1, name: 'Jane' }, { id: 2, name: 'John' }, { id: 3, name: 'Jim' }];

      const result = setContactWidgets({
        phoneNumber: '+1650',
        contacts,
        widgets: [{ contactId: '2', widget: widget() }, { contactId: '3', widget: { uiSchema: {} } }, { contactId: '9', widget: widget() }],
      });

      expect(result.map(c => c.id)).toEqual([2]);
      expect(result[0].widget).toEqual(widget());
      expect(getContactsWithWidget('+1650').map(c => c.id)).toEqual([2]);
    });

    it('falls back to the latest call and forgets on call end', async () => {
      seedStorage({ implementedInterfaces: { getContactWidget: true } });
      await rememberMatchedContacts({ phoneNumber: '+1650', contacts: [{ id: '2' }] });
      setContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '2' }], widgets: [{ contactId: '2', widget: widget() }] });

      expect(getMatchedContacts('+1999').map(c => c.id)).toEqual(['2']);
      expect(getContactsWithWidget('+1999').map(c => c.id)).toEqual(['2']);
      expect(getContactsWithWidget(undefined).map(c => c.id)).toEqual(['2']);

      forgetContactWidgets('+1650');

      expect(getMatchedContacts('+1650')).toEqual([]);
      expect(getContactsWithWidget('+1650')).toEqual([]);
      expect(getContactsWithWidget('+1999')).toEqual([]);
    });
  });

  describe('buildContactWidgetMessagePage', () => {
    it('shows a single admonition line with the message', () => {
      const result = buildContactWidgetMessagePage('Nothing here', 'warning');

      expect(result.data.page.schema.properties.message).toEqual({ type: 'string', description: 'Nothing here' });
      expect(result.data.page.uiSchema.message).toEqual({ 'ui:field': 'admonition', 'ui:severity': 'warning' });
      expect(result.data.actions).toEqual([]);
    });
  });

  describe('buildContactWidgetPage', () => {
    it('returns an empty page when there are no widgets', () => {
      const result = buildContactWidgetPage([]);

      expect(result.data.page.schema.properties).toEqual({});
      expect(result.data.actions).toEqual([]);
    });

    it('wraps a single widget as a json-schema page with its actions', () => {
      const actions = [{ id: 'open', label: 'Open' }];

      const result = buildContactWidgetPage([{ id: '1', name: 'Jane', widget: widget({ actions }) }]);

      expect(result.data.page).toEqual({
        type: 'json-schema',
        schema: widget().schema,
        uiSchema: widget().uiSchema,
        formData: widget().formData,
      });
      expect(result.data.actions).toEqual(actions);
    });

    it('shows a contact dropdown and the selected contact widget when several have widgets', () => {
      const contacts = [
        { id: 1, name: 'Jane', widget: widget({ actions: [{ id: 'a', label: 'A' }] }) },
        { id: 2, name: 'John', widget: widget({ formData: { title: 'John cases' }, actions: [{ id: 'b', label: 'B' }] }) },
      ];

      const first = buildContactWidgetPage(contacts).data;

      expect(Object.keys(first.page.schema.properties)).toEqual(['contactSelect', 'title']);
      expect(first.page.schema.properties.contactSelect).toEqual({
        type: 'string',
        title: 'Contact',
        oneOf: [{ const: '1', title: 'Jane' }, { const: '2', title: 'John' }],
      });
      expect(first.page.formData).toEqual({ contactSelect: '1', title: 'Open cases' });
      expect(first.actions.map((a: { id: string }) => a.id)).toEqual(['a']);

      selectContactWidget('2');
      const second = buildContactWidgetPage(contacts).data;

      expect(second.page.formData).toEqual({ contactSelect: '2', title: 'John cases' });
      expect(second.actions.map((a: { id: string }) => a.id)).toEqual(['b']);
      expect(orderContactsBySelection(contacts).map(c => c.id)).toEqual([2, 1]);
    });

    it('keeps the dropdown first and respects the connector ui:order', () => {
      const contacts = [
        { id: 1, name: 'Jane', widget: widget({ uiSchema: { 'ui:order': ['b', 'a'] } }) },
        { id: 2, name: 'John', widget: widget() },
      ];

      expect(buildContactWidgetPage(contacts).data.page.uiSchema['ui:order']).toEqual(['contactSelect', 'b', 'a']);
      selectContactWidget('2');
      expect(buildContactWidgetPage(contacts).data.page.uiSchema['ui:order']).toEqual(['contactSelect', '*']);
    });

    it('falls back to the first contact when the selection is unknown and resets when the call ends', () => {
      const contacts = [{ id: 1, name: 'Jane', widget: widget() }, { id: 2, name: 'John', widget: widget() }];
      setContactWidgets({ phoneNumber: '+1650', contacts, widgets: contacts.map(c => ({ contactId: String(c.id), widget: c.widget })) });
      selectContactWidget('2');
      expect(getSelectedContact(contacts)?.id).toBe(2);

      selectContactWidget('999');
      expect(getSelectedContact(contacts)?.id).toBe(1);

      selectContactWidget('2');
      forgetContactWidgets('+1650');
      expect(getSelectedContact(contacts)?.id).toBe(1);
      selectContactWidget(undefined);
    });

    it('defaults a missing uiSchema and formData', () => {
      const result = buildContactWidgetPage([{ id: '1', widget: { schema: widget().schema } }]);

      expect(result.data.page.uiSchema).toEqual({});
      expect(result.data.page.formData).toEqual({});
    });
  });

  describe('links', () => {
    const contacts = [{ widget: widget({ links: { open: 'https://crm.example/1', bad: 'javascript:alert(1)', 'case-1': 'https://crm.example/cases/1' } }) }];

    it('resolves the first safe http(s) link for the candidate ids', () => {
      expect(resolveContactWidgetLink({ contacts, ids: ['unknown', 'open'] })).toBe('https://crm.example/1');
    });

    it('rejects unsafe or missing links', () => {
      expect(resolveContactWidgetLink({ contacts, ids: ['bad'] })).toBeNull();
      expect(resolveContactWidgetLink({ contacts, ids: ['nope'] })).toBeNull();
      expect(resolveContactWidgetLink({ contacts: [], ids: ['open'] })).toBeNull();
    });

    it('collects the changed keys and the selected values from form data', () => {
      expect(getChangedValueIds({ changedKeys: ['caseList'], formData: { caseList: 'case-1' } })).toEqual(['caseList', 'case-1']);
      expect(getChangedValueIds({ changedKeys: ['contact0'], formData: { contact0: { caseList: 'case-1' } } })).toEqual(['contact0', 'case-1']);
      expect(getChangedValueIds({})).toEqual([]);
    });
  });
});
