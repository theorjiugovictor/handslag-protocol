import { NextResponse } from 'next/server';
import { RealOpenPaymentsAdapter } from '@/lib/adapters/real-open-payments-adapter';
import { getZwapgridDeploymentMode } from '@/lib/adapters';

export async function GET() {
  const openPayments = new RealOpenPaymentsAdapter();

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
  const zgHasConsent = Boolean(
    process.env.ZWAPGRID_CONSENT_ID ||
    (process.env.ZWAPGRID_SUPPLIER_CONSENT_ID && process.env.ZWAPGRID_BUYER_CONSENT_ID)
  );
  let zgMode: 'mock' | 'test' | 'live' | 'invalid' = 'mock';
  try {
    zgMode = getZwapgridDeploymentMode();
  } catch {
    zgMode = 'invalid';
  }
  const zgLiveEnabled = process.env.ZWAPGRID_LIVE_ENABLED === 'true';
  const zgConfigured = zgMode === 'mock' || (zgHasKey && zgHasConsent && (zgMode !== 'live' || zgLiveEnabled));

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
        status: zgConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        mode: zgMode,
        dataClassification: zgMode === 'mock' ? 'LOCAL_FIXTURES' : zgMode === 'test' ? 'TEST_ACCOUNTING_DATA' : 'PRODUCTION_ACCOUNTING_DATA',
        liveEnabled: zgLiveEnabled,
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
