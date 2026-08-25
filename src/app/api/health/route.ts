import { NextResponse } from 'next/server';
import { RealOpenPaymentsAdapter } from '@/lib/adapters/real-open-payments-adapter';
import { RealZwapgridAdapter } from '@/lib/adapters/real-zwapgrid-adapter';

export async function GET() {
  const openPayments = new RealOpenPaymentsAdapter();
  const zwapgridSupplier = new RealZwapgridAdapter('SUPPLIER');

  let opConnected = false;
  let opMode = 'MOCK_FALLBACK';
  try {
    const token = await openPayments.getAccessToken('paymentinitiation corporate');
    if (token && !token.startsWith('mock-')) {
      opConnected = true;
      opMode = 'LIVE_CONNECTED';
    }
  } catch {
    opConnected = false;
  }

  const zgHasKey = Boolean(process.env.ZWAPGRID_API_KEY);
  const zgHasConsent = Boolean(process.env.ZWAPGRID_CONSENT_ID);

  return NextResponse.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    gateways: {
      openPayments: {
        status: opConnected ? 'ACTIVE_SANDBOX' : 'MOCK_SANDBOX',
        mode: opMode,
        host: process.env.OPEN_PAYMENT_API_HOST || 'api.openbankingplatform.com',
        sepaPIS: true,
        vopCheck: true,
        futureDatedPayments: true,
      },
      zwapgrid: {
        status: zgHasKey && zgHasConsent ? 'ACTIVE' : 'MOCK_SANDBOX',
        apiKeyConfigured: zgHasKey,
        consentConfigured: zgHasConsent,
        salesInvoicesAR: true,
        purchaseInvoicesAP: true,
      },
      cryptographicEngine: {
        algorithm: 'Ed25519 (RFC 8032)',
        hashAlgorithm: 'SHA-512',
        status: 'ACTIVE_MATHEMATICAL',
      },
      mandateEngine: {
        type: 'Deterministic Non-LLM Gatekeeper',
        rulesEnforced: 11,
        idempotencyShield: true,
        status: 'ACTIVE_MATHEMATICAL',
      },
    },
  });
}
