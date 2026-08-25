import type {
  IZwapgridAdapter,
  ZwapgridInvoice,
  ZwapgridPayable,
  ZwapgridRequestContext,
} from './zwapgrid-adapter.interface';

const DEMO_INVOICE: ZwapgridInvoice = {
  id: 'zwp-inv-001', invoiceNumber: 'INV-2026-1042', counterpartyName: 'Aurora Retail AB',
  counterpartyOrgNumber: '559123-4568', amount: 10000, currency: 'EUR', issueDate: '2026-07-15',
  dueDate: '2026-08-02', status: 'UNPAID', outstandingAmount: 10000, lastPaymentDate: null,
  externalRef: 'zwp-mock-ref-supplier-001', retrievedAt: new Date().toISOString(), providerStatus: 'UNPAID',
};

const DEMO_PAYABLE: ZwapgridPayable = {
  id: 'zwp-pay-001', invoiceNumber: 'INV-2026-1042', supplierName: 'Nordic Components AB',
  supplierOrgNumber: '556789-0123', amount: 10000, currency: 'EUR', issueDate: '2026-07-15',
  dueDate: '2026-08-02', status: 'UNPAID', outstandingAmount: 10000, hasDisputeFlag: false,
  disputeReason: null, externalRef: 'zwp-mock-ref-buyer-001', retrievedAt: new Date().toISOString(), providerStatus: 'UNPAID',
};

export class MockZwapgridAdapter implements IZwapgridAdapter {
  readonly mode = 'MOCK' as const;
  readonly scope: 'SUPPLIER' | 'BUYER';

  constructor(scope: 'SUPPLIER' | 'BUYER') { this.scope = scope; }

  async getSupplierInvoice(invoiceNumber: string, _context?: ZwapgridRequestContext): Promise<ZwapgridInvoice | null> {
    if (this.scope !== 'SUPPLIER') throw new Error('[TRUST BOUNDARY] Buyer agent cannot access supplier invoice data');
    return invoiceNumber === DEMO_INVOICE.invoiceNumber ? { ...DEMO_INVOICE, retrievedAt: new Date().toISOString() } : null;
  }

  async checkPaymentRecorded(invoiceNumber: string, _context?: ZwapgridRequestContext): Promise<boolean> {
    if (this.scope !== 'SUPPLIER') throw new Error('[TRUST BOUNDARY] Buyer agent cannot check supplier payment records');
    return false && invoiceNumber === DEMO_INVOICE.invoiceNumber;
  }

  async getBuyerPayable(invoiceNumber: string, _context?: ZwapgridRequestContext): Promise<ZwapgridPayable | null> {
    if (this.scope !== 'BUYER') throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable data');
    return invoiceNumber === DEMO_PAYABLE.invoiceNumber ? { ...DEMO_PAYABLE, retrievedAt: new Date().toISOString() } : null;
  }

  async getPayableStatus(invoiceNumber: string, _context?: ZwapgridRequestContext): Promise<{ status: ZwapgridPayable['status']; hasDisputeFlag: boolean; disputeReason: string | null }> {
    if (this.scope !== 'BUYER') throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable status');
    return invoiceNumber === DEMO_PAYABLE.invoiceNumber
      ? { status: DEMO_PAYABLE.status, hasDisputeFlag: false, disputeReason: null }
      : { status: 'UNPAID', hasDisputeFlag: false, disputeReason: null };
  }
}
