import type { Instrumentation } from 'next';
import { captureError } from './lib/errorReporting';

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  captureError(error, { method: request.method, route: context.routePath, routeType: context.routeType });
};
