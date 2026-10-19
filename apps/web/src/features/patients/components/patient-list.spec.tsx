import type { Patient } from '@nutri/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { patientsQueryOptions } from '../api';
import { PatientList } from './patient-list';

const patients: Patient[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    firstName: 'Ana',
    lastName: 'Pérez',
    birthDate: '1990-05-10',
    sex: 'female',
    phone: null,
    address: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
];

function renderPatientList(data: Patient[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(patientsQueryOptions().queryKey, data);

  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: PatientList,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients/$patientId',
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('PatientList', () => {
  it('shows each patient with a link to their profile', async () => {
    renderPatientList(patients);

    const link = await screen.findByRole('link', { name: /Ana Pérez/ });
    expect(link).toHaveAttribute('href', `/patients/${patients[0].id}`);
    expect(link).toHaveTextContent(t.patients.sex.female);
  });

  it('shows the empty state from the i18n file', async () => {
    renderPatientList([]);

    expect(await screen.findByText(t.patients.empty)).toBeInTheDocument();
  });
});
