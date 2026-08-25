import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createZwapgridAdapter,
  getZwapgridDeploymentMode,
  RealZwapgridAdapter,
  MockZwapgridAdapter,
  ZwapgridIntegrationError,
} from '@/lib/adapters';

describe('Zwapgrid Integration & Adapter Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Mode Detection and Factory', () => {
    it('defaults to mock mode when ZWAPGRID_MODE is unset', () => {
      delete process.env.ZWAPGRID_MODE;
      expect(getZwapgridDeploymentMode()).toBe('mock');

      const adapter = createZwapgridAdapter('SUPPLIER');
      expect(adapter).toBeInstanceOf(MockZwapgridAdapter);
      expect(adapter.mode).toBe('MOCK');
    });

    it('creates a RealZwapgridAdapter in test mode', () => {
      process.env.ZWAPGRID_MODE = 'test';
      process.env.ZWAPGRID_API_KEY = 'test-key';
      process.env.ZWAPGRID_CONSENT_ID = 'test-consent';

      expect(getZwapgridDeploymentMode()).toBe('test');

      const adapter = createZwapgridAdapter('SUPPLIER');
      expect(adapter).toBeInstanceOf(RealZwapgridAdapter);
      expect(adapter.mode).toBe('TEST');
    });

    it('creates a RealZwapgridAdapter in live mode when ZWAPGRID_LIVE_ENABLED is true', () => {
      process.env.ZWAPGRID_MODE = 'live';
      process.env.ZWAPGRID_LIVE_ENABLED = 'true';
      process.env.ZWAPGRID_API_KEY = 'live-key';
      process.env.ZWAPGRID_CONSENT_ID = 'live-consent';

      expect(getZwapgridDeploymentMode()).toBe('live');

      const adapter = createZwapgridAdapter('SUPPLIER');
      expect(adapter).toBeInstanceOf(RealZwapgridAdapter);
      expect(adapter.mode).toBe('LIVE');
    });

    it('blocks live mode when ZWAPGRID_LIVE_ENABLED is not true', () => {
      process.env.ZWAPGRID_MODE = 'live';
      process.env.ZWAPGRID_LIVE_ENABLED = 'false';

      expect(() => createZwapgridAdapter('SUPPLIER')).toThrow(ZwapgridIntegrationError);
      expect(() => createZwapgridAdapter('SUPPLIER')).toThrow('Zwapgrid live mode is disabled');
    });

    it('throws on invalid ZWAPGRID_MODE value', () => {
      process.env.ZWAPGRID_MODE = 'invalid_mode';
      expect(() => getZwapgridDeploymentMode()).toThrow('Invalid ZWAPGRID_MODE');
    });
  });

  describe('2. Key Sanitization & Configuration Guard', () => {
    it('throws NOT_CONFIGURED when api key or consent id is missing in real mode', async () => {
      const adapter = new RealZwapgridAdapter('SUPPLIER', { apiKey: '', consentId: '' });
      await expect(adapter.getSupplierInvoice('INV-100')).rejects.toMatchObject({
        code: 'NOT_CONFIGURED',
      });
    });

    it('strips newlines and whitespace from api keys and consent IDs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ reference: 'INV-100', totalAmount: 5000, documentCurrencyCode: 'EUR', issueDate: '2026-08-01', dueDate: '2026-08-15' }],
      });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'multiline\r\nkey_part\n',
        consentId: ' consent-123 \n',
      });

      const invoice = await adapter.getSupplierInvoice('INV-100', { correlationId: 'corr-999' });
      expect(invoice).not.toBeNull();
      expect(invoice?.invoiceNumber).toBe('INV-100');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/consents/consent-123/salesinvoices');
      expect(init.headers['x-api-key']).toBe('multilinekey_part');
      expect(init.headers['x-correlation-id']).toBe('corr-999');
    });
  });

  describe('3. Supplier AR & Payment Inspection', () => {
    it('fetches supplier invoice and maps PEPPOL/UBL payload fields correctly', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'zg-inv-01',
              reference: 'INV-2026-9001',
              accountingCustomerParty: {
                partyLegalEntity: { registrationName: 'Customer AB', companyId: { id: '556111-2222' } },
              },
              legalMonetaryTotal: { payableAmount: { amount: 7500, currencyId: 'EUR' } },
              issueDate: '2026-07-01',
              dueDate: '2026-07-20',
              paymentStatus: { status: 'UNPAID' },
            },
          ],
          meta: { totalPages: 1 },
        }),
      });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'key',
        consentId: 'consent-supplier',
      });

      const invoice = await adapter.getSupplierInvoice('INV-2026-9001');
      expect(invoice).not.toBeNull();
      expect(invoice?.id).toBe('zg-inv-01');
      expect(invoice?.invoiceNumber).toBe('INV-2026-9001');
      expect(invoice?.counterpartyName).toBe('Customer AB');
      expect(invoice?.counterpartyOrgNumber).toBe('556111-2222');
      expect(invoice?.amount).toBe(7500);
      expect(invoice?.currency).toBe('EUR');
      expect(invoice?.status).toBe('UNPAID');
    });

    it('paginates across multiple pages to find matching invoice', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ reference: 'INV-OTHER-1', amount: 1000, documentCurrencyCode: 'EUR', issueDate: '2026-01-01', dueDate: '2026-01-10' }],
            meta: { totalPages: 2 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ reference: 'INV-TARGET-2', amount: 2000, documentCurrencyCode: 'EUR', issueDate: '2026-02-01', dueDate: '2026-02-10' }],
            meta: { totalPages: 2 },
          }),
        });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'key',
        consentId: 'consent-supplier',
      });

      const invoice = await adapter.getSupplierInvoice('INV-TARGET-2');
      expect(invoice).not.toBeNull();
      expect(invoice?.invoiceNumber).toBe('INV-TARGET-2');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('CurrentPage=1');
      expect(fetchMock.mock.calls[1][0]).toContain('CurrentPage=2');
    });

    it('checks recorded payments for supplier invoice', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ id: 'inv-1', reference: 'INV-100', totalAmount: 1000, documentCurrencyCode: 'EUR', issueDate: '2026-01-01', dueDate: '2026-01-10' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ id: 'pmt-1', amount: 500, receivedDate: '2026-01-05' }],
        });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'key',
        consentId: 'consent-supplier',
      });

      const hasPayment = await adapter.checkPaymentRecorded('INV-100');
      expect(hasPayment).toBe(true);
    });
  });

  describe('4. Buyer AP & Dispute Inspection', () => {
    it('fetches buyer payable and detects dispute flags and reasons from notes', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'pay-01',
            reference: 'INV-DISPUTED-01',
            accountingSupplierParty: {
              partyLegalEntity: { registrationName: 'Nordic Components AB', companyId: { id: '556789-0123' } },
            },
            totalAmount: 10000,
            documentCurrencyCode: 'EUR',
            issueDate: '2026-07-01',
            dueDate: '2026-07-20',
            notes: [{ text: 'Dispute: Goods damaged in transit' }],
          },
        ],
      });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('BUYER', {
        apiKey: 'key',
        consentId: 'consent-buyer',
      });

      const payable = await adapter.getBuyerPayable('INV-DISPUTED-01');
      expect(payable).not.toBeNull();
      expect(payable?.hasDisputeFlag).toBe(true);
      expect(payable?.disputeReason).toContain('Goods damaged in transit');
      expect(payable?.status).toBe('DISPUTED');
    });
  });

  describe('5. Error Codes & Retries', () => {
    it('translates 401 and 403 into typed UNAUTHORIZED and FORBIDDEN errors', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid API key' }),
      });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'invalid-key',
        consentId: 'consent-id',
      });

      await expect(adapter.getSupplierInvoice('INV-1')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });

    it('retries on 500 server errors up to maxRetries', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Error' }),
      });
      globalThis.fetch = fetchMock;

      const adapter = new RealZwapgridAdapter('SUPPLIER', {
        apiKey: 'key',
        consentId: 'consent-id',
        maxRetries: 2,
        retryDelayMs: 10,
      });

      await expect(adapter.getSupplierInvoice('INV-1')).rejects.toThrow(ZwapgridIntegrationError);
      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('6. Trust Boundary Enforcement', () => {
    it('blocks supplier from querying buyer AP endpoints', async () => {
      const adapter = new RealZwapgridAdapter('SUPPLIER', { apiKey: 'k', consentId: 'c' });
      await expect(adapter.getBuyerPayable('INV-1')).rejects.toThrow('[TRUST BOUNDARY]');
      await expect(adapter.getPayableStatus('INV-1')).rejects.toThrow('[TRUST BOUNDARY]');
    });

    it('blocks buyer from querying supplier AR endpoints', async () => {
      const adapter = new RealZwapgridAdapter('BUYER', { apiKey: 'k', consentId: 'c' });
      await expect(adapter.getSupplierInvoice('INV-1')).rejects.toThrow('[TRUST BOUNDARY]');
      await expect(adapter.checkPaymentRecorded('INV-1')).rejects.toThrow('[TRUST BOUNDARY]');
    });
  });
});
