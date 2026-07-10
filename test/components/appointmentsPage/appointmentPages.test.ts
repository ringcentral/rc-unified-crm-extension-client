import { createAppointment, listAppointments, updateAppointment, updateAppointmentStatus } from '../../../src/service/appointmentService.ts';
import userCore from '../../../src/core/user.ts';
import { getPlatformInfo } from '../../../src/service/platformService.ts';
import { loadModule } from '../../helpers/loadModule';
import { seedStorage } from '../../setup/storageHelpers';

vi.mock('../../../src/service/appointmentService.ts', () => ({
  createAppointment: vi.fn(),
  listAppointments: vi.fn(),
  updateAppointment: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));

vi.mock('../../../src/core/user.ts', () => ({
  default: {
    getShowAppointmentsTabSetting: vi.fn(),
  },
}));

vi.mock('../../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadCreatePage() {
  vi.resetModules();
  return loadModule('../../../src/components/appointmentsPage/appointmentCreatePage.ts');
}

async function loadEditPage() {
  vi.resetModules();
  return loadModule('../../../src/components/appointmentsPage/appointmentEditPage.ts');
}

async function loadAppointmentsPage() {
  vi.resetModules();
  return loadModule('../../../src/components/appointmentsPage/appointmentsPage.ts');
}

const manifest = {
  serverUrl: 'https://server.example',
  platforms: {
    salesforce: {
      page: {
        appointment: {
          title: 'Service Appointments',
          showConfirm: false,
          filterStatus: {
            value: ['All', 'Scheduled', 'Canceled', 'No Show'],
          },
        },
      },
    },
  },
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalDateTimeValue(dt: string | number | Date) {
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

describe('appointment create page', () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset();
  });

  it('renders configured title, status, participant candidates, and required fields', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: 'Service Appointments',
      titleFieldConfig: { isVisible: true, value: 'Visit Name' },
      statusConfig: { isVisible: true, value: ['scheduled', 'confirmed', 'confirmed', 'Needs Review'] },
      initialFormData: {
        title: 'Install router',
        appointmentDate: '2026-07-04',
        appointmentTime: '09:30',
        participantCandidates: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith', emailChecked: true },
          { id: 'c1', type: '', name: '', email: 'jane@example.test' },
          { id: 'c2', type: 'Contact', name: 'Alex Green', email: 'alex@example.test' },
        ],
        participantContactIds: ['c1', 'c1', 'c2'],
        emailMandatoryInAttendee: true,
        status: 'confirmed',
      },
    });

    expect(page).toMatchObject({
      id: 'appointmentCreatePage',
      title: 'Create Service Appointment',
      type: 'page',
      schema: {
        required: ['title', 'dateTime', 'endDateTime', 'participantContactIds', 'status'],
      },
      formData: {
        title: 'Install router',
        dateTime: toLocalDateTimeValue('2026-07-03T08:30:00.000Z'),
        participantContactIds: ['c1', 'c2'],
        status: 'confirmed',
      },
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
      { const: 'confirmed', title: 'Confirmed' },
      { const: 'needs review', title: 'Needs Review' },
    ]);
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'c1', label: 'Jane Smith' },
      { value: 'c2', label: 'Alex Green' },
    ]);
    expect(page.uiSchema.title['ui:placeholder']).toBe('Visit Name');
    expect(page.uiSchema.duration['ui:readonly']).toBe(true);
  });

  it('renders hidden title/status sections when configured off and keeps default schedule values', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: '',
      titleFieldConfig: { isVisible: false },
      statusConfig: { isVisible: false },
      initialFormData: {
        participantContacts: [{ id: 'c3', type: 'Lead', name: 'No Email', emailChecked: true }],
        emailMandatoryInAttendee: true,
      },
    });

    expect(page.title).toBe('Create Appointment');
    expect(page.schema.required).toEqual(['dateTime', 'endDateTime', 'participantContactIds']);
    expect(page.schema.properties).not.toHaveProperty('title');
    expect(page.schema.properties).not.toHaveProperty('status');
    expect(page.formData).toMatchObject({
      dateTime: toLocalDateTimeValue('2026-07-03T08:30:00.000Z'),
      endDateTime: toLocalDateTimeValue('2026-07-03T09:30:00.000Z'),
      participantContactIds: ['c3'],
    });
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toHaveLength(1);
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions[0]).toMatchObject({
      value: 'c3',
      label: expect.stringContaining('No email address'),
    });
  });

  it('renders fallback status options, singular titles ending in s, and normalizes invalid defaults', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: 'Tasks',
      titleFieldConfig: { isVisible: true, value: '' },
      statusConfig: { isVisible: true, value: ['', 'Scheduled', 'scheduled'] },
      initialFormData: {
        dateTime: 'bad-date',
        status: '',
        participantContactIds: ['', 'c1', 'c1'],
        participantCandidates: [
          { id: '', type: 'Lead', name: 'No id' },
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
        ],
      },
    });

    expect(page.title).toBe('Create Task');
    expect(page.formData.status).toBe('scheduled');
    expect(page.formData.participantContactIds).toEqual(['c1']);
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
    ]);
    expect(page.uiSchema.title['ui:placeholder']).toBe('Title');
  });

  it('renders one-letter titles, fallback status options, and id-only participant labels', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: 'A',
      statusConfig: { isVisible: true, value: ['', '  '] },
      initialFormData: {
        participantContacts: [{ id: 'id-only', type: '', name: '' }],
        participantContactIds: [],
      },
    });

    expect(page.title).toBe('Create A');
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
    ]);
    expect(page.formData).toMatchObject({
      status: 'scheduled',
      participantContactIds: ['id-only'],
    });
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'id-only', label: 'id-only' },
    ]);
  });

  it('renders defaults from legacy date fields and default status options', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: 'Appointments',
      titleFieldConfig: { isVisible: true },
      initialFormData: {
        dateTime: '',
        appointmentDate: '2026-07-06',
        appointmentTime: '14:45',
        participantContacts: [
          null,
          { id: '  c9  ', type: '  Lead  ', name: '  Legacy Person  ' },
        ],
      },
    });

    expect(page.formData).toMatchObject({
      dateTime: '2026-07-06T14:45',
      status: 'scheduled',
      participantContactIds: ['c9'],
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
      { const: 'confirmed', title: 'Confirmed' },
      { const: 'canceled', title: 'Canceled' },
    ]);
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'c9', label: 'Legacy Person' },
    ]);
  });

  it('merges duplicate participant contacts and labels contacts missing required email', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadCreatePage();

    const page = pageModule.getAppointmentCreatePageRender({
      appointmentTitle: 'Rooms',
      titleFieldConfig: { isVisible: true, value: 'Room title' },
      statusConfig: { isVisible: true, value: ['needs_review', 'Already Label', 'no show'] },
      initialFormData: {
        dateTime: '',
        appointmentDate: '2026-07-08',
        appointmentTime: '11:05',
        participantContacts: [
          { id: 'dup', type: '', name: '' },
          { id: 'dup', type: 'Lead', name: 'Filled Contact', email: 'filled@example.test', emailChecked: true },
          { id: 'missing-email', type: 'Contact', name: 'Missing Email', emailChecked: true },
        ],
        participantContactIds: null,
        emailMandatoryInAttendee: true,
      },
    });

    expect(page.title).toBe('Create Room');
    expect(page.formData).toMatchObject({
      dateTime: '2026-07-08T11:05',
      participantContactIds: ['dup', 'missing-email'],
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'needs_review', title: 'Needs Review' },
      { const: 'already label', title: 'Already Label' },
      { const: 'no show', title: 'no show' },
    ]);
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'dup', label: 'Filled Contact' },
      { value: 'missing-email', label: expect.stringContaining('No email address') },
    ]);
  });

  it('submits normalized participant payload to the appointment API', async () => {
    vi.mocked(createAppointment).mockResolvedValueOnce({ id: 'appt-1' });
    const pageModule = await loadCreatePage();

    await expect(pageModule.submitAppointmentCreate({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        title: 'Install router',
        dateTime: '2026-07-04T09:30',
        duration: 'PT1H30M',
        summary: 'Bring equipment',
        status: 'confirmed',
        participantContactIds: ['c1', 'manual visitor', 'c2'],
        participantCandidates: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        participantContactId: 'c2',
      },
    })).resolves.toEqual({ id: 'appt-1' });

    expect(createAppointment).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      payload: {
        title: 'Install router',
        participantName: 'Jane Smith, Alex Green, manual visitor',
        contactId: 'c2',
        contactType: 'Contact',
        contacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        summary: 'Bring equipment',
        startTimeUtc: new Date('2026-07-04T09:30').toISOString(),
        durationMinutes: 90,
        status: 'confirmed',
      },
    });
  });

  it('submits fallback contact identity and safe duration when participant candidates are missing', async () => {
    vi.mocked(createAppointment).mockResolvedValueOnce({ id: 'appt-2' });
    const pageModule = await loadCreatePage();

    await pageModule.submitAppointmentCreate({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        dateTime: 'not-a-date',
        duration: 'not-duration',
        participantName: 'Manual Contact',
        participantContactId: 'manual-1',
        participantContactType: 'Lead',
      },
    });

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        participantName: 'Manual Contact',
        contactId: 'manual-1',
        contactType: 'Lead',
        contacts: [
          { id: 'manual-1', type: 'Lead', name: 'Manual Contact' },
        ],
        startTimeUtc: undefined,
        durationMinutes: 60,
        status: 'scheduled',
      }),
    }));
  });

  it('submits deduped participant contacts from stored contact lists', async () => {
    vi.mocked(createAppointment).mockResolvedValueOnce({ id: 'appt-3' });
    const pageModule = await loadCreatePage();

    await pageModule.submitAppointmentCreate({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        dateTime: '',
        duration: 'P1DT2H5M',
        participantName: 'Manual One\nManual Two',
        participantContacts: [
          { id: 'c1', type: '', name: '' },
          { id: 'c1', type: 'Lead', name: 'Jane Smith', email: 'jane@example.test', emailChecked: true },
          { id: '', type: 'Contact', name: 'Ignored' },
        ],
        participantContactIds: [],
      },
    });

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        participantName: 'Jane Smith',
        contactId: '',
        contactType: '',
        contacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith', email: 'jane@example.test', emailChecked: true },
        ],
        startTimeUtc: undefined,
        durationMinutes: 1565,
      }),
    }));
  });

  it('submits an empty participant list when no contact identity is present', async () => {
    vi.mocked(createAppointment).mockResolvedValueOnce({ id: 'appt-4' });
    const pageModule = await loadCreatePage();

    await pageModule.submitAppointmentCreate({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        title: '',
        dateTime: '',
        duration: '',
        participantName: '  Manual One\n\nManual Two  ',
        participantContactIds: [],
        participantCandidates: [null],
      },
    });

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        participantName: 'Manual One, Manual Two',
        contactId: '',
        contactType: '',
        contacts: [],
        startTimeUtc: undefined,
        durationMinutes: 60,
      }),
    }));
  });
});

describe('appointment edit page', () => {
  beforeEach(() => {
    vi.mocked(updateAppointment).mockReset();
    vi.mocked(updateAppointmentStatus).mockReset();
  });

  it('renders edit form from appointment data with participant candidates and status normalization', async () => {
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender({
      appointmentTitle: 'Appointments',
      titleFieldConfig: { isVisible: true, value: 'Subject' },
      statusConfig: { isVisible: true, value: ['scheduled', 'confirmed', 'canceled'] },
      appointment: {
        thirdPartyAppointmentId: 'N/A',
        externalId: 'external-1',
        title: 'Repair visit',
        startTimeUtc: '2026-07-04T09:00:00.000Z',
        durationMinutes: 75,
        status: 'Confirmed',
        attendees: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        participantCandidates: [
          { id: 'c2', type: '', name: '' },
          { id: 'c3', type: 'Lead', name: 'No Email', emailChecked: true },
        ],
        emailMandatoryInAttendee: true,
        returnTab: 'past',
        returnSearch: 'Jane',
      },
    });

    expect(page).toMatchObject({
      id: 'appointmentEditPage',
      title: 'Edit Appointment',
      formData: {
        thirdPartyAppointmentId: 'external-1',
        returnTab: 'past',
        returnSearch: 'Jane',
        returnFilter: 'All',
        title: 'Repair visit',
        duration: 'PT1H15M',
        participantContactIds: ['c1', 'c2'],
        participantContactId: 'c1',
        participantContactType: 'Lead',
        status: 'confirmed',
      },
    });
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'c2', label: 'Alex Green' },
      { value: 'c3', label: 'No Email' },
      { value: 'c1', label: 'Jane Smith' },
    ]);
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
      { const: 'confirmed', title: 'Confirmed' },
      { const: 'canceled', title: 'Canceled' },
    ]);
  });

  it('preserves draft initial form data and hides optional title/status fields', async () => {
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender({
      appointmentTitle: 'Services',
      titleFieldConfig: { isVisible: false },
      statusConfig: { isVisible: false },
      initialFormData: {
        thirdPartyAppointmentId: 'draft-1',
        appointmentDate: '2026-07-05',
        appointmentTime: '10:15',
        participantContacts: [{ id: 'c5', type: 'Lead', name: 'Draft Person' }],
      },
    });

    expect(page.title).toBe('Edit Service');
    expect(page.schema.properties).not.toHaveProperty('title');
    expect(page.schema.properties).not.toHaveProperty('status');
    expect(page.formData).toMatchObject({
      thirdPartyAppointmentId: 'draft-1',
      dateTime: '2026-07-05T10:15',
      participantContactIds: ['c5'],
      participantName: 'Draft Person',
    });
  });

  it('renders edit form from attendee ids, fallback status options, and subject titles', async () => {
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender({
      appointmentTitle: 'Tasks',
      titleFieldConfig: { isVisible: true, value: 'Task name' },
      statusConfig: { isVisible: true, value: ['', '  '] },
      appointment: {
        thirdPartyAppointmentId: 'crm-1',
        subject: 'Follow up',
        startTime: '2026-07-04T09:00:00.000Z',
        duration: '45',
        attendeeIds: ['contact-1'],
        status: '',
      },
    });

    expect(page.title).toBe('Edit Task');
    expect(page.formData).toMatchObject({
      thirdPartyAppointmentId: 'crm-1',
      title: 'Follow up',
      duration: 'PT45M',
      participantContactIds: ['contact-1'],
      participantName: '',
      status: 'scheduled',
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
    ]);
  });

  it('renders edit page fallbacks for invalid appointment dates, empty titles, duplicate statuses, and no appointment id', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender({
      appointmentTitle: '',
      titleFieldConfig: { isVisible: true, value: '' },
      statusConfig: { isVisible: true, value: ['', 'Scheduled', 'scheduled', 'Needs Review'] },
      appointment: {
        id: '',
        thirdPartyAppointmentId: 'N/A',
        externalId: '',
        title: '',
        startTimeUtc: 'not-a-date',
        durationMinutes: -10,
        status: '',
        attendees: [
          { id: '', type: 'Lead', name: 'No id' },
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c1', type: '', name: '', email: 'jane@example.test' },
        ],
        participantCandidates: [],
      },
    });

    expect(page.title).toBe('Edit Appointment');
    expect(page.formData).toMatchObject({
      thirdPartyAppointmentId: '',
      dateTime: '',
      duration: 'PT0M',
      participantContactIds: ['c1'],
      participantContactId: 'c1',
      participantContactType: 'Lead',
      status: 'scheduled',
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
      { const: 'needs review', title: 'Needs Review' },
    ]);
  });

  it('renders edit defaults without an appointment payload', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender();

    expect(page.title).toBe('Edit Appointment');
    expect(page.formData).toMatchObject({
      thirdPartyAppointmentId: '',
      returnTab: 'upcoming',
      returnSearch: '',
      returnFilter: 'All',
      dateTime: '',
      duration: 'PT30M',
      participantContactId: '',
      participantContactType: '',
      participantContactIds: [],
      status: 'scheduled',
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'scheduled', title: 'Scheduled' },
      { const: 'confirmed', title: 'Confirmed' },
      { const: 'canceled', title: 'Canceled' },
    ]);
  });

  it('renders explicit selected ids from draft contacts and candidate email warnings', async () => {
    const pageModule = await loadEditPage();

    const page = pageModule.getAppointmentEditPageRender({
      appointmentTitle: 'Rooms',
      titleFieldConfig: { isVisible: true, value: 'Room title' },
      statusConfig: { isVisible: true, value: ['needs_review', 'Already Label'] },
      initialFormData: {
        thirdPartyAppointmentId: 'third-1',
        start: '',
        durationMinutes: 'not-a-number',
        participantContacts: [
          { id: 'dup', type: '', name: '' },
          { id: 'dup', type: 'Lead', name: 'Filled Contact' },
        ],
        participantCandidates: [
          { id: 'candidate', type: 'Contact', name: 'Candidate', emailChecked: true },
        ],
        participantContactIds: ['', 'dup', 'dup', 'manual-id'],
        emailMandatoryInAttendee: true,
        status: 'needs_review',
      },
    });

    expect(page.title).toBe('Edit Room');
    expect(page.formData).toMatchObject({
      thirdPartyAppointmentId: 'third-1',
      duration: 'PT30M',
      participantContactIds: ['dup', 'manual-id'],
      participantContactId: '',
      participantContactType: '',
      status: 'needs_review',
    });
    expect(page.schema.properties.status.oneOf).toEqual([
      { const: 'needs_review', title: 'Needs Review' },
      { const: 'already label', title: 'Already Label' },
    ]);
    expect(page.uiSchema.participantContactIds['ui:options'].enumOptions).toEqual([
      { value: 'candidate', label: expect.stringContaining('No email address') },
      { value: 'dup', label: 'Filled Contact' },
    ]);
  });

  it('saves a full patch with title, participants, attendees, and normalized status', async () => {
    vi.mocked(updateAppointment).mockResolvedValueOnce({ id: 'appt-1', saved: true });
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-1',
        title: 'Updated repair',
        dateTime: '2026-07-04T09:30',
        duration: 'PT2H',
        summary: 'Updated summary',
        status: 'Confirmed',
        participantContactIds: ['c2', 'manual visitor'],
        participantCandidates: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        participantContactId: 'c2',
      },
    })).resolves.toEqual({ id: 'appt-1', saved: true });

    expect(updateAppointment).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      patch: {
        title: 'Updated repair',
        participantName: 'Alex Green, manual visitor',
        summary: 'Updated summary',
        startTime: new Date('2026-07-04T09:30').toISOString(),
        durationMinutes: 120,
        contactId: 'c2',
        contactType: 'Contact',
        contacts: [{ id: 'c2', type: 'Contact', name: 'Alex Green' }],
        attendees: [{ id: 'c2', type: 'Contact', name: 'Alex Green' }],
        attendeeIds: ['c2'],
        status: 'confirmed',
      },
    });
    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('falls back to split core update and status update when status patch is rejected', async () => {
    vi.mocked(updateAppointment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'appt-2', saved: true });
    vi.mocked(updateAppointmentStatus).mockResolvedValueOnce({ id: 'appt-2', status: 'canceled' });
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-2',
        dateTime: '',
        duration: 'bad-duration',
        summary: 'Fallback summary',
        status: 'Canceled',
        participantName: 'Jane Smith\nAlex Green',
        participantContacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
          { id: 'c3', type: 'Lead', name: 'Removed Person' },
        ],
        participantContactId: 'c1',
      },
    })).resolves.toEqual({ id: 'appt-2', status: 'canceled' });

    expect(updateAppointment).toHaveBeenNthCalledWith(1, expect.objectContaining({
      appointmentId: 'appt-2',
      patch: expect.objectContaining({
        participantName: 'Jane Smith, Alex Green, Removed Person',
        durationMinutes: 60,
        status: 'canceled',
      }),
    }));
    expect(updateAppointment).toHaveBeenNthCalledWith(2, expect.objectContaining({
      appointmentId: 'appt-2',
      patch: expect.not.objectContaining({
        status: expect.anything(),
      }),
    }));
    expect(updateAppointmentStatus).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-2',
      status: 'canceled',
    });
  });

  it('reconciles manually selected participant names when saving without status', async () => {
    vi.mocked(updateAppointment).mockResolvedValueOnce(null);
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-3',
        dateTime: '',
        duration: '',
        status: '',
        participantContactIds: ['Jane Smith', 'Missing Person'],
        participantName: 'Jane Smith, Alex Green',
        participantContacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
          { id: 'c3', type: 'Lead', name: 'Removed Person' },
        ],
        participantContactId: 'c2',
      },
    })).resolves.toBeNull();

    expect(updateAppointment).toHaveBeenCalledWith(expect.objectContaining({
      appointmentId: 'appt-3',
      patch: expect.objectContaining({
        participantName: 'Jane Smith, Missing Person',
        contactId: 'c2',
        contactType: 'Contact',
        contacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        attendeeIds: ['c1', 'c2'],
      }),
    }));
    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('returns null when both status patch and core patch fail', async () => {
    vi.mocked(updateAppointment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-4',
        dateTime: 'bad-date',
        duration: 'PT30M',
        status: 'Confirmed',
      },
    })).resolves.toBeNull();

    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('returns null without an appointment id', async () => {
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {},
    })).resolves.toBeNull();

    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it('saves a core-only patch with no participant names or status', async () => {
    vi.mocked(updateAppointment).mockResolvedValueOnce(null);
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-5',
        dateTime: '',
        duration: 'PT0M',
        participantName: '',
        participantContacts: null,
        participantContactIds: null,
        status: '',
      },
    })).resolves.toBeNull();

    expect(updateAppointment).toHaveBeenCalledWith(expect.objectContaining({
      appointmentId: 'appt-5',
      patch: expect.objectContaining({
        participantName: '',
        durationMinutes: 0,
        contactId: '',
        contactType: '',
        contacts: [],
        attendees: [],
        attendeeIds: [],
      }),
    }));
    expect(updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('saves reconciled participant contacts when ids are omitted', async () => {
    vi.mocked(updateAppointment).mockResolvedValueOnce({ id: 'appt-6' });
    const pageModule = await loadEditPage();

    await expect(pageModule.saveAppointmentEdits({
      manifest,
      jwtToken: 'jwt-1',
      formData: {
        thirdPartyAppointmentId: 'appt-6',
        dateTime: '2026-07-04T09:30',
        duration: 'P1DT1H',
        participantName: 'Jane Smith\nMissing Person',
        participantContacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        participantContactIds: undefined,
        participantContactId: '',
        status: '',
      },
    })).resolves.toEqual({ id: 'appt-6' });

    expect(updateAppointment).toHaveBeenCalledWith(expect.objectContaining({
      appointmentId: 'appt-6',
      patch: expect.objectContaining({
        participantName: 'Jane Smith, Alex Green',
        durationMinutes: 1500,
        contactId: 'c1',
        contactType: 'Lead',
        contacts: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        attendees: [
          { id: 'c1', type: 'Lead', name: 'Jane Smith' },
          { id: 'c2', type: 'Contact', name: 'Alex Green' },
        ],
        attendeeIds: ['c1', 'c2'],
      }),
    }));
  });
});

describe('appointments page tab', () => {
  beforeEach(() => {
    vi.mocked(listAppointments).mockReset();
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(userCore.getShowAppointmentsTabSetting).mockReset().mockReturnValue({ value: true });
  });

  it('normalizes filter options and hides the tab when user settings disable appointments', async () => {
    const pageModule = await loadAppointmentsPage();

    const defaultPage = pageModule.getAppointmentsPageRender();
    expect(defaultPage.actions[0].title).toBe('New appointment');
    expect(defaultPage.formData).toEqual({
      tab: 'upcoming',
      searchWithFilters: {
        search: '',
        filter: 'All',
      },
    });
    expect(defaultPage.uiSchema.searchWithFilters['ui:filters']).toEqual(['All', 'Scheduled', 'Canceled']);

    vi.mocked(userCore.getShowAppointmentsTabSetting).mockReturnValueOnce({ value: false });
    const page = pageModule.getAppointmentsPageRender({
      manifest,
      platformName: 'salesforce',
      selectedTab: 'past',
      searchWithFilters: { search: 'Jane', filter: 'Missing' },
      filterOptions: ['Scheduled', 'Canceled'],
      userSettings: {
        showAppointmentsTab: { value: false },
      },
    });

    expect(page.hidden).toBe(true);
    expect(page.formData).toEqual({
      tab: 'past',
      searchWithFilters: {
        search: 'Jane',
        filter: 'Scheduled',
      },
    });
    expect(page.uiSchema.searchWithFilters['ui:filters']).toEqual(['Scheduled', 'Canceled']);
    expect(page.actions[0].title).toBe('New Service Appointments');
  });

  it('returns a hidden empty tab without listing appointments when storage settings hide it', async () => {
    seedStorage({
      userSettings: {
        showAppointmentsTab: { value: false },
      },
    });
    vi.mocked(userCore.getShowAppointmentsTabSetting).mockReturnValueOnce({ value: false });
    const pageModule = await loadAppointmentsPage();

    const page = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      platformName: 'salesforce',
    });

    expect(page.hidden).toBe(true);
    expect(page.unreadCount).toBe(0);
    expect(listAppointments).not.toHaveBeenCalled();
  });

  it('lists, filters, searches, and renders appointment row actions', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    vi.mocked(listAppointments).mockResolvedValueOnce([
      {
        id: 'future-1',
        title: 'Repair visit',
        participantName: 'Jane Smith',
        startTimeUtc: '2026-07-04T09:30:00.000Z',
        status: 'confirmed',
        attendees: [{ id: 'c1', name: 'Jane Smith' }],
      },
      {
        id: 'future-2',
        subject: 'Inspection',
        participantName: 'Alex Green',
        startTimeUtc: '2026-07-04T10:30:00.000Z',
        status: 'canceled',
      },
      {
        id: 'past-1',
        title: 'Old visit',
        participantName: 'Jane Smith',
        startTimeUtc: '2026-07-02T09:30:00.000Z',
        status: 'confirmed',
      },
    ]);
    const pageModule = await loadAppointmentsPage();

    const page = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { search: 'jane', filter: 'Scheduled' },
      platformName: 'salesforce',
      forceSync: true,
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });

    expect(listAppointments).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      range: 'upcoming',
      mineOnly: false,
      forceSync: true,
    });
    const [appointmentRow] = page.schema.properties.appointments.oneOf;
    expect(appointmentRow).toEqual(
      expect.objectContaining({
        const: 'future-1',
        title: 'Repair visit',
        description: 'Jane Smith',
        additionalInfo: expect.objectContaining({
          thirdPartyAppointmentId: 'future-1',
          attendees: [expect.objectContaining({ id: 'c1', name: 'Jane Smith' })],
        }),
      }),
    );
    expect(appointmentRow.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'appointmentConfirm' })]),
    );
  });

  it('renders an empty state when filters remove every appointment', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    vi.mocked(listAppointments).mockResolvedValueOnce([
      {
        id: 'future-1',
        title: 'Repair visit',
        participantName: 'Jane Smith',
        startTimeUtc: '2026-07-04T09:30:00.000Z',
        status: 'confirmed',
      },
    ]);
    const pageModule = await loadAppointmentsPage();

    const page = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'past',
      searchWithFilters: { search: 'not-found', filter: 'No Show' },
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });

    expect(page.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'noAppointments',
        title: 'No Service Appointments',
        actions: [{ id: 'appointmentsRefreshButton', title: 'Refresh', icon: 'refresh' }],
      }),
    ]);
  });

  it('renders appointment rows with invalid dates, custom statuses, and fallback titles', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    vi.mocked(listAppointments).mockResolvedValueOnce([
      {
        id: 'invalid-date',
        description: 'Description only',
        participantName: '',
        startTimeUtc: 'not-a-date',
        status: 'scheduled',
      },
      {
        id: 'same-title',
        title: 'Pat Visitor',
        participantName: 'Pat Visitor',
        startTimeUtc: '2026-07-04T09:00:00',
        status: 'confirmed',
      },
      {
        id: 'no-show',
        title: 'No show visit',
        participantName: 'No Show Person',
        startTimeUtc: '',
        status: 'No Show',
        attendees: 'manual-attendee',
      },
    ]);
    const pageModule = await loadAppointmentsPage();

    const page = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { search: '', filter: 'All' },
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });

    expect(page.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'invalid-date',
        title: 'Service Appointment',
        authorName: '',
        meta: '',
      }),
      expect.objectContaining({
        const: 'same-title',
        title: 'Pat Visitor',
        description: 'Pat Visitor',
      }),
      expect.objectContaining({
        const: 'no-show',
        title: 'No show visit',
        additionalInfo: expect.objectContaining({
          attendees: [{ id: 'manual-attendee', name: '', type: '' }],
        }),
      }),
    ]);
  });

  it('matches fallback status filters and handles empty appointment responses', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    vi.mocked(listAppointments)
      .mockResolvedValueOnce([
        {
          id: 'no-show',
          title: 'No Show Visit',
          participantName: 'Case Owner',
          startTimeUtc: '2026-07-04T09:30:00.000Z',
          status: 'No Show',
        },
        {
          id: 'scheduled',
          title: 'Scheduled Visit',
          participantName: 'Case Owner',
          startTimeUtc: '2026-07-04T10:30:00.000Z',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce(null);
    const pageModule = await loadAppointmentsPage();

    const filtered = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { search: 'case', filter: 'No Show' },
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });

    expect(filtered.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'no-show',
        title: 'No Show Visit',
      }),
    ]);

    const empty = await pageModule.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });

    expect(empty.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'noAppointments',
      }),
    ]);
  });

  it('uses default manifest settings, storage/platform fallbacks, and confirm actions', async () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00.000Z'));
    vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('storage unavailable'));
    vi.mocked(getPlatformInfo).mockRejectedValueOnce(new Error('platform unavailable'));
    vi.mocked(listAppointments).mockResolvedValueOnce([
      {
        id: 'no-date',
        participantName: '',
        startTimeUtc: '',
        status: 'cancelled',
      },
      {
        externalId: 'future-1',
        summary: 'Alex Green',
        participantName: 'Alex Green',
        start: '2026-07-04T09:30:00.000Z',
        status: 'canceled',
      },
      {
        id: 'invalid-date',
        title: 'Invalid date',
        startTimeUtc: 'not-a-date',
        status: 'scheduled',
      },
    ]);
    const pageModule = await loadAppointmentsPage();

    const page = await pageModule.getAppointmentsPageWithRecords({
      manifest: { serverUrl: 'https://server.example', platforms: {} },
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { filter: 'Canceled' },
    });

    expect(page.formData.searchWithFilters).toEqual({
      search: '',
      filter: 'Canceled',
    });
    expect(page.actions[0].title).toBe('New appointment');
    expect(page.uiSchema.searchWithFilters['ui:filters']).toEqual(['All', 'Scheduled', 'Canceled']);
    expect(page.schema.properties.appointments.oneOf).toHaveLength(2);
    expect(page.schema.properties.appointments.oneOf[0]).toEqual(expect.objectContaining({
      const: 'no-date',
      title: 'Appointment',
      authorName: '',
      meta: '',
      actions: expect.arrayContaining([
        expect.objectContaining({ id: 'appointmentConfirm' }),
      ]),
    }));
    expect(page.schema.properties.appointments.oneOf[1]).toEqual(expect.objectContaining({
      const: 'future-1',
      title: 'Alex Green',
      description: 'Alex Green',
    }));
  });
});
