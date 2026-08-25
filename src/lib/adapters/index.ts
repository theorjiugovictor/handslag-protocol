export type {
  IZwapgridAdapter,
  ZwapgridInvoice,
  ZwapgridPayable,
  ZwapgridPayment,
  ZwapgridAdapterOptions,
  ZwapgridRequestContext,
  ZwapgridScope,
  ZwapgridMode,
  ZwapgridDeploymentMode,
} from './zwapgrid-adapter.interface';
export { ZwapgridIntegrationError } from './zwapgrid-adapter.interface';
export { MockOpenPaymentsAdapter } from './mock-open-payments-adapter';
export { RealOpenPaymentsAdapter } from './real-open-payments-adapter';
export { MockZwapgridAdapter } from './mock-zwapgrid-adapter';
export { RealZwapgridAdapter } from './real-zwapgrid-adapter';

import type {
  IZwapgridAdapter,
  ZwapgridAdapterOptions,
  ZwapgridDeploymentMode,
  ZwapgridScope,
} from './zwapgrid-adapter.interface';
import { MockZwapgridAdapter } from './mock-zwapgrid-adapter';
import { RealZwapgridAdapter } from './real-zwapgrid-adapter';
import { ZwapgridIntegrationError } from './zwapgrid-adapter.interface';

export function getZwapgridDeploymentMode(): ZwapgridDeploymentMode {
  const configured = (process.env.ZWAPGRID_MODE || 'mock').toLowerCase();
  if (configured === 'mock' || configured === 'test' || configured === 'live') return configured;
  throw new ZwapgridIntegrationError({
    message: `Invalid ZWAPGRID_MODE "${configured}". Expected mock, test, or live.`,
    code: 'INVALID_MODE',
    correlationId: 'configuration',
  });
}

/**
 * Selects Zwapgrid independently from Open Payments. Live mode is fail-closed
 * unless the operator explicitly enables it.
 */
export function createZwapgridAdapter(
  scope: ZwapgridScope,
  options: ZwapgridAdapterOptions = {}
): IZwapgridAdapter {
  const mode = options.zwapgridMode ?? getZwapgridDeploymentMode();
  if (mode === 'mock') return new MockZwapgridAdapter(scope);
  if (mode === 'live' && !(options.liveEnabled ?? process.env.ZWAPGRID_LIVE_ENABLED === 'true')) {
    throw new ZwapgridIntegrationError({
      message: 'Zwapgrid live mode is disabled. Set ZWAPGRID_LIVE_ENABLED=true to enable production accounting data.',
      code: 'LIVE_MODE_DISABLED',
      correlationId: 'configuration',
    });
  }
  return new RealZwapgridAdapter(scope, options);
}
