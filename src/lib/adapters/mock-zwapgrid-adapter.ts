/**
 * MockZwapgridAdapter
 * 
 * Provides realistic demo data for the settlement scenario.
 * All data is clearly labeled as MOCK in the UI and audit log.
 */

import type { IZwapgridAdapter, ZwapgridInvoice, ZwapgridPayable } from './zwapgrid-adapter.interface';

const DEMO_INVOICE: ZwapgridInvoice = {
  id: 'zwp-inv-001',
  invoiceNumber: 'INV-2026-1042',
  counterpartyName: 'Aurora Retail AB',
  counterpartyOrgNumber: '559123-4568',
  amount: 10000,
  currency: 'EUR',
  issueDate: '2026-07-15',
  dueDate: '2026-08-02',
  status: 'UNPAID',
  outstandingAmount: 10000,
  lastPaymentDate: null,
  externalRef: 'zwp-mock-ref-supplier-001',
  retrievedAt: new Date().toISOString(),
};

const DEMO_PAYABLE: ZwapgridPayable = {
  id: 'zwp-pay-001',
  invoiceNumber: 'INV-2026-1042',
  supplierName: 'Nordic Components AB',
  supplierOrgNumber: '556789-0123',
  amount: 10000,
  currency: 'EUR',
  issueDate: '2026-07-15',
  dueDate: '2026-08-02',
  status: 'UNPAID',
  outstandingAmount: 10000,
  hasDisputeFlag: false,
  disputeReason: null,
  externalRef: 'zwp-mock-ref-buyer-001',
  retrievedAt: new Date().toISOString(),
};

export class MockZwapgridAdapter implements IZwapgridAdapter {
  readonly mode = 'MOCK' as const;
  readonly scope: 'SUPPLIER' | 'BUYER';

  constructor(scope: 'SUPPLIER' | 'BUYER') {
    this.scope = scope;
  }

  async getSupplierInvoice(invoiceNumber: string): Promise<ZwapgridInvoice | null> {
    if (this.scope !== 'SUPPLIER') {
      throw new Error('[TRUST BOUNDARY] Buyer agent cannot access supplier invoice data');
    }
    if (invoiceNumber === 'INV-2026-1042') {
      return { ...DEMO_INVOICE, retrievedAt: new Date().toISOString() };
    }
    return null;
  }

  async checkPaymentRecorded(invoiceNumber: string): Promise<boolean> {
    if (this.scope !== 'SUPPLIER') {
      throw new Error('[TRUST BOUNDARY] Buyer agent cannot check supplier payment records');
    }
    if (invoiceNumber === 'INV-2026-1042') {
      return false; // Invoice is unpaid in demo
    }
    return false;
  }

  async getBuyerPayable(invoiceNumber: string): Promise<ZwapgridPayable | null> {
    if (this.scope !== 'BUYER') {
      throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable data');
    }
    if (invoiceNumber === 'INV-2026-1042') {
      return { ...DEMO_PAYABLE, retrievedAt: new Date().toISOString() };
    }
    return null;
  }

  async getPayableStatus(invoiceNumber: string): Promise<{
    status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'DISPUTED';
    hasDisputeFlag: boolean;
    disputeReason: string | null;
  }> {
    if (this.scope !== 'BUYER') {
      throw new Error('[TRUST BOUNDARY] Supplier agent cannot access buyer payable status');
    }
    if (invoiceNumber === 'INV-2026-1042') {
      return {
        status: 'UNPAID',
        hasDisputeFlag: false,
        disputeReason: null,
      };
    }
    return { status: 'UNPAID', hasDisputeFlag: false, disputeReason: null };
  }
}
