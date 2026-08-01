import { describe, it, expect, vi } from 'vitest';
import { basicAuthMiddleware } from '../../src/server/auth.js';

function makeRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function encode(user: string, pass: string) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('basicAuthMiddleware', () => {
  const middleware = basicAuthMiddleware('gustavo', 'segredo123');

  it('calls next() with correct credentials', () => {
    const req = { headers: { authorization: encode('gustavo', 'segredo123') } } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('rejects missing credentials with 401', () => {
    const req = { headers: {} } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Basic');
  });

  it('rejects wrong password with 401', () => {
    const req = { headers: { authorization: encode('gustavo', 'errada') } } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
