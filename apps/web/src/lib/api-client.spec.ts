import { patientSchema } from '@nutri/schemas';
import { ApiClientError, apiClient } from './api-client';

const patient = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes /api and validates the response with the schema', async () => {
    const fetchMock = mockFetch(200, patient);

    await expect(
      apiClient.get(`/clinic/patients/${patient.id}`, patientSchema),
    ).resolves.toEqual(patient);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clinic/patients/${patient.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends JSON bodies', async () => {
    const fetchMock = mockFetch(200, patient);

    await apiClient.post(
      '/clinic/patients',
      { firstName: 'Ana' },
      patientSchema,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clinic/patients',
      expect.objectContaining({
        method: 'POST',
        body: '{"firstName":"Ana"}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('rejects responses that break the shared contract', async () => {
    mockFetch(200, { ...patient, sex: 'unknown' });

    await expect(
      apiClient.get('/clinic/patients/1', patientSchema),
    ).rejects.toThrow();
  });

  it('throws ApiClientError with the parsed error body', async () => {
    const errorBody = {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Patient not found',
      path: '/api/clinic/patients/1',
      timestamp: '2026-01-01T10:00:00.000Z',
    };
    mockFetch(404, errorBody);

    const error = await apiClient
      .get('/clinic/patients/1', patientSchema)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 404, body: errorBody });
  });

  it('tolerates error responses without a JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })),
    );

    await expect(
      apiClient.get('/clinic/patients', patientSchema),
    ).rejects.toMatchObject({ status: 502, body: null });
  });
});
