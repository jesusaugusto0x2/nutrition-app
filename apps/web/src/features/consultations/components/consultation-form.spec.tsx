import type { AuthMe, Consultation, Patient } from '@nutri/schemas';
import { todayIsoDate } from '@nutri/schemas';
import { fireEvent, screen, within } from '@testing-library/react';
import { t } from '@/i18n';
import { formatDate, formatSignedQuantity } from '@/lib/format';
import { apiError, json, openApp } from '../../auth/testing';

const staff: AuthMe = {
  user: {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: 'Carmen Rojas',
    email: 'carmen@example.com',
    emailVerified: true,
  },
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Nutrición Rojas',
      role: 'owner',
    },
  ],
  patientAccess: [],
};

const patient: Patient = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'María',
  lastName: 'Gómez',
  birthDate: '1988-03-14',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

const base = {
  patientId: patient.id,
  heightM: 1.62,
  armCm: null,
  legCm: null,
  hipCm: null,
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
};

const older: Consultation = {
  ...base,
  id: '00000000-0000-4000-8000-0000000000c1',
  date: '2026-10-25',
  weightKg: 70.5,
  waistCm: 85,
  notes: null,
};

const newer: Consultation = {
  ...base,
  id: '00000000-0000-4000-8000-0000000000c2',
  date: '2026-11-10',
  weightKg: 69,
  waistCm: 83,
  notes: 'Nota',
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};

const createdId = '00000000-0000-4000-8000-0000000000c9';

/**
 * Method-aware stub with a mutable list: the refetch after a save (query
 * invalidation) answers with the record the POST/PATCH just wrote.
 */
function stubConsultationsApi({
  list = [older],
  post,
  patch,
}: {
  list?: Consultation[];
  post?: () => Response;
  patch?: () => Response;
} = {}) {
  const currentList = [...list];
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(init.body as string) as object) : {};
    const consultationsPath = `/api/clinic/patients/${patient.id}/consultations`;
    const respond = (() => {
      if (path === '/api/auth/me') return json(200, staff);
      if (path === '/api/auth/config')
        return json(200, { emailAuthEnabled: true });
      if (path === `/api/clinic/patients/${patient.id}` && method === 'GET')
        return json(200, patient);
      if (path === consultationsPath && method === 'GET')
        return json(200, currentList);
      if (path === consultationsPath && method === 'POST') {
        if (post) return post();
        const created = {
          ...older,
          ...body,
          id: createdId,
        } as Consultation;
        currentList.unshift(created);
        return json(201, created);
      }
      if (path.startsWith(consultationsPath) && method === 'PATCH') {
        if (patch) return patch();
        const id = path.slice(`${consultationsPath}/`.length);
        const index = currentList.findIndex((c) => c.id === id);
        if (index === -1) return json(404, apiError(404, 'NOT_FOUND'));
        currentList[index] = { ...currentList[index], ...body };
        return json(200, currentList[index]);
      }
      return null;
    })();
    return respond
      ? Promise.resolve(respond)
      : Promise.reject(new Error(`Unexpected request to ${method} ${path}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof stubConsultationsApi>) {
  return fetchMock.mock.calls
    .filter((call) => {
      const [, init] = call as unknown as [string, RequestInit];
      return init?.body !== undefined;
    })
    .map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return JSON.parse(init.body as string) as unknown;
    });
}

const dateField = () => screen.getByLabelText(t.consultations.date);
const weightField = () => screen.getByLabelText(t.consultations.weight);
const heightField = () => screen.getByLabelText(t.consultations.height);
const waistField = () => screen.getByLabelText(t.consultations.waist);
const notesField = () => screen.getByLabelText(t.consultations.notes);
const saveButton = () =>
  screen.getByRole('button', { name: t.consultations.saveConsultation });

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

describe('ConsultationForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a consultation with live diffs and lands on the profile', async () => {
    const fetchMock = stubConsultationsApi();
    openApp(`/patients/${patient.id}/nueva-consulta`);
    await screen.findByRole('heading', {
      name: t.consultations.newConsultation,
    });

    // Date defaults to today, the previous values are the hints, and saving
    // waits for the weight.
    expect(dateField()).toHaveValue(formatDate(todayIsoDate()));
    expect(
      screen.getByText(t.consultations.previous('70,5 kg')),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(
      screen.getByText(t.consultations.weightRequired),
    ).toBeInTheDocument();

    // The live diff reads the draft against the latest consultation.
    type(weightField(), '68,5');
    expect(saveButton()).toBeEnabled();
    expect(
      screen.getByText(formatSignedQuantity(-2, 'weight')),
    ).toBeInTheDocument();

    type(heightField(), '162');
    type(waistField(), '80');
    type(notesField(), 'Todo bien');
    fireEvent.click(saveButton());

    expect(await screen.findByText(t.consultations.saved)).toBeInTheDocument();
    expect(bodiesOf(fetchMock)).toEqual([
      {
        date: todayIsoDate(),
        weightKg: 68.5,
        heightM: 1.62,
        armCm: null,
        waistCm: 80,
        legCm: null,
        hipCm: null,
        notes: 'Todo bien',
      },
    ]);
    // The profile lists the new consultation first.
    const section = screen
      .getByRole('heading', { name: t.consultations.listTitle })
      .closest('section') as HTMLElement;
    const items = within(section).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(formatDate(todayIsoDate()));
  });

  it('resets the date to today with the shortcut', async () => {
    stubConsultationsApi();
    openApp(`/patients/${patient.id}/nueva-consulta`);
    await screen.findByRole('heading', {
      name: t.consultations.newConsultation,
    });

    type(dateField(), '01/01/2020');
    fireEvent.click(
      screen.getByRole('button', { name: t.consultations.today }),
    );

    expect(dateField()).toHaveValue(formatDate(todayIsoDate()));
  });

  it('links cancel back to the profile without writing', async () => {
    const fetchMock = stubConsultationsApi();
    openApp(`/patients/${patient.id}/nueva-consulta`);
    await screen.findByRole('heading', {
      name: t.consultations.newConsultation,
    });

    expect(
      screen.getByRole('link', { name: t.consultations.cancel }),
    ).toHaveAttribute('href', `/patients/${patient.id}`);
    expect(bodiesOf(fetchMock)).toEqual([]);
  });

  it('edits a consultation against the one before it', async () => {
    const fetchMock = stubConsultationsApi({ list: [newer, older] });
    openApp(`/patients/${patient.id}/consultas/${newer.id}/editar`);
    await screen.findByRole('heading', {
      name: t.consultations.editOf(formatDate(newer.date)),
    });

    expect(weightField()).toHaveValue('69,0');
    expect(notesField()).toHaveValue('Nota');
    // The hints come from the older consultation, not from the edited one.
    expect(
      screen.getByText(t.consultations.previous('70,5 kg')),
    ).toBeInTheDocument();

    type(weightField(), '68');
    fireEvent.click(saveButton());

    expect(await screen.findByText(t.consultations.saved)).toBeInTheDocument();
    expect(bodiesOf(fetchMock)).toEqual([
      {
        date: '2026-11-10',
        weightKg: 68,
        heightM: 1.62,
        armCm: null,
        waistCm: 83,
        legCm: null,
        hipCm: null,
        notes: 'Nota',
      },
    ]);
  });

  it('shows an alert when the API rejects the save', async () => {
    stubConsultationsApi({
      post: () => json(500, apiError(500, 'INTERNAL_ERROR')),
    });
    openApp(`/patients/${patient.id}/nueva-consulta`);
    await screen.findByRole('heading', {
      name: t.consultations.newConsultation,
    });

    type(weightField(), '68,5');
    fireEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.consultations.saveFailed,
    );
  });

  it('answers not found for a consultation outside the list', async () => {
    stubConsultationsApi();
    openApp(
      `/patients/${patient.id}/consultas/00000000-0000-4000-8000-0000000000ff/editar`,
    );

    expect(
      await screen.findByText(t.consultations.notFound),
    ).toBeInTheDocument();
  });
});
