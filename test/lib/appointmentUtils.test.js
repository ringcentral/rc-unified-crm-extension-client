import appointmentUtils from '../../src/lib/appointmentUtils.ts';

const {
  normalizeAttendees,
  formatAttendeeNames,
  normalizeAppointmentId,
  toCanonicalAppointment,
  extractAppointmentsListContext,
} = appointmentUtils;

describe('appointmentUtils', () => {
  it('normalizes attendee inputs from strings and objects', () => {
    expect(normalizeAttendees([
      'contact-1',
      { const: 'contact-2', title: 'Jane Doe', contactType: 'Lead' },
      { id: 'contact-3', name: 'John Doe', type: 'Contact' },
      '',
      null,
      {},
    ])).toEqual([
      { id: 'contact-1', name: '', type: '' },
      { id: 'contact-2', name: 'Jane Doe', type: 'Lead' },
      { id: 'contact-3', name: 'John Doe', type: 'Contact' },
    ]);
  });

  it('formats attendee names compactly', () => {
    expect(formatAttendeeNames([])).toBe('');
    expect(formatAttendeeNames([{ name: 'Jane' }])).toBe('Jane');
    expect(formatAttendeeNames([{ name: 'Jane' }, { name: 'John' }])).toBe('Jane, John');
    expect(formatAttendeeNames([{ name: 'Jane' }, { name: 'John' }, { name: 'Alex' }])).toBe('Jane, John +1 more');
  });

  it('normalizes appointment IDs with third-party ID preference except N/A', () => {
    expect(normalizeAppointmentId({ thirdPartyAppointmentId: 'crm-123', id: 'local-1' })).toBe('crm-123');
    expect(normalizeAppointmentId({ thirdPartyAppointmentId: 'N/A', id: 'local-1' })).toBe('local-1');
    expect(normalizeAppointmentId({ externalId: 'external-1' })).toBe('external-1');
    expect(normalizeAppointmentId({})).toBe('');
  });

  it('maps provider appointment payloads into canonical appointments', () => {
    expect(toCanonicalAppointment({
      externalId: 'external-1',
      summary: 'Intro call',
      description: 'Discuss requirements',
      start: '2026-07-02T09:00:00Z',
      duration: '45',
      attendees: [{ id: 'c-1', name: 'Jane', type: 'Contact' }],
    })).toEqual({
      thirdPartyAppointmentId: 'external-1',
      id: 'external-1',
      title: 'Intro call',
      description: 'Discuss requirements',
      startTimeUtc: '2026-07-02T09:00:00Z',
      durationMinutes: 45,
      status: 'scheduled',
      attendees: [{ id: 'c-1', name: 'Jane', type: 'Contact' }],
      participantName: 'Jane',
    });
  });

  it('extracts list context from nested page or button payloads', () => {
    expect(extractAppointmentsListContext({
      body: {
        button: {
          page: {
            formData: {
              tab: 'past',
              searchWithFilters: {
                search: 'Jane',
                filter: 'Confirmed',
              },
            },
          },
        },
      },
    })).toEqual({
      tab: 'past',
      searchWithFilters: {
        search: 'Jane',
        filter: 'Confirmed',
      },
    });

    expect(extractAppointmentsListContext({})).toEqual({
      tab: 'upcoming',
      searchWithFilters: {
        search: '',
        filter: 'All',
      },
    });
  });
});
