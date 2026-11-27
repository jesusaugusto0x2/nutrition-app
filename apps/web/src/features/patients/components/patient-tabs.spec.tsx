import type { AuthMe, Consultation, Patient } from '@nutri/schemas';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { t } from '@/i18n';
import { json, openApp, stubApi } from '@/features/auth/testing';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@example.com',
  name: 'Ana',
  emailVerified: true,
};
const staff: AuthMe = {
  user,
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Consultorio',
      role: 'owner',
    },
  ],
  patientAccess: [],
};

const patient: Patient = {
  id: '00000000-0000-4000-8000-000000000003',
  firstName: 'María',
  lastName: 'López',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

const consultation: Consultation = {
  id: '00000000-0000-4000-8000-000000000004',
  patientId: patient.id,
  date: '2026-11-10',
  weightKg: 70.5,
  heightM: 1.65,
  armCm: 28,
  waistCm: 80,
  legCm: 45,
  hipCm: 95,
  notes: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};

function stubProfileApi(consultations: Consultation[] = [consultation]) {
  stubApi({
    '/api/auth/me': () => json(200, staff),
    [`/api/clinic/patients/${patient.id}`]: () => json(200, patient),
    [`/api/clinic/patients/${patient.id}/consultations`]: () =>
      json(200, consultations),
  });
}

function activeTab() {
  return screen.getByRole('tab', { selected: true });
}

describe('PatientProfileTabs', () => {
  it.each([
    ['/patients/$id', t.profileTabs.summary],
    ['/patients/$id/historia', t.profileTabs.history],
    ['/patients/$id/control-medidas', t.profileTabs.measurements],
    ['/patients/$id/notas', t.profileTabs.notes],
  ])('deep-links %s with its tab active', async (template, label) => {
    stubProfileApi();
    openApp(template.replace('$id', patient.id));

    await waitFor(() => expect(activeTab()).toHaveTextContent(label));
    // Pacientes stays highlighted in the navigation on every tab (both the
    // sidebar and the bottom bar render it).
    const patientsLinks = screen.getAllByRole('link', {
      name: t.nav.patients,
    });
    expect(
      patientsLinks.some(
        (link) => link.getAttribute('aria-current') === 'page',
      ),
    ).toBe(true);
  });

  it('renders Resumen with the patient consultations', async () => {
    stubProfileApi();
    openApp(`/patients/${patient.id}`);

    await screen.findByText('10/11/2026');
    expect(
      screen.getByRole('link', { name: t.consultations.newConsultation }),
    ).toBeInTheDocument();
  });

  it.each([
    [t.profileTabs.history, t.profileTabs.comingSoon.history],
    [t.profileTabs.measurements, t.profileTabs.comingSoon.measurements],
    [t.profileTabs.notes, t.profileTabs.comingSoon.notes],
  ])(
    'shows a designed placeholder on %s until its ticket wires it in',
    async (label, description) => {
      stubProfileApi();
      openApp(`/patients/${patient.id}`);

      await screen.findByText('10/11/2026');
      fireEvent.click(screen.getByRole('tab', { name: label }));

      await screen.findByText(description);
      expect(activeTab()).toHaveTextContent(label);
    },
  );

  it('navigates the URL when a tab is picked', async () => {
    stubProfileApi();
    const { router } = openApp(`/patients/${patient.id}`);

    await screen.findByText('10/11/2026');
    fireEvent.click(screen.getByRole('tab', { name: t.profileTabs.notes }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/patients/${patient.id}/notas`,
      );
    });
  });

  it('404s an unknown tab under the profile', async () => {
    stubProfileApi();
    openApp(`/patients/${patient.id}/xyz`);

    await screen.findByText(t.patients.notFound);
  });

  it('404s a deep link to a tab of a missing patient', async () => {
    stubApi({
      '/api/auth/me': () => json(200, staff),
      [`/api/clinic/patients/${patient.id}`]: () =>
        json(404, { message: 'Not found' }),
    });
    openApp(`/patients/${patient.id}/notas`);

    await screen.findByText(t.patients.notFound);
  });
});
