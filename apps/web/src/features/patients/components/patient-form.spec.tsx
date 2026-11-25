import type { AuthMe, Patient } from '@nutri/schemas';
import { fireEvent, screen } from '@testing-library/react';
import { t } from '@/i18n';
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

/** Method-aware stub: the list and the create share the same path. */
function stubPatientsApi({
  post = () => json(201, patient),
  patch = () => json(200, patient),
}: { post?: () => Response; patch?: () => Response } = {}) {
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const respond = (() => {
      if (path === '/api/auth/me') return json(200, staff);
      if (path === '/api/auth/config')
        return json(200, { emailAuthEnabled: true });
      if (path === '/api/clinic/patients' && method === 'GET')
        return json(200, []);
      if (path === '/api/clinic/patients' && method === 'POST') return post();
      if (path === `/api/clinic/patients/${patient.id}` && method === 'GET')
        return json(200, patient);
      if (path === `/api/clinic/patients/${patient.id}` && method === 'PATCH')
        return patch();
      if (path === `/api/clinic/patients/${patient.id}/consultations`)
        return json(200, []);
      return null;
    })();
    return respond
      ? Promise.resolve(respond)
      : Promise.reject(new Error(`Unexpected request to ${method} ${path}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof stubPatientsApi>, path: string) {
  return fetchMock.mock.calls
    .filter((call) => {
      const [calledPath, init] = call as unknown as [string, RequestInit];
      return calledPath === path && init?.body !== undefined;
    })
    .map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return JSON.parse(init.body as string) as unknown;
    });
}

const firstNameField = () => screen.getByLabelText(t.patients.form.firstName);
const lastNameField = () => screen.getByLabelText(t.patients.form.lastName);
const birthDateField = () => screen.getByLabelText(t.patients.birthDate);
const phoneField = () => screen.getByLabelText(t.patients.phone);

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

function fillValidForm() {
  type(firstNameField(), ' María ');
  type(lastNameField(), 'Gómez');
  type(birthDateField(), '14/03/1988');
  fireEvent.click(screen.getByRole('radio', { name: t.patients.sex.female }));
}

async function openNewPatient() {
  openApp('/patients/new');
  await screen.findByRole('heading', { name: t.patients.form.createTitle });
}

describe('PatientForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the patient with parsed values and lands on its profile', async () => {
    const fetchMock = stubPatientsApi();
    await openNewPatient();

    fillValidForm();
    type(phoneField(), '0412 555 0101');
    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitCreate }),
    );

    // The create notice on the profile proves the navigation happened.
    expect(
      await screen.findByText(t.patients.form.created),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'María Gómez' }),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/clinic/patients')).toEqual([
      {
        firstName: 'María',
        lastName: 'Gómez',
        birthDate: '1988-03-14',
        sex: 'female',
        phone: '0412 555 0101',
        address: null,
      },
    ]);
  });

  it('shows Spanish errors and posts nothing when the form is empty', async () => {
    const fetchMock = stubPatientsApi();
    await openNewPatient();

    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitCreate }),
    );

    expect(
      await screen.findByText(t.patients.form.firstNameRequired),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.patients.form.lastNameRequired),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.patients.form.birthDateRequired),
    ).toBeInTheDocument();
    expect(screen.getByText(t.patients.form.sexRequired)).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/clinic/patients')).toEqual([]);
  });

  it('rejects dates that do not exist and dates in the future', async () => {
    const fetchMock = stubPatientsApi();
    await openNewPatient();

    fillValidForm();
    type(birthDateField(), '31/02/2026');
    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitCreate }),
    );
    expect(
      await screen.findByText(t.patients.form.birthDateInvalid),
    ).toBeInTheDocument();

    type(birthDateField(), '01/01/2999');
    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitCreate }),
    );
    expect(
      await screen.findByText(t.patients.form.birthDateFuture),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/clinic/patients')).toEqual([]);
  });

  it('edits the patient and shows the saved notice', async () => {
    const fetchMock = stubPatientsApi();
    openApp(`/patients/${patient.id}/edit`);
    await screen.findByRole('heading', { name: t.patients.form.editTitle });

    expect(firstNameField()).toHaveValue('María');
    expect(birthDateField()).toHaveValue('14/03/1988');

    type(phoneField(), '0412 555 0101');
    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitEdit }),
    );

    expect(
      await screen.findByText(t.patients.form.updated),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, `/api/clinic/patients/${patient.id}`)).toEqual([
      {
        firstName: 'María',
        lastName: 'Gómez',
        birthDate: '1988-03-14',
        sex: 'female',
        phone: '0412 555 0101',
        address: null,
      },
    ]);
  });

  it('shows an alert when the API fails', async () => {
    stubPatientsApi({
      post: () => json(500, apiError(500, 'INTERNAL_ERROR')),
    });
    await openNewPatient();

    fillValidForm();
    fireEvent.click(
      screen.getByRole('button', { name: t.patients.form.submitCreate }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.patients.form.createFailed,
    );
  });
});
