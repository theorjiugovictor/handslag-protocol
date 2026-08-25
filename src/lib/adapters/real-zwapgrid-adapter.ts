import { v4 as uuidv4 } from 'uuid';
import type {
  IZwapgridAdapter,
  ZwapgridAdapterOptions,
  ZwapgridInvoice,
  ZwapgridPayable,
  ZwapgridRequestContext,
  ZwapgridScope,
  ZwapgridInvoiceStatus,
} from './zwapgrid-adapter.interface';
import { ZwapgridIntegrationError } from './zwapgrid-adapter.interface';

type JsonRecord = Record<string, any>;

const DEFAULT_BASE_URL = 'https://apione.zwapgrid.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    const candidate = typeof value === 'object' && value !== null && 'amount' in value
      ? (value as JsonRecord).amount
      : value;
    const number = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function stringValue(...values: unknown[]): string | null {
  for (const value of values) {
    const result = nonEmpty(value);
    if (result) return result;
  }
  return null;
}

function currencyValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'object' && value !== null) {
      const nested = stringValue((value as JsonRecord).currencyId, (value as JsonRecord).currency);
      if (nested) return nested;
    }
    const result = nonEmpty(value);
    if (result) return result;
  }
  return null;
}

function partyName(party: unknown): string | null {
  const record = party as JsonRecord | null;
  return stringValue(
    record?.party?.partyName?.name,
    record?.party?.partyLegalEntity?.registrationName,
    record?.partyName?.name,
    record?.partyLegalEntity?.registrationName,
    record?.name
  );
}

function partyOrgNumber(party: unknown): string | null {
  const record = party as JsonRecord | null;
  return stringValue(
    record?.party?.partyLegalEntity?.companyId?.id,
    record?.party?.partyIdentification?.[0]?.id,
    record?.party?.customerAssignedAccountId?.id,
    record?.party?.supplierAssignedAccountId?.id,
    record?.partyLegalEntity?.companyId?.id,
    record?.partyIdentification?.[0]?.id,
    record?.customerAssignedAccountId?.id,
    record?.supplierAssignedAccountId?.id
  );
}

function normalizeStatus(value: unknown, outstandingAmount: number, hasDispute = false): ZwapgridInvoiceStatus {
  if (hasDispute) return 'DISPUTED';
  const status = String(value ?? '').toUpperCase();
  if (status === 'PAID' || status === 'SETTLED' || status === 'FULLY_PAID') return 'PAID';
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID' || status === 'PARTIALLYPAID') return 'PARTIAL';
  if (status === 'DISPUTED' || status === 'CANCELLED') return 'DISPUTED';
  return outstandingAmount <= 0 ? 'PAID' : 'UNPAID';
}

function pageItems(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload as JsonRecord[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as JsonRecord).data)) {
    return (payload as JsonRecord).data as JsonRecord[];
  }
  return payload && typeof payload === 'object' ? [payload as JsonRecord] : [];
}

function invoiceReferences(item: JsonRecord): string[] {
  return [item.reference, item.invoiceNumber, item.sellerReference, item.buyerReference]
    .map(value => nonEmpty(value))
    .filter((value): value is string => value !== null);
}

function referencesMatch(item: JsonRecord, requestedReference: string): boolean {
  const requested = requestedReference.trim().toLowerCase();
  return invoiceReferences(item).some(reference => reference.toLowerCase() === requested);
}

export class RealZwapgridAdapter implements IZwapgridAdapter {
  readonly mode: 'TEST' | 'LIVE';
  readonly scope: ZwapgridScope;
  private readonly apiKey: string;
  private readonly consentId: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(scope: ZwapgridScope, opts: ZwapgridAdapterOptions = {}) {
    this.scope = scope;
    const configuredMode = opts.zwapgridMode ?? process.env.ZWAPGRID_MODE ?? 'test';
    this.mode = configuredMode === 'live' ? 'LIVE' : 'TEST';
    this.apiKey = (opts.apiKey ?? process.env.ZWAPGRID_API_KEY ?? '').replace(/\r?\n|\r/g, '').trim();
    this.consentId = (
      opts.consentId
      ?? (scope === 'SUPPLIER'
        ? process.env.ZWAPGRID_SUPPLIER_CONSENT_ID
        : process.env.ZWAPGRID_BUYER_CONSENT_ID)
      ?? process.env.ZWAPGRID_CONSENT_ID
      ?? ''
    ).replace(/\r?\n|\r/g, '').trim();
    this.baseUrl = (opts.baseUrl ?? process.env.ZWAPGRID_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? (Number(process.env.ZWAPGRID_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    this.maxRetries = opts.maxRetries ?? (Number(process.env.ZWAPGRID_MAX_RETRIES) || DEFAULT_MAX_RETRIES);
    this.retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  private ensureConfigured(correlationId: string): void {
    if (!this.apiKey || !this.consentId) {
      throw new ZwapgridIntegrationError({
        message: 'Zwapgrid requires ZWAPGRID_API_KEY and ZWAPGRID_CONSENT_ID in real mode',
        code: 'NOT_CONFIGURED',
        correlationId,
      });
    }
  }

  private async request(path: string, context: ZwapgridRequestContext = {}, init: RequestInit = {}): Promise<unknown> {
    const correlationId = context.correlationId || uuidv4();
    this.ensureConfigured(correlationId);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'x-api-key': this.apiKey,
            'x-correlation-id': correlationId,
            ...(init.headers || {}),
          },
        });
        clearTimeout(timeout);

        if (response.ok) {
          if (response.status === 204) return null;
          return await response.json();
        }

        let body: unknown;
        try { body = await response.json(); } catch { body = undefined; }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === this.maxRetries) {
          throw new ZwapgridIntegrationError({
            message: `Zwapgrid request failed with HTTP ${response.status}`,
            code: response.status === 501 ? 'UNSUPPORTED' : response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
            statusCode: response.status,
            correlationId,
            cause: body,
          });
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof ZwapgridIntegrationError) throw error;
        lastError = error;
        if (attempt === this.maxRetries) {
          throw new ZwapgridIntegrationError({
            message: error instanceof Error && error.name === 'AbortError' ? 'Zwapgrid request timed out' : 'Zwapgrid request failed',
            code: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
            correlationId,
            cause: error,
          });
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
    }
    throw lastError;
  }

  private async findInvoice(path: string, invoiceNumber: string, context?: ZwapgridRequestContext): Promise<JsonRecord | null> {
    const count = 100;
    let currentPage = 1;
    let totalPages = 1;

    do {
      const payload = await this.request(
        `${path}?Count=${count}&CurrentPage=${currentPage}&Include=paymentStatus`,
        context
      );
      const item = pageItems(payload).find(candidate => referencesMatch(candidate, invoiceNumber));
      if (item) return item;

      const meta = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as JsonRecord).meta
        : undefined;
      const reportedTotalPages = Number(meta?.totalPages);
      totalPages = Number.isFinite(reportedTotalPages) && reportedTotalPages > 0
        ? reportedTotalPages
        : pageItems(payload).length < count ? currentPage : currentPage + 1;
      currentPage++;
    } while (currentPage <= totalPages);

    return null;
  }

  private mapInvoice(item: JsonRecord, retrievedAt: string): ZwapgridInvoice {
    const amount = numberValue(
      item.legalMonetaryTotal?.payableAmount,
      item.legalMonetaryTotal?.amount,
      item.totalAmount,
      item.amount,
      item.totalBalanceAmount
    );
    const outstandingAmount = numberValue(
      item.outstandingAmount,
      item.totalBalanceAmount,
      item.legalMonetaryTotal?.payableAmount,
      amount
    );
    const currency = currencyValue(
      item.documentCurrencyCode,
      item.legalMonetaryTotal?.payableAmount,
      item.legalMonetaryTotal,
      item.totalBalanceAmount
    );
    const number = invoiceReferences(item)[0];
    if (!number || amount === null || outstandingAmount === null || !currency || !stringValue(item.issueDate) || !stringValue(item.dueDate)) {
      throw new Error('Zwapgrid invoice payload is missing reference, amount, currency, issueDate, or dueDate');
    }
    const paymentStatus = stringValue(item.paymentStatus?.status, item.status);
    return {
      id: stringValue(item.id) || number,
      invoiceNumber: number,
      counterpartyName: partyName(item.accountingCustomerParty) || 'Unknown counterparty',
      counterpartyOrgNumber: partyOrgNumber(item.accountingCustomerParty) || '',
      amount,
      currency,
      issueDate: item.issueDate,
      dueDate: item.dueDate,
      status: normalizeStatus(paymentStatus, outstandingAmount),
      outstandingAmount,
      lastPaymentDate: stringValue(item.paymentStatus?.settlementDate, item.paymentDate),
      externalRef: stringValue(item.externalId, item.id, item.reference) || number,
      retrievedAt,
      providerStatus: paymentStatus || undefined,
    };
  }

  private mapPayable(item: JsonRecord, retrievedAt: string): ZwapgridPayable {
    const amount = numberValue(
      item.legalMonetaryTotal?.payableAmount,
      item.legalMonetaryTotal?.amount,
      item.totalAmount,
      item.amount,
      item.totalBalanceAmount
    );
    const outstandingAmount = numberValue(
      item.outstandingAmount,
      item.totalBalanceAmount,
      item.legalMonetaryTotal?.payableAmount,
      amount
    );
    const currency = currencyValue(
      item.documentCurrencyCode,
      item.legalMonetaryTotal?.payableAmount,
      item.legalMonetaryTotal,
      item.totalBalanceAmount
    );
    const number = invoiceReferences(item)[0];
    if (!number || amount === null || outstandingAmount === null || !currency || !stringValue(item.issueDate) || !stringValue(item.dueDate)) {
      throw new Error('Zwapgrid supplier invoice payload is missing reference, amount, currency, issueDate, or dueDate');
    }
    const disputeReason = stringValue(
      item.disputeReason,
      item.notes?.find((note: JsonRecord) => String(note.text || '').toLowerCase().includes('dispute'))?.text
    );
    const hasDisputeFlag = Boolean(item.hasDisputeFlag || disputeReason);
    const paymentStatus = stringValue(item.paymentStatus?.status, item.status);
    return {
      id: stringValue(item.id) || number,
      invoiceNumber: number,
      supplierName: partyName(item.accountingSupplierParty) || 'Unknown supplier',
      supplierOrgNumber: partyOrgNumber(item.accountingSupplierParty) || '',
      amount,
      currency,
      issueDate: item.issueDate,
      dueDate: item.dueDate,
      status: normalizeStatus(paymentStatus, outstandingAmount, hasDisputeFlag),
      outstandingAmount,
      hasDisputeFlag,
      disputeReason: disputeReason || null,
      externalRef: stringValue(item.externalId, item.id, item.reference) || number,
      retrievedAt,
      providerStatus: paymentStatus || undefined,
    };
  }

  async getSupplierInvoice(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<ZwapgridInvoice | null> {
    if (this.scope !== 'SUPPLIER') throw new Error('[TRUST BOUNDARY] Buyer agent cannot access supplier invoice data');
    const retrievedAt = new Date().toISOString();
    const item = await this.findInvoice(`/accounting/api/v1/consents/${this.consentId}/salesinvoices`, invoiceNumber, context);
    return item ? this.mapInvoice(item, retrievedAt) : null;
  }

  async checkPaymentRecorded(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<boolean> {
    if (this.scope !== 'SUPPLIER') throw new Error('[TRUST BOUNDARY] Buyer agent cannot check supplier payment records');
    const invoice = await this.getSupplierInvoice(invoiceNumber, context);
    if (!invoice) return false;
    const payload = await this.request(`/accounting/api/v1/consents/${this.consentId}/salesinvoices/${encodeURIComponent(invoice.id)}/payments`, context);
    return pageItems(payload).some(payment => (numberValue(payment.amount, payment.creditAmount) || 0) > 0);
  }

  async getBuyerPayable(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<ZwapgridPayable | null> {
    if (this.scope !== 'BUYER') throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable data');
    const retrievedAt = new Date().toISOString();
    const item = await this.findInvoice(`/accounting/api/v1/consents/${this.consentId}/supplierinvoices`, invoiceNumber, context);
    return item ? this.mapPayable(item, retrievedAt) : null;
  }

  async getPayableStatus(invoiceNumber: string, context?: ZwapgridRequestContext): Promise<{ status: ZwapgridInvoiceStatus; hasDisputeFlag: boolean; disputeReason: string | null }> {
    if (this.scope !== 'BUYER') throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable status');
    const payable = await this.getBuyerPayable(invoiceNumber, context);
    if (!payable) return { status: 'UNPAID', hasDisputeFlag: false, disputeReason: null };
    const payload = await this.request(`/accounting/api/v1/consents/${this.consentId}/supplierinvoices/${encodeURIComponent(payable.id)}/payments`, context);
    const paid = pageItems(payload).reduce((sum, payment) => sum + (numberValue(payment.amount, payment.creditAmount) || 0), 0);
    const status = paid >= payable.amount ? 'PAID' : paid > 0 ? 'PARTIAL' : payable.status;
    return { status, hasDisputeFlag: payable.hasDisputeFlag, disputeReason: payable.disputeReason };
  }
}
