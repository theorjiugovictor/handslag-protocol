/**
 * OpenPaymentsAdapter Interface
 * 
 * Provides access to Open Payments PSD2 API.
 * Symmetrical design — buyer uses for outgoing payments and liquidity,
 * supplier uses for incoming payment reconciliation.
 */

export interface OpenPaymentsAccount {
  accountId: string;
  iban: string;
  currency: string;
  name: string;
  balances?: OpenPaymentsBalance[];
}

export interface OpenPaymentsBalance {
  balanceType: string;
  amount: number;
  currency: string;
  lastChangeDateTime: string;
}

export interface OpenPaymentsTransaction {
  transactionId: string;
  amount: number;
  currency: string;
  bookingDate: string;
  valueDate: string;
  creditorName?: string;
  debtorName?: string;
  remittanceInfo?: string;
  status: 'BOOKED' | 'PENDING';
}

export interface PaymentInitiationRequest {
  debtorAccount: { iban: string; currency: string };
  creditorAccount: { iban: string };
  creditorName: string;
  instructedAmount: { amount: string; currency: string };
  remittanceInformationUnstructured: string;
  requestedExecutionDate?: string; // ISO date for future-dated
  endToEndIdentification?: string;
}

export interface PaymentInitiationResponse {
  paymentId: string;
  transactionStatus: 'RCVD' | 'ACTC' | 'ACSC' | 'RJCT' | 'CANC';
  scaRequired: boolean;
  scaRedirectUrl?: string;
  scaApproach?: 'EMBEDDED' | 'DECOUPLED' | 'REDIRECT';
  isMocked: boolean;
}

export interface PaymentStatusResponse {
  paymentId: string;
  transactionStatus: 'RCVD' | 'ACTC' | 'ACSC' | 'RJCT' | 'CANC';
  isMocked: boolean;
}

export interface PayeeVerificationRequest {
  creditorIban: string;
  creditorName: string;
}

export interface PayeeVerificationResponse {
  matchResult: 'MATCH' | 'CLOSE_MATCH' | 'NO_MATCH';
  nameMatched: boolean;
  ibanValid: boolean;
  creditorNameActual?: string;
  isMocked: boolean;
}

export interface IOpenPaymentsAdapter {
  readonly mode: 'REAL' | 'MOCK';

  /**
   * Pre-flight: Verification of Payee (EPC / PSD2 VoP)
   */
  verifyPayee(request: PayeeVerificationRequest): Promise<PayeeVerificationResponse>;

  /**
   * Obtain OAuth2 access token
   */
  getAccessToken(scope: string): Promise<string>;

  /**
   * List accounts (requires AIS consent)
   */
  getAccounts(): Promise<OpenPaymentsAccount[]>;

  /**
   * Get account balances (requires AIS consent)
   */
  getBalances(accountId: string): Promise<OpenPaymentsBalance[]>;

  /**
   * Get account transactions (requires AIS consent)
   */
  getTransactions(
    accountId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<OpenPaymentsTransaction[]>;

  /**
   * Initiate a payment (PIS)
   * Uses idempotency via endToEndIdentification
   */
  initiatePayment(
    request: PaymentInitiationRequest,
    idempotencyKey: string
  ): Promise<PaymentInitiationResponse>;

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Check if future-dated payments are supported
   */
  supportsFutureDatedPayments(): boolean;
}
