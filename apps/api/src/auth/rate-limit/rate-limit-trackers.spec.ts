import type { Request } from 'express';
import { clientIp, clientIpTracker, emailTracker } from './rate-limit-trackers';

function request({
  realIp,
  socket = '100.64.0.7',
  body,
}: {
  realIp?: string;
  socket?: string;
  body?: unknown;
}): Request {
  return {
    get: (name: string) =>
      name.toLowerCase() === 'x-real-ip' ? realIp : undefined,
    socket: { remoteAddress: socket },
    body,
  } as unknown as Request;
}

describe('clientIp', () => {
  it('uses X-Real-IP when configured', () => {
    expect(clientIp(request({ realIp: ' 203.0.113.9 ' }), 'x-real-ip')).toBe(
      '203.0.113.9',
    );
  });

  it('ignores X-Real-IP when the source is the socket', () => {
    expect(clientIp(request({ realIp: '203.0.113.9' }), 'socket')).toBe(
      '100.64.0.7',
    );
  });

  it('falls back to the socket for a missing or invalid header', () => {
    expect(clientIp(request({}), 'x-real-ip')).toBe('100.64.0.7');
    expect(clientIp(request({ realIp: 'not-an-ip' }), 'x-real-ip')).toBe(
      '100.64.0.7',
    );
    expect(
      clientIp(request({ realIp: '203.0.113.9, 198.51.100.1' }), 'x-real-ip'),
    ).toBe('100.64.0.7');
  });
});

describe('clientIpTracker', () => {
  it('keeps IPv4 addresses and unwraps IPv4-mapped IPv6', () => {
    expect(clientIpTracker(request({ socket: '203.0.113.9' }), 'socket')).toBe(
      '203.0.113.9',
    );
    expect(
      clientIpTracker(request({ socket: '::ffff:203.0.113.9' }), 'socket'),
    ).toBe('203.0.113.9');
  });

  it('groups IPv6 addresses by /64 prefix', () => {
    const tracker = (ip: string) =>
      clientIpTracker(request({ realIp: ip }), 'x-real-ip');

    expect(tracker('2001:db8:1:2::1')).toBe(
      tracker('2001:DB8:1:2:ffff:ffff:ffff:ffff'),
    );
    expect(tracker('2001:db8:1:2::1')).not.toBe(tracker('2001:db8:1:3::1'));
  });
});

describe('emailTracker', () => {
  it('normalizes the email of the body', () => {
    expect(
      emailTracker(request({ body: { email: ' Ana@Example.COM ' } })),
    ).toBe('ana@example.com');
  });

  it('gives a body without a string email a shared key', () => {
    expect(emailTracker(request({}))).toBe('');
    expect(emailTracker(request({ body: { email: 42 } }))).toBe('');
  });
});
