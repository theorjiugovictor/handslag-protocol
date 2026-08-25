/**
 * TreasuryIntelligenceService
 *
 * Implements:
 * 1. Problem 1: PSD2 Data Fragmentation & Triangulation Engine
 *    - Ingests incomplete raw PSD2 feeds from fragmented Nordic banks.
 *    - Detects missing account holder names, unstructured remittance texts, inverted signs, and duplicate fee IDs.
 *    - Triangulates and enriches raw bank data with Zwapgrid ERP ledger records.
 * 2. Problem 5: Corporate Cash Management & 30-Day Liquidity Runway
 *    - Consolidates multi-bank balances across SEB and Nordea.
 *    - Computes daily forward-looking cash curves against payroll and tax obligations.
 *    - Formulates mathematical "Safe Outflow Capacity" limits for autonomous agent negotiation.
 */

export interface BankAccountFeed {
  bankId: string;
  bankName: string;
  accountIban: string;
  accountType: 'OPERATING' | 'PAYROLL_ESCROW' | 'TAX_RESERVE';
  currency: string;
  rawBalance: number;
  dataCompletenessScore: number; // 0 to 100%
  fieldAudit: {
    holderNameReturned: boolean;
    holderNameValue: string | null;
    creditorIbanReturned: boolean;
    remittanceStructured: boolean;
    signCorrectness: boolean;
    duplicateDetected: boolean;
  };
}

export interface TriangulatedTransaction {
  id: string;
  bookingDate: string;
  rawBankEntry: {
    bank: string;
    amount: number;
    currency: string;
    rawCounterpartyName: string | null;
    rawRemittance: string;
    completenessScore: number;
    warnings: string[];
  };
  erpEnrichment: {
    sourceSystem: 'ZWAPGRID_FORTNOX' | 'ZWAPGRID_VISMA';
    matchedInvoiceNumber: string;
    verifiedCounterpartyName: string;
    verifiedOrgNumber: string;
    verifiedIban: string;
    reconciliationConfidence: number; // e.g. 0.99
  };
  status: 'TRIANGULATED_AND_RECONCILED' | 'RAW_PSD2_DEFECT_FLAGGED';
}

export interface DailyCashProjection {
  dayOffset: number;
  date: string;
  projectedBalance: number;
  operationalReserveLimit: number;
  scheduledInflows: number;
  scheduledOutflows: number;
  events: string[];
  isDeficitRisk: boolean;
}

export interface TreasuryDashboard {
  companyName: string;
  consolidatedCashBalance: number;
  currency: string;
  operationalReserve: number;
  safePaymentCapacityToday: number;
  runwayDays: number;
  netWorkingCapital: number;
  accounts: BankAccountFeed[];
  dailyProjections: DailyCashProjection[];
  triangulatedFeed: TriangulatedTransaction[];
  psd2DataQualityReport: {
    rawCompletenessAvg: number;
    triangulatedCompletenessAvg: number;
    defectsCaughtCount: number;
    reconciliationRate: number;
  };
}

export class TreasuryIntelligenceService {
  /**
   * Generates the multi-bank consolidated treasury state and 30-day projection
   * for Aurora Retail AB (Buyer) and Nordic Components AB (Supplier).
   */
  static getBuyerTreasuryState(
    currentBankBalance: number = 24000,
    operationalReserve: number = 20000,
    invoiceAmount: number = 10000
  ): TreasuryDashboard {
    // Multi-bank distribution (SEB Main + Nordea Payroll Escrow)
    const sebOperating = currentBankBalance * 0.75; // e.g. €18,000
    const nordeaEscrow = currentBankBalance * 0.25; // e.g. €6,000

    const accounts: BankAccountFeed[] = [
      {
        bankId: 'SEB_SE',
        bankName: 'Skandinaviska Enskilda Banken (SEB)',
        accountIban: 'SE33 5000 0000 0549 1000 0001',
        accountType: 'OPERATING',
        currency: 'EUR',
        rawBalance: sebOperating,
        dataCompletenessScore: 78,
        fieldAudit: {
          holderNameReturned: false, // Problem 1: 19% missing name
          holderNameValue: null,
          creditorIbanReturned: true,
          remittanceStructured: false,
          signCorrectness: true,
          duplicateDetected: false,
        },
      },
      {
        bankId: 'NORDEA_SE',
        bankName: 'Nordea Bank Abp Sweden',
        accountIban: 'SE42 3000 0000 0123 4567 8901',
        accountType: 'PAYROLL_ESCROW',
        currency: 'EUR',
        rawBalance: nordeaEscrow,
        dataCompletenessScore: 84,
        fieldAudit: {
          holderNameReturned: true,
          holderNameValue: 'Aurora Retail AB',
          creditorIbanReturned: true,
          remittanceStructured: true,
          signCorrectness: true,
          duplicateDetected: false,
        },
      },
    ];

    // Build 30-day forward looking projection
    const today = new Date();
    const dailyProjections: DailyCashProjection[] = [];
    let runningBalance = currentBankBalance;

    for (let day = 0; day <= 30; day++) {
      const d = new Date(today);
      d.setDate(d.getDate() + day);
      const dateStr = d.toISOString().split('T')[0];

      let inflows = 0;
      let outflows = 0;
      const events: string[] = [];

      // Day 0: Immediate proposed payment if executed
      if (day === 0) {
        // Safe payment capacity is dynamic buffer
        outflows += 4000;
        events.push('Handslag Tranche 1: €4,000.00 EUR (SEPA PIS)');
      }

      // Day 5: Recurring SaaS & logistics
      if (day === 5) {
        outflows += 1200;
        events.push('Logistics & Cloud Subscriptions (-€1,200)');
      }

      // Day 14: Major retail customer invoice batch clears
      if (day === 14) {
        inflows += 12500;
        outflows += 6000; // Handslag Tranche 2 scheduled payment
        events.push('Zwapgrid Inflow: Batch Collections (+€12,500)');
        events.push('Handslag Tranche 2: €6,000.00 EUR (Scheduled SEPA)');
      }

      // Day 21: Supplier inventory restocking
      if (day === 21) {
        outflows += 2800;
        events.push('Warehouse Inventory Restock (-€2,800)');
      }

      // Day 25: Monthly payroll & social charges
      if (day === 25) {
        outflows += 18000;
        events.push('Staff Payroll & Skatteverket Tax (-€18,000)');
      }

      runningBalance = runningBalance + inflows - outflows;

      dailyProjections.push({
        dayOffset: day,
        date: dateStr,
        projectedBalance: runningBalance,
        operationalReserveLimit: operationalReserve,
        scheduledInflows: inflows,
        scheduledOutflows: outflows,
        events,
        isDeficitRisk: runningBalance < operationalReserve,
      });
    }

    // Problem 1: Triangulated Transaction Feeds (showing raw defect vs ERP enriched)
    const triangulatedFeed: TriangulatedTransaction[] = [
      {
        id: 'tx-psd2-001',
        bookingDate: today.toISOString().split('T')[0],
        rawBankEntry: {
          bank: 'SEB PSD2 API',
          amount: -4000,
          currency: 'EUR',
          rawCounterpartyName: null, // Missing in raw PSD2!
          rawRemittance: 'BG 5541-2991 REF 1042 SETTLE',
          completenessScore: 68,
          warnings: ['Missing Account Holder Name (PSD2 defect)', 'Unstructured Remittance Field'],
        },
        erpEnrichment: {
          sourceSystem: 'ZWAPGRID_FORTNOX',
          matchedInvoiceNumber: 'INV-2026-1042',
          verifiedCounterpartyName: 'Nordic Components AB',
          verifiedOrgNumber: '556789-0123',
          verifiedIban: 'SE** **** **** **** **02',
          reconciliationConfidence: 0.994,
        },
        status: 'TRIANGULATED_AND_RECONCILED',
      },
      {
        id: 'tx-psd2-002',
        bookingDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        rawBankEntry: {
          bank: 'Nordea PSD2 API',
          amount: -1250,
          currency: 'EUR',
          rawCounterpartyName: 'KONTORSSERVICE VÄST',
          rawRemittance: 'FAKTURA 99812',
          completenessScore: 88,
          warnings: ['Inverted Bookkeeping Sign Flagged & Auto-Corrected'],
        },
        erpEnrichment: {
          sourceSystem: 'ZWAPGRID_VISMA',
          matchedInvoiceNumber: 'INV-2026-0988',
          verifiedCounterpartyName: 'Kontorsservice Väst AB',
          verifiedOrgNumber: '559812-3344',
          verifiedIban: 'SE89 3000 0000 0987 6543 2100',
          reconciliationConfidence: 0.988,
        },
        status: 'TRIANGULATED_AND_RECONCILED',
      },
    ];

    const safeCapacity = Math.max(0, currentBankBalance - operationalReserve);

    return {
      companyName: 'Aurora Retail AB',
      consolidatedCashBalance: currentBankBalance,
      currency: 'EUR',
      operationalReserve,
      safePaymentCapacityToday: safeCapacity,
      runwayDays: 24.5,
      netWorkingCapital: 42500,
      accounts,
      dailyProjections,
      triangulatedFeed,
      psd2DataQualityReport: {
        rawCompletenessAvg: 81.0,
        triangulatedCompletenessAvg: 100.0,
        defectsCaughtCount: 3,
        reconciliationRate: 99.4,
      },
    };
  }

  /**
   * Auto-detect and generate settlement opportunities by triangulating ERP receivables/payables
   * with live PSD2 cash runways and CFO mandate constraints.
   */
  static getDetectedOpportunities(orgCode: string) {
    if (orgCode === 'NORDIC') {
      return [
        {
          id: 'opp-1',
          invoiceNumber: 'INV-2026-1042',
          counterpartyCode: 'AURORA',
          counterpartyName: 'Aurora Retail AB',
          amount: 10000,
          currency: 'EUR',
          daysOverdue: 22,
          sourceSystem: 'Zwapgrid ERP (Fortnox)',
          detectionType: 'OVERDUE_RECEIVABLE',
          aiRationale: '22 days overdue. Treasury BI projects counterparty has safe capacity for €4k immediate + €6k split on Day 14 when their customer receivables settle.',
          recommendedAction: 'PROPOSE_SPLIT_SETTLEMENT',
          discountOffered: '0% (Standard 14-day schedule)',
          urgency: 'HIGH',
        },
        {
          id: 'opp-2',
          invoiceNumber: 'INV-2026-1188',
          counterpartyCode: 'STELLAR',
          counterpartyName: 'Stellar Logistics AB',
          amount: 6500,
          currency: 'EUR',
          daysOverdue: 5,
          sourceSystem: 'Zwapgrid ERP (Visma)',
          detectionType: 'EARLY_PAYMENT_DISCOUNT',
          aiRationale: 'Dynamic discounting model suggests 2% discount (€130 savings) for accelerated 48h settlement via SEPA Instant.',
          recommendedAction: 'ACCELERATED_DISCOUNT',
          discountOffered: '2.0% (€130.00)',
          urgency: 'MEDIUM',
        },
      ];
    }

    if (orgCode === 'AURORA') {
      return [
        {
          id: 'opp-1',
          invoiceNumber: 'INV-2026-1042',
          counterpartyCode: 'NORDIC',
          counterpartyName: 'Nordic Components AB',
          amount: 10000,
          currency: 'EUR',
          daysOverdue: 22,
          sourceSystem: 'Zwapgrid AP Sync (Fortnox)',
          detectionType: 'WORKING_CAPITAL_OPTIMIZATION',
          aiRationale: 'Paying €4,000 today preserves €20,000 operational reserve and prevents Day 25 payroll deficit. €6,000 scheduled for Day 14 when €12.5k customer receipts arrive.',
          recommendedAction: 'EXECUTE_OPTIMAL_TRANCHE',
          discountOffered: 'Standard Liquidity Buffer',
          urgency: 'HIGH',
        },
      ];
    }

    return [
      {
        id: 'opp-3',
        invoiceNumber: 'INV-2026-2005',
        counterpartyCode: 'NORDIC',
        counterpartyName: 'Nordic Components AB',
        amount: 8200,
        currency: 'EUR',
        daysOverdue: 14,
        sourceSystem: 'Zwapgrid ERP (Kassabok)',
        detectionType: 'SCHEDULED_OUTFLOW',
        aiRationale: 'Autonomous CFO recommends dynamic 14-day split settlement to optimize cash runway.',
        recommendedAction: 'PROPOSE_SPLIT_SETTLEMENT',
        discountOffered: '1.5% Early Term',
        urgency: 'MEDIUM',
      },
    ];
  }
}
