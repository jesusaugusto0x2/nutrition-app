import {
  type ArgumentsHost,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { createPatientSchema } from '@nutri/schemas';
import { ZodValidationException } from 'nestjs-zod';
import { AllExceptionsFilter } from './all-exceptions.filter';

function setup() {
  const reply = vi.fn();
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);
  const request = {
    method: 'POST',
    originalUrl: '/api/clinic/patients/123',
    route: { path: '/api/clinic/patients/:patientId' },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);

  const run = (exception: unknown) => {
    filter.catch(exception, host);
    const [, body, status] = reply.mock.calls[0];
    return { body, status };
  };

  return { run, logError };
}

describe('AllExceptionsFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps HTTP exceptions to the shared error shape', () => {
    const { run } = setup();

    const { body, status } = run(new NotFoundException('Patient not found'));

    expect(status).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Patient not found',
      path: '/api/clinic/patients/123',
      timestamp: expect.any(String),
    });
  });

  it('keeps an explicit error code given by the exception', () => {
    const { run } = setup();

    const { body, status } = run(
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      }),
    );

    expect(status).toBe(401);
    expect(body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('ignores an unknown code and falls back to the status code', () => {
    const { run } = setup();

    const { body } = run(new UnauthorizedException({ code: 'MADE_UP' }));

    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns validation issues as details', () => {
    const { run } = setup();
    const zodError = createPatientSchema.safeParse({}).error;

    const { body, status } = run(new ZodValidationException(zodError));

    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toContainEqual(
      expect.objectContaining({ path: 'firstName' }),
    );
  });

  it('keeps the message of intentional 503 responses', () => {
    const { run } = setup();

    const { body } = run(new ServiceUnavailableException('Database down'));

    expect(body).toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database down',
    });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const { run } = setup();

    const { body, status } = run(
      new Error('duplicate key value (first_name)=(María)'),
    );

    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('never logs error messages, which may contain patient data', () => {
    const { run, logError } = setup();

    run(new Error('duplicate key value (first_name)=(María)'));

    const logged = logError.mock.calls.flat().join('\n');
    expect(logged).toContain('POST /api/clinic/patients/:patientId -> 500');
    expect(logged).not.toContain('María');
  });

  it('does not log client errors', () => {
    const { run, logError } = setup();

    run(new NotFoundException());

    expect(logError).not.toHaveBeenCalled();
  });
});
