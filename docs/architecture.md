# Settlement Network — Architecture

Settlement Network is a hackathon-grade autonomous finance agent protocol where two policy-constrained agents negotiate and execute settlement of overdue B2B invoices.

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Next.js Browser UI"]
        UI[Interactive Jury Dashboard]
        Overview[Scenario Overview]
        Timeline[Agent Timeline & Claims]
        Evidence[Evidence & Data Minimization]
        MandateUI[Mandate & Policy Checks]
        SettlementUI[Payment Execution Panel]
        AuditUI[Exportable Audit Trail]
    end

    subgraph Server["Next.js Server-Side (Secure Execution Environment)"]
        API[API Route Handlers<br/><code>/api/demo</code>, <code>/api/audit</code>]
        DSS[DemoScenarioService<br/>Deterministic Orchestrator]
        FSM[NegotiationEngine<br/>12-State FSM]

        subgraph Agents["Autonomous Finance Agents"]
            SA[SupplierAgent<br/>Identity: Nordic Components AB]
            BA[BuyerAgent<br/>Identity: Aurora Retail AB]
        end

        CS[ClaimService<br/>Ed25519 Asymmetric Signatures & Verification]
        MPE[MandatePolicyEngine<br/>Deterministic Non-LLM Gatekeeper]
        PC[PaymentController<br/>Idempotency & Execution Controller]
        AS[AuditService<br/>Chronological Event Logger & Exporter]

        subgraph Adapters["Integration Adapters"]
            ZA_I[Zwapgrid Adapter Interface]
            OP_I[Open Payments Adapter Interface]
            ZA_M[MockZwapgridAdapter]
            ZA_R[RealZwapgridAdapter]
            OP_M[MockOpenPaymentsAdapter]
            OP_R[RealOpenPaymentsAdapter]
        end
    end

    subgraph External["External Finance APIs"]
        ZG[Zwapgrid API.1<br/>Unified Accounting]
        OP[Open Payments Europe<br/>NextGenPSD2 REST API]
    end

    UI --> API
    API --> DSS
    DSS --> FSM
    FSM --> SA
    FSM --> BA
    SA --> CS
    BA --> CS
    SA --> ZA_I
    BA --> ZA_I
    BA --> OP_I
    FSM --> MPE
    MPE --> PC
    PC --> OP_I
    PC --> AS
    MPE --> AS
    SA --> AS
    BA --> AS

    ZA_I --> ZA_M
    ZA_I --> ZA_R
    OP_I --> OP_M
    OP_I --> OP_R

    ZA_R -.-> ZG
    OP_R -.-> OP
```

## Negotiation Protocol Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Human as Human (CFO)
    participant BA as Buyer Agent (Aurora)
    participant SA as Supplier Agent (Nordic)
    participant CS as ClaimService (Ed25519)
    participant NE as NegotiationEngine (FSM)
    participant PE as MandatePolicyEngine
    participant PC as PaymentController
    participant OP as Open Payments API

    Human->>BA: Sign Bounded Mandate (Ceilings, Expiry, Counterparties)
    Note over SA,BA: Both agents start in EVIDENCE_REQUESTED state

    SA->>SA: Query Accounts Receivable via Zwapgrid
    SA->>CS: Sign INVOICE_RECORDED Claim (INV-2026-1042, €10,000, 22d overdue)
    CS-->>NE: Signed Claim Envelope
    NE->>BA: Deliver Claim (No Raw Ledger Data Shared)

    BA->>BA: Independently Match against Accounts Payable
    BA->>CS: Sign PAYABLE_MATCHED Claim (Full Match, No Dispute)
    CS-->>NE: Signed Claim Envelope

    NE->>NE: Mutually Verify Signatures & Match -> OBLIGATION_VERIFIED

    SA->>CS: Sign SETTLEMENT_PROPOSAL (€10,000 Full Immediate)
    CS-->>NE: Signed Proposal Envelope
    NE->>BA: Deliver Proposal

    BA->>BA: Check Liquidity via Open Payments (€24,000 balance, €20,000 reserve)
    BA->>CS: Sign LIQUIDITY_CONSTRAINT Claim (Max today: €4,000, next date: 14th)
    BA->>CS: Sign SETTLEMENT_PROPOSAL (Counter: €4,000 now + €6,000 on 14th)
    CS-->>NE: Signed Counterproposal Envelope
    NE->>SA: Deliver Counterproposal

    SA->>SA: Evaluate Counter against Policy (≥€2,500 now, rest ≤14d -> PASS)
    SA->>CS: Sign SETTLEMENT_ACCEPTED Claim
    CS-->>NE: Signed Acceptance Envelope -> AGREEMENT_REACHED

    NE->>PE: Submit Settlement for Deterministic Mandate Check
    PE->>PE: 11 Policy Checks (Ceilings, Cumulative, Daily, Expiry, Idempotency)
    PE-->>NE: All Checks PASS -> POLICY_VALIDATION

    NE->>PC: Dispatch Payment Instruction (€4,000 Immediate)
    PC->>OP: POST /psd2/paymentinitiation/v1/payments/sepa-credit-transfers
    OP-->>PC: HTTP 201 Created (Status: RCVD, SCA Required)
    PC-->>NE: PAYMENT_INITIATED (AUTHORIZATION_REQUIRED)

    NE->>PC: Dispatch Scheduled Payment Instruction (€6,000 on 14th)
    PC->>OP: POST with requestedExecutionDate
    OP-->>PC: HTTP 201 Created (Status: RCVD, SCA Required)
    PC-->>NE: PAYMENT_SCHEDULED -> COMPLETED
```
