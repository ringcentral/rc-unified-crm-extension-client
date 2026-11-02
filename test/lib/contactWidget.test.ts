import {
  buildContactWidgetPage,
  forgetContactWidgets,
  getChangedValueIds,
  getSelectedContact,
  getContactsWithWidget,
  registerContactWidgetApp,
  orderContactsBySelection,
  registerContactWidgetAppIfSeen,
  rememberContactWidgets,
  resetContactWidgetsForTest,
  resolveContactWidgetLink,
  selectContactWidget,
} from '../../src/lib/contactWidget.ts';
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
        iconUri: 'chrome-extension://test-extension/images/logo128.png',
        pagePath: '/sidebarApps/app-connect-contact',
        inputChangedPath: '/sidebarApps/app-connect-contact/inputChanged',
        buttonEventPath: '/sidebarApps/app-connect-contact/button-click',
      });
    });

    it('names the widget app after the CRM', () => {
      registerContactWidgetApp('Clio');
      rememberContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '2', widget: widget() }], crmName: 'Salesforce' });

      const names = getWidgetPostMessages()
        .filter(({ message }) => message.type === 'rc-adapter-register-widget-app')
        .map(({ message }) => message.app.name);
      expect(names).toEqual(['Clio Contact', 'Salesforce Contact']);
    });

    it('remembers only contacts with a widget and registers the app lazily', () => {
      expect(rememberContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '1' }] })).toBe(false);
      expect(getWidgetPostMessages()).toHaveLength(0);

      expect(rememberContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '1' }, { id: '2', widget: widget() }] })).toBe(true);

      expect(getContactsWithWidget('+1650').map(c => c.id)).toEqual(['2']);
      expect(getWidgetPostMessages()).toHaveLength(1);
    });

    it('falls back to the latest call and forgets on call end', () => {
      rememberContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '2', widget: widget() }] });

      expect(getContactsWithWidget('+1999').map(c => c.id)).toEqual(['2']);
      expect(getContactsWithWidget(undefined).map(c => c.id)).toEqual(['2']);

      forgetContactWidgets('+1650');

      expect(getContactsWithWidget('+1650')).toEqual([]);
      expect(getContactsWithWidget('+1999')).toEqual([]);
    });

    it('remembers that the platform returned a widget and registers the app at startup afterwards', async () => {
      await registerContactWidgetAppIfSeen('clio');
      expect(getWidgetPostMessages()).toHaveLength(0);

      rememberContactWidgets({ phoneNumber: '+1650', contacts: [{ id: '2', widget: widget() }], platformName: 'clio' });
      resetContactWidgetsForTest();
      await registerContactWidgetAppIfSeen('clio', 'Clio');
      await registerContactWidgetAppIfSeen('salesforce');
      await registerContactWidgetAppIfSeen(undefined);

      const registrations = getWidgetPostMessages().filter(({ message }) => message.type === 'rc-adapter-register-widget-app');
      expect(registrations).toHaveLength(2);
      expect(registrations[1].message.app.name).toBe('Clio Contact');
    });

    it('ignores a missing phone number', () => {
      expect(rememberContactWidgets({ phoneNumber: '', contacts: [{ id: '2', widget: widget() }] })).toBe(false);
      forgetContactWidgets('');
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
      rememberContactWidgets({ phoneNumber: '+1650', contacts });
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
