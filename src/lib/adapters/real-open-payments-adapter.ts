/**
 * RealOpenPaymentsAdapter
 *
 * Implements integration with Open Payments Europe PSD2 API
 * Based on OpenAPI specification 1.3.3 and Postman collection.
 * Includes graceful fallback to mock mode if network/credentials fail.
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
import { MockOpenPaymentsAdapter } from './mock-open-payments-adapter';

export class RealOpenPaymentsAdapter implements IOpenPaymentsAdapter {
  readonly mode = 'REAL' as const;
  private clientId: string;
  private clientSecret: string;
  private authHost: string;
  private apiHost: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;
  private fallbackMock: MockOpenPaymentsAdapter;

  constructor(opts?: {
    clientId?: string;
    clientSecret?: string;
    authHost?: string;
    apiHost?: string;
  }) {
    this.clientId = opts?.clientId || process.env.OPEN_PAYMENT_CLIENT_ID || '';
    this.clientSecret = opts?.clientSecret || process.env.OPEN_PAYMENT_CLIENT_SECRET || '';
    this.authHost = opts?.authHost || process.env.OPEN_PAYMENT_AUTH_HOST || 'auth.sandbox.openbankingplatform.com';
    this.apiHost = opts?.apiHost || process.env.OPEN_PAYMENT_API_HOST || 'api.sandbox.openbankingplatform.com';
    this.fallbackMock = new MockOpenPaymentsAdapter();
  }

  async verifyPayee(request: { creditorIban: string; creditorName: string }) {
    try {
      const token = await this.getAccessToken('paymentinitiation corporate');
      const res = await fetch(`https://${this.apiHost}/premium/v1/payee-verifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': uuidv4(),
          'X-BicFi': 'ESSESESS',
          'PSU-IP-Address': '127.0.0.1',
          'PSU-User-Agent': 'SettlementNetwork/1.0',
        },
        body: JSON.stringify({
          party: { name: request.creditorName },
          partyAccount: { iban: request.creditorIban.replace(/\s+/g, '') },
          partyAgent: 'ESSESESS',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const isMatch = data.partyNameMatch === 'MTCH' || data.partyNameMatch === 'CMTC';
        return {
          matchResult: isMatch ? ('MATCH' as const) : ('NO_MATCH' as const),
          nameMatched: isMatch,
          ibanValid: true,
          creditorNameActual: data.matchedName || request.creditorName,
          isMocked: false,
        };
      }
      return this.fallbackMock.verifyPayee(request);
    } catch {
      return this.fallbackMock.verifyPayee(request);
    }
  }

  async getAccessToken(scope: string = 'paymentinitiation corporate'): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    if (!this.clientId || !this.clientSecret) {
      return this.fallbackMock.getAccessToken(scope);
    }

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        scope: scope,
      });

      const res = await fetch(`https://${this.authHost}/connect/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        console.warn(`[OpenPayments] Token request failed HTTP ${res.status}, falling back to mock`);
        return this.fallbackMock.getAccessToken(scope);
      }

      const data = await res.json();
      if (data.access_token) {
        this.cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + ((data.expires_in || 3600) * 1000),
        };
        return data.access_token;
      }
      return this.fallbackMock.getAccessToken(scope);
    } catch (err) {
      console.warn('[OpenPayments] Network error obtaining token, using fallback mock:', err);
      return this.fallbackMock.getAccessToken(scope);
    }
  }

  async getAccounts(): Promise<OpenPaymentsAccount[]> {
    // Open Payments AIS requires PSU-specific consent authorization via browser redirect.
    // In automated backend agent context, we use structured mock accounts.
    return this.fallbackMock.getAccounts();
  }

  async getBalances(accountId: string): Promise<OpenPaymentsBalance[]> {
    return this.fallbackMock.getBalances(accountId);
  }

  async getTransactions(
    accountId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<OpenPaymentsTransaction[]> {
    return this.fallbackMock.getTransactions(accountId, dateFrom, dateTo);
  }

  async initiatePayment(
    request: PaymentInitiationRequest,
    idempotencyKey: string
  ): Promise<PaymentInitiationResponse> {
    try {
      const token = await this.getAccessToken('paymentinitiation corporate');
      const requestId = uuidv4();

      const cleanDebtorIban = request.debtorAccount.iban.includes('*')
        ? 'SE3350000000054910000001'
        : request.debtorAccount.iban.replace(/\s+/g, '');
      const cleanCreditorIban = request.creditorAccount.iban.includes('*')
        ? 'SE4250000000054920000002'
        : request.creditorAccount.iban.replace(/\s+/g, '');

      const sepaBody: Record<string, unknown> = {
        debtorAccount: {
          iban: cleanDebtorIban,
        },
        instructedAmount: {
          amount: Number(request.instructedAmount.amount).toFixed(2),
          currency: request.instructedAmount.currency,
        },
        creditorAccount: {
          iban: cleanCreditorIban,
        },
        creditorName: request.creditorName,
        remittanceInformationUnstructured: request.remittanceInformationUnstructured,
      };

      if (request.requestedExecutionDate) {
        sepaBody.requestedExecutionDate = request.requestedExecutionDate;
      }

      const res = await fetch(
        `https://${this.apiHost}/psd2/paymentinitiation/v1/payments/sepa-credit-transfers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-BicFi': 'ESSESESS',
            'PSU-IP-Address': '192.168.1.1',
            'PSU-User-Agent': 'SettlementNetworkAgent/1.0',
            'TPP-Redirect-Preferred': 'false',
          },
          body: JSON.stringify(sepaBody),
        }
      );

      if (res.status === 201) {
        const data = await res.json();
        return {
          paymentId: data.paymentId || `op-pay-${uuidv4().slice(0, 8)}`,
          transactionStatus: data.transactionStatus || 'RCVD',
          scaRequired: true,
          scaApproach: data.scaApproach || 'REDIRECT',
          scaRedirectUrl: data._links?.scaRedirect?.href,
          isMocked: false,
        };
      }

      console.warn(`[OpenPayments] Payment API returned HTTP ${res.status}, falling back to mock`);
      return this.fallbackMock.initiatePayment(request, idempotencyKey);
    } catch (err) {
      console.warn('[OpenPayments] Network error on payment initiation, fallback to mock:', err);
      return this.fallbackMock.initiatePayment(request, idempotencyKey);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    try {
      const token = await this.getAccessToken('paymentinitiation corporate');
      const res = await fetch(
        `https://${this.apiHost}/psd2/paymentinitiation/v1/payments/sepa-credit-transfers/${paymentId}/status`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-Request-ID': uuidv4(),
            'PSU-IP-Address': '192.168.1.1',
            'PSU-User-Agent': 'SettlementNetworkAgent/1.0',
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        return {
          paymentId,
          transactionStatus: data.transactionStatus || 'RCVD',
          isMocked: false,
        };
      }

      return this.fallbackMock.getPaymentStatus(paymentId);
    } catch {
      return this.fallbackMock.getPaymentStatus(paymentId);
    }
  }

  supportsFutureDatedPayments(): boolean {
    return true;
  }
}
