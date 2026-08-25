/**
 * ZwapgridAdapter Interface
 *
 * Provides scoped access to accounting data. Each party (supplier/buyer) has
 * its own adapter instance and consent. Raw ledger data must never cross the
 * trust boundary between the two parties.
 */

export type ZwapgridScope = 'SUPPLIER' | 'BUYER';
export type ZwapgridDeploymentMode = 'mock' | 'test' | 'live';
export type ZwapgridMode = 'MOCK' | 'TEST' | 'LIVE';
export type ZwapgridInvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'DISPUTED';

export interface ZwapgridRequestContext {
  /** Correlates every API request with the settlement workflow. */
  correlationId?: string;
}

export interface ZwapgridAdapterOptions {
  apiKey?: string;
  consentId?: string;
  baseUrl?: string;
  /** Independent from Open Payments' INTEGRATION_MODE. */
  zwapgridMode?: ZwapgridDeploymentMode;
  /** Allows tests to construct a live adapter without reading process.env. */
  liveEnabled?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ZwapgridInvoice {
  id: string;
  invoiceNumber: string;
  counterpartyName: string;
  counterpartyOrgNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: ZwapgridInvoiceStatus;
  /** Amount remaining to be paid, when supplied by the accounting system. */
  outstandingAmount: number;
  lastPaymentDate: string | null;
  externalRef: string;
  retrievedAt: string;
  /** Original provider status, retained for diagnostics without changing the domain enum. */
  providerStatus?: string;
}

export interface ZwapgridPayable {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierOrgNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: ZwapgridInvoiceStatus;
  outstandingAmount: number;
  hasDisputeFlag: boolean;
  disputeReason: string | null;
  externalRef: string;
  retrievedAt: string;
  providerStatus?: string;
}

export interface ZwapgridPayment {
  id: string;
  reference: string | null;
  amount: number;
  currency: string | null;
  paidDate: string | null;
  receivedDate: string | null;
  booked: boolean | null;
}

export class ZwapgridIntegrationError extends Error {
  readonly name = 'ZwapgridIntegrationError';
  readonly statusCode: number | null;
  readonly code: string;
  readonly correlationId: string;

  constructor(params: {
    message: string;
    code: string;
    correlationId: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.statusCode = params.statusCode ?? null;
    this.code = params.code;
    this.correlationId = params.correlationId;
  }
}

export interface IZwapgridAdapter {
  readonly mode: ZwapgridMode;
  readonly scope: ZwapgridScope;

  /**
   * Supplier scope: retrieve an invoice from the supplier's accounts receivable.
   */
  getSupplierInvoice(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<ZwapgridInvoice | null>;

  /**
   * Supplier scope: check whether a payment has been recorded for the invoice.
   */
  checkPaymentRecorded(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<boolean>;

  /**
   * Buyer scope: retrieve a matching payable from the buyer's accounts payable.
   */
  getBuyerPayable(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<ZwapgridPayable | null>;

  /**
   * Buyer scope: retrieve payment/dispute status for a payable.
   */
  getPayableStatus(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<{
    status: ZwapgridInvoiceStatus;
    hasDisputeFlag: boolean;
    disputeReason: string | null;
  }>;
}
