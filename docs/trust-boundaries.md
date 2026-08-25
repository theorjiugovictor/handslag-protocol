# Settlement Network — Trust Boundaries & Data Privacy Model

## Principles of Trust Isolation

Settlement Network enforces strict principal isolation between counterparties in a B2B transaction. Neither agent is an "omniscient orchestrator" or a shared chatbot.

```
┌───────────────────────────────┐         ┌───────────────────────────────┐
│        SUPPLIER REALM         │         │          BUYER REALM          │
│      Nordic Components AB     │         │        Aurora Retail AB       │
│                               │         │                               │
│  ┌─────────────────────────┐  │         │  ┌─────────────────────────┐  │
│  │ Supplier Settlement     │  │         │  │ Buyer Settlement        │  │
│  │ Agent (Ed25519 Key A)   │  │         │  │ Agent (Ed25519 Key B)   │  │
│  └───────────┬─────────────┘  │         │  └───────────┬─────────────┘  │
│              │                │         │              │                │
│  ┌───────────▼─────────────┐  │         │  ┌───────────▼─────────────┐  │
│  │ Zwapgrid Connection     │  │         │  │ Zwapgrid Connection     │  │
│  │ Scope: Sales Invoices / │  │         │  │ Scope: Purchase Invoices│  │
│  │ Accounts Receivable     │  │         │  │ / Accounts Payable      │  │
│  └─────────────────────────┘  │         │  └─────────────────────────┘  │
│                               │         │              │                │
│                               │         │  ┌───────────▼─────────────┐  │
│                               │         │  │ Open Payments PSD2      │  │
│                               │         │  │ Scope: PIS & AIS        │  │
│                               │         │  └─────────────────────────┘  │
└──────────────┬────────────────┘         └──────────────┬────────────────┘
               │                                         │
               │         Signed Claim Envelopes Only     │
               └────────────────► ◄──────────────────────┘
                         (No Raw Financial Data)
```

## Strict Boundary Rules

1. **Independent Cryptographic Identities**:
   - Each agent generates its own Ed25519 keypair.
   - Claims must be cryptographically signed by the issuer's private key and independently verified by the recipient using the issuer's registered public key.

2. **Scoped Data Access**:
   - Supplier Agent can only access its own Accounts Receivable data via its Zwapgrid consent scope.
   - Buyer Agent can only access its own Accounts Payable data and Open Payments accounts.
   - Cross-party access throws strict `[TRUST BOUNDARY]` runtime exceptions.

3. **Verifiable Minimal Claims vs. Raw Data**:
   - **Never shared**: Bank balances, complete transaction history, internal ERP identifiers, profit margins, private credit lines.
   - **Shared as minimal claims**: "Maximum policy-compliant payment today is EUR 4,000 based on operational reserve constraints; next compliant liquidity window is the 14th for EUR 6,000."

4. **Deterministic Policy Gatekeeper**:
   - LLMs are prohibited from executing or authorizing payments.
   - The PaymentController only accepts instructions pre-approved by the `MandatePolicyEngine` with full audit provenance.
