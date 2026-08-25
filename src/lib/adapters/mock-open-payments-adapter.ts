/**
 * MockOpenPaymentsAdapter
 * 
 * Simulates the Open Payments PSD2 API for demo purposes.
 * All responses are clearly labeled as MOCK.
 * 
 * Simulates the real SCA flow: payments start as RCVD and
 * transition to ACTC (simulating bank authorization).
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IOpenPaymentsAdapter,
  OpenPaymentsAccount,
  OpenPaymentsBalance,
  OpenPaymentsTransaction,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatusResponse,
} from './open-payments-adapter.interface';

// Simulated payment store for status tracking
const paymentStore = new Map<string, {
  status: 'RCVD' | 'ACTC' | 'ACSC' | 'RJCT' | 'CANC';
  request: PaymentInitiationRequest;
  createdAt: string;
}>();

// Idempotency store
const idempotencyStore = new Map<string, PaymentInitiationResponse>();

export class MockOpenPaymentsAdapter implements IOpenPaymentsAdapter {
  readonly mode = 'MOCK' as const;

  async verifyPayee(request: { creditorIban: string; creditorName: string }) {
    const isNameMatch = request.creditorName.toLowerCase().includes('nordic');
    return {
      matchResult: isNameMatch ? ('MATCH' as const) : ('NO_MATCH' as const),
      nameMatched: isNameMatch,
      ibanValid: true,
      creditorNameActual: 'Nordic Components AB',
      isMocked: true,
    };
  }

  async getAccessToken(_scope: string): Promise<string> {
    return 'mock-access-token-' + uuidv4().slice(0, 8);
  }

  async getAccounts(): Promise<OpenPaymentsAccount[]> {
    return [
      {
        accountId: 'mock-acct-buyer-001',
        iban: 'SE** **** **** **** **01', // masked
        currency: 'EUR',
        name: 'Aurora Retail AB Operating Account',
        balances: [
          {
            balanceType: 'interimAvailable',
            amount: 24000, // Enough for EUR 4k with EUR 20k reserve
            currency: 'EUR',
            lastChangeDateTime: new Date().toISOString(),
          },
        ],
      },
      {
        accountId: 'mock-acct-supplier-001',
        iban: 'SE** **** **** **** **02', // masked
        currency: 'EUR',
        name: 'Nordic Components AB Receiving Account',
      },
    ];
  }

  async getBalances(accountId: string): Promise<OpenPaymentsBalance[]> {
    if (accountId === 'mock-acct-buyer-001') {
      return [
        {
          balanceType: 'interimAvailable',
          amount: 24000,
          currency: 'EUR',
          lastChangeDateTime: new Date().toISOString(),
        },
        {
          balanceType: 'expected',
          amount: 32000, // includes forecasted incoming
          currency: 'EUR',
          lastChangeDateTime: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  async getTransactions(
    accountId: string,
    _dateFrom: string,
    _dateTo: string
  ): Promise<OpenPaymentsTransaction[]> {
    if (accountId === 'mock-acct-buyer-001') {
      return [
        {
          transactionId: 'mock-txn-001',
          amount: -3500,
          currency: 'EUR',
          bookingDate: '2026-08-20',
          valueDate: '2026-08-20',
          creditorName: 'Supplier X',
          remittanceInfo: 'INV-2026-0998',
          status: 'BOOKED',
        },
        {
          transactionId: 'mock-txn-002',
          amount: 8000,
          currency: 'EUR',
          bookingDate: '2026-08-22',
          valueDate: '2026-08-22',
          debtorName: 'Customer Y',
          remittanceInfo: 'Payment for services',
          status: 'PENDING',
        },
      ];
    }
    return [];
  }

  async initiatePayment(
    request: PaymentInitiationRequest,
    idempotencyKey: string
  ): Promise<PaymentInitiationResponse> {
    // Check idempotency
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing) {
      return existing;
    }

    const paymentId = 'mock-pay-' + uuidv4().slice(0, 12);
    
    // Simulate: payment is received but requires SCA
    paymentStore.set(paymentId, {
      status: 'RCVD',
      request,
      createdAt: new Date().toISOString(),
    });

    // Auto-authorize after a brief delay (simulating SCA completion)
    setTimeout(() => {
      const payment = paymentStore.get(paymentId);
      if (payment) {
        payment.status = 'ACTC'; // Accepted by bank
        // Simulate booking shortly after
        setTimeout(() => {
          const p = paymentStore.get(paymentId);
          if (p) p.status = 'ACSC'; // Settlement completed
        }, 1000);
      }
    }, 500);

    const response: PaymentInitiationResponse = {
      paymentId,
      transactionStatus: 'RCVD',
      scaRequired: true,
      scaApproach: 'DECOUPLED',
      isMocked: true,
    };

    idempotencyStore.set(idempotencyKey, response);
    return response;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const payment = paymentStore.get(paymentId);
    return {
      paymentId,
      transactionStatus: payment?.status ?? 'RCVD',
      isMocked: true,
    };
  }

  supportsFutureDatedPayments(): boolean {
    // The real API supports requestedExecutionDate
    return true;
  }
}
