/**
 * ZwapgridAdapter Interface
 * 
 * Provides scoped access to accounting data.
 * Each party (supplier/buyer) has its own adapter instance with its own scope.
 * One party must NEVER access the other party's raw ledger data.
 */

export interface ZwapgridInvoice {
  id: string;
  invoiceNumber: string;
  counterpartyName: string;
  counterpartyOrgNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'DISPUTED';
  outstandingAmount: number;
  lastPaymentDate: string | null;
  externalRef: string;
  retrievedAt: string;
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
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'DISPUTED';
  outstandingAmount: number;
  hasDisputeFlag: boolean;
  disputeReason: string | null;
  externalRef: string;
  retrievedAt: string;
}

export interface IZwapgridAdapter {
  readonly mode: 'REAL' | 'MOCK';
  readonly scope: 'SUPPLIER' | 'BUYER';

  /**
   * Supplier scope: Retrieve invoice from supplier's accounts receivable
   */
  getSupplierInvoice(invoiceNumber: string): Promise<ZwapgridInvoice | null>;

  /**
   * Supplier scope: Check if a payment has been recorded for the invoice
   */
  checkPaymentRecorded(invoiceNumber: string): Promise<boolean>;

  /**
   * Buyer scope: Retrieve matching payable from buyer's accounts payable
   */
  getBuyerPayable(invoiceNumber: string): Promise<ZwapgridPayable | null>;

  /**
   * Buyer scope: Retrieve payment/dispute status
   */
  getPayableStatus(invoiceNumber: string): Promise<{
    status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'DISPUTED';
    hasDisputeFlag: boolean;
    disputeReason: string | null;
  }>;
}
