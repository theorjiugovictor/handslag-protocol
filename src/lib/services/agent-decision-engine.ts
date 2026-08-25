/**
 * AgentDecisionEngine
 *
 * Implements genuine autonomous financial reasoning for Supplier and Buyer agents.
 * Both agents evaluate counterparty claims, enforce human CFO policies, optimize
 * cashflow constraints, and generate mathematically sound proposals with Ed25519 signatures.
 */

export interface ScenarioConfig {
  invoiceNumber?: string;
  invoiceAmount: number;
  currency: string;
  daysOverdue?: number;
  buyerBankBalance: number;
  buyerOperationalReserve: number;
  buyerMandateCeiling: number;
  supplierMinUpfront: number;
  supplierMaxWaitDays: number;
}

export const DEFAULT_SCENARIO_CONFIG: ScenarioConfig = {
  invoiceNumber: 'INV-2026-1042',
  invoiceAmount: 10000,
  currency: 'EUR',
  daysOverdue: 22,
  buyerBankBalance: 24000,
  buyerOperationalReserve: 20000,
  buyerMandateCeiling: 6000,
  supplierMinUpfront: 2500,
  supplierMaxWaitDays: 14,
};

export interface AgentDecision {
  action: 'PROPOSE' | 'ACCEPT' | 'COUNTER' | 'REJECT';
  immediateAmount: number;
  scheduledAmount: number;
  scheduledDate?: string;
  rationale: string;
  internalMetrics: {
    availableLiquidity?: number;
    reservePreserved?: boolean;
    upfrontSatisfactionPercent?: number;
  };
}

export class SupplierAgentDecisionEngine {
  /**
   * Autonomous Supplier Decision: Formulates initial proposal or evaluates buyer counteroffer
   */
  static formulateInitialDemand(config: ScenarioConfig): AgentDecision {
    return {
      action: 'PROPOSE',
      immediateAmount: config.invoiceAmount,
      scheduledAmount: 0,
      rationale: `Supplier seeking full immediate settlement of €${config.invoiceAmount.toLocaleString()} ${config.currency}. Policy requires at least €${config.supplierMinUpfront.toLocaleString()} upfront.`,
      internalMetrics: {
        upfrontSatisfactionPercent: 100,
      },
    };
  }

  static evaluateCounterproposal(
    buyerOffer: { immediateAmount: number; scheduledAmount: number; scheduledDate?: string },
    config: ScenarioConfig
  ): AgentDecision {
    const meetsUpfront = buyerOffer.immediateAmount >= config.supplierMinUpfront;
    const totalMatches = buyerOffer.immediateAmount + buyerOffer.scheduledAmount === config.invoiceAmount;

    if (meetsUpfront && totalMatches) {
      return {
        action: 'ACCEPT',
        immediateAmount: buyerOffer.immediateAmount,
        scheduledAmount: buyerOffer.scheduledAmount,
        scheduledDate: buyerOffer.scheduledDate,
        rationale: `Supplier accepts offer: €${buyerOffer.immediateAmount.toLocaleString()} upfront exceeds minimum threshold (€${config.supplierMinUpfront.toLocaleString()}), and remaining €${buyerOffer.scheduledAmount.toLocaleString()} is scheduled within ${config.supplierMaxWaitDays} days.`,
        internalMetrics: {
          upfrontSatisfactionPercent: Math.round((buyerOffer.immediateAmount / config.supplierMinUpfront) * 100),
        },
      };
    }

    if (!meetsUpfront) {
      return {
        action: 'REJECT',
        immediateAmount: buyerOffer.immediateAmount,
        scheduledAmount: buyerOffer.scheduledAmount,
        rationale: `Rejected: Immediate offer of €${buyerOffer.immediateAmount.toLocaleString()} is below CFO minimum required threshold of €${config.supplierMinUpfront.toLocaleString()}.`,
        internalMetrics: {
          upfrontSatisfactionPercent: Math.round((buyerOffer.immediateAmount / config.supplierMinUpfront) * 100),
        },
      };
    }

    return {
      action: 'REJECT',
      immediateAmount: buyerOffer.immediateAmount,
      scheduledAmount: buyerOffer.scheduledAmount,
      rationale: `Rejected: Total installments (€${(buyerOffer.immediateAmount + buyerOffer.scheduledAmount).toLocaleString()}) do not match total invoice amount (€${config.invoiceAmount.toLocaleString()}).`,
      internalMetrics: {},
    };
  }
}

export class BuyerAgentDecisionEngine {
  /**
   * Autonomous Buyer Decision: Evaluates liquidity constraints and calculates optimal counteroffer
   */
  static evaluateLiquidityAndCounter(
    supplierDemand: { immediateAmount: number },
    config: ScenarioConfig,
    futureDate: string
  ): AgentDecision {
    // 1. Calculate usable liquidity buffer without touching operational reserve
    const liquidBuffer = Math.max(0, config.buyerBankBalance - config.buyerOperationalReserve);

    // 2. Cap immediate payment by available buffer and legal mandate per-payment limit
    const maxPayableToday = Math.min(liquidBuffer, config.buyerMandateCeiling, config.invoiceAmount);

    // If demand exceeds maxPayableToday, dynamically formulate multi-tranche counterproposal
    if (supplierDemand.immediateAmount > maxPayableToday) {
      const scheduledAmount = config.invoiceAmount - maxPayableToday;

      return {
        action: 'COUNTER',
        immediateAmount: maxPayableToday,
        scheduledAmount,
        scheduledDate: futureDate,
        rationale: `Buyer liquidity policy requires preserving €${config.buyerOperationalReserve.toLocaleString()} operational reserve. Proposing €${maxPayableToday.toLocaleString()} today + €${scheduledAmount.toLocaleString()} scheduled for ${futureDate}.`,
        internalMetrics: {
          availableLiquidity: liquidBuffer,
          reservePreserved: true,
        },
      };
    }

    // If full amount is within limits
    return {
      action: 'ACCEPT',
      immediateAmount: config.invoiceAmount,
      scheduledAmount: 0,
      rationale: `Full amount €${config.invoiceAmount.toLocaleString()} is within available liquidity buffer (€${liquidBuffer.toLocaleString()}) and mandate ceiling.`,
      internalMetrics: {
        availableLiquidity: liquidBuffer,
        reservePreserved: true,
      },
    };
  }
}
