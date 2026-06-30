const assert = require('node:assert/strict');
const test = require('node:test');
const appointmentUtils = require('../../src/lib/appointmentUtils');

test('appointmentUtils normalizes attendee inputs from objects and ids', () => {
  const attendees = appointmentUtils.normalizeAttendees([
    { id: ' crm-1 ', name: ' Ada Lovelace ', type: 'Lead' },
    { const: 'crm-2', title: 'Grace Hopper', contactType: 'Contact' },
    ' crm-3 ',
    { id: '   ', name: 'Ignored' },
    null,
    '',
  ]);

  assert.deepEqual(attendees, [
    { id: 'crm-1', name: 'Ada Lovelace', type: 'Lead' },
    { id: 'crm-2', name: 'Grace Hopper', type: 'Contact' },
    { id: 'crm-3', name: '', type: '' },
  ]);
});

test('appointmentUtils builds canonical appointment data with id fallback and participant summary', () => {
  const appointment = appointmentUtils.toCanonicalAppointment({
    thirdPartyAppointmentId: 'N/A',
    externalId: 'external-42',
    summary: ' Demo drive ',
    description: ' Bring paperwork ',
    start: '2026-07-01T10:00:00Z',
    duration: '45',
    attendees: [
      { id: 'contact-1', name: 'Ada Lovelace' },
      { id: 'contact-2', name: 'Grace Hopper' },
      { id: 'contact-3', name: 'Katherine Johnson' },
    ],
  });

  assert.deepEqual(appointment, {
    thirdPartyAppointmentId: 'external-42',
    id: 'external-42',
    title: 'Demo drive',
    description: 'Bring paperwork',
    startTimeUtc: '2026-07-01T10:00:00Z',
    durationMinutes: 45,
    status: 'scheduled',
    attendees: [
      { id: 'contact-1', name: 'Ada Lovelace', type: '' },
      { id: 'contact-2', name: 'Grace Hopper', type: '' },
      { id: 'contact-3', name: 'Katherine Johnson', type: '' },
    ],
    participantName: 'Ada Lovelace, Grace Hopper +1 more',
  });
});

test('appointmentUtils extracts list context from supported widget payload shapes', () => {
  assert.deepEqual(appointmentUtils.extractAppointmentsListContext({}), {
    tab: 'upcoming',
    searchWithFilters: {
      search: '',
      filter: 'All',
    },
  });

  assert.deepEqual(appointmentUtils.extractAppointmentsListContext({
    body: {
      button: {
        page: {
          formData: {
            tab: 'past',
            searchWithFilters: {
              search: 'Ada',
              filter: 'Confirmed',
            },
          },
        },
      },
    },
  }), {
    tab: 'past',
    searchWithFilters: {
      search: 'Ada',
      filter: 'Confirmed',
    },
  });

  assert.deepEqual(appointmentUtils.extractAppointmentsListContext({
    body: {
      button: {
        formData: {
          tab: 'all',
          searchWithFilters: {
            search: 'Grace',
          },
        },
      },
    },
  }), {
    tab: 'all',
    searchWithFilters: {
      search: 'Grace',
      filter: 'All',
    },
  });
});