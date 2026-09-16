import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureError } from '../lib/errorReporting';
import { captureCallError, captureCallEvent, recordCallMetric } from '../lib/messenger/callDiagnostics';
import { onRequestError } from '../instrumentation';
import { safeError } from '../lib/api-error';
import config from '../next.config';

const lastJson = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
afterEach(() => vi.restoreAllMocks());

describe('local error visibility without an external transport', () => {
  it('preserves errors and context while redacting credential fields', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureError(new Error('payment rejected'), { context: 'orders.POST', authorization: 'sensitive-value' });
    expect(lastJson(error)).toMatchObject({ ctx: 'captureError', context: 'orders.POST', authorization: '[redacted]', err: { message: 'payment rejected' } });
  });
  it('logs call errors, severity and numeric counts at the actual helper boundary', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    captureCallError(new Error('camera unavailable'), 'overlay', { stage_detail: 'toggle_camera' });
    expect(lastJson(error)).toMatchObject({ stage: 'overlay', stage_detail: 'toggle_camera', err: { message: 'camera unavailable' } });
    captureCallEvent('disconnected', 'realtime', 'warning', { call_id: 'call-1' });
    expect(lastJson(warn)).toMatchObject({ level: 'warn', stage: 'realtime', call_id: 'call-1', message: 'disconnected' });
    recordCallMetric('mark_missed_calls.marked_missed', 0);
    expect(lastJson(info)).toMatchObject({ metric: 'mark_missed_calls.marked_missed', value: 0 });
  });
  it('contains circular error values and a throwing console', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    vi.spyOn(console, 'error').mockImplementation(() => { throw new Error('console unavailable'); });
    expect(() => captureError(circular)).not.toThrow();
    expect(() => captureCallError(circular, 'hangup')).not.toThrow();
  });
  it('API failures keep their status and generic message when console logging fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { throw new Error('console unavailable'); });
    const response = safeError('orders.POST', new Error('internal database details'), 503);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Something Went Wrong. Please Try Again.' });
  });
  it('does not expose source maps or allow the retired ingest endpoints through CSP', async () => {
    expect(config.productionBrowserSourceMaps).not.toBe(true);
    const headers = await config.headers!();
    const policies = headers.flatMap(row => row.headers).filter(row => row.key.startsWith('Content-Security-Policy'));
    expect(policies.length).toBe(2);
    expect(policies.every(row => !row.value.includes('sentry.io'))).toBe(true);
    expect(policies[0].value).toContain('https://api.stripe.com');
  });
  it('framework request errors log route identity without headers or URL query', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    onRequestError(new Error('route failed'), {
      method: 'POST', path: '/orders?token=sensitive-query', headers: { authorization: 'sensitive-header' },
    }, { routePath: '/orders', routeType: 'route', routerKind: 'App Router', renderSource: 'server-rendering', revalidateReason: undefined, renderType: 'dynamic' });
    expect(lastJson(error)).toMatchObject({ method: 'POST', route: '/orders', routeType: 'route', err: { message: 'route failed' } });
    expect(JSON.stringify(error.mock.calls)).not.toContain('sensitive-');
  });
});
