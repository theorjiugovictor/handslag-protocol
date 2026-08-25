# Settlement Network — 3-Minute Hackathon Jury Demo Script

> **Accurate Technical Walkthrough**: All claims in this script are verified against executable code.
> Mode: **MOCK** (Default sandbox execution with real adapter fallback).

---

## Step 1: Open the Application & Frame the Problem (0:00 - 0:40)
- **URL**: `http://localhost:3000`
- **What to say**:
  > *"Judges, over €500 Billion in B2B invoices are overdue in Europe right now. Collecting that capital today requires manual phone calls, email chasing, and expensive factoring agencies taking 20% cuts.*
  > 
  > *Chatbots cannot solve this because no CFO will ever let an LLM touch their bank account.*
  > 
  > *We built **Settlement Network**: an autonomous protocol where two finance agents, bounded by deterministic human mandates and cryptographic signatures, negotiate and initiate settlement of an overdue €10,000 invoice in seconds."*
- **What to point out on screen**:
  - Point to **Nordic Components AB (Supplier)**: Policy requires ≥ €2,500 immediately, remaining within 14 days.
  - Point to **Aurora Retail AB (Buyer)**: Policy requires maintaining a €20,000 cash reserve, paying max €4,000 today.
  - Point to the **MOCK** mode badge in the header.

---

## Step 2: Run the Live Settlement (0:40 - 1:45)
- Click **`Live Settlement`** in the top right.
- **Walk through the live stream as events appear**:
  1. **Obligation Retrieval**: Supplier Agent queries its Zwapgrid Accounts Receivable scope and signs an **Ed25519 verifiable claim** for invoice `INV-2026-1042` (€10,000, 22 days overdue).
  2. **Independent Matching**: Buyer Agent verifies the Ed25519 signature and independently checks its Accounts Payable records with zero dispute flags.
  3. **Obligation Confirmed**: The protocol mutually confirms the debt without either party exposing raw ledgers.
  4. **Initial Demand**: Supplier proposes full €10,000 immediate settlement today.
  5. **Data-Minimized Liquidity Constraint**: Buyer Agent queries bank liquidity, **keeps its exact €24,000 bank balance strictly private**, and generates a minimal claim: max €4,000 payable today to preserve its €20,000 reserve.
  6. **Counterproposal**: Buyer counters with €4,000 today + €6,000 scheduled on the 14th.
  7. **Consensus**: Supplier Agent verifies the counter meets its policy (≥ €2,500 immediate) and signs acceptance.
  8. **Deterministic Policy Validation**: The **Mandate Policy Engine** runs 11 non-LLM safety checks (amount ceilings, counterparty verification, daily caps, idempotency) — all **PASS**.
  9. **Pre-Flight Verification of Payee (VoP) & Initiation**: Payment Controller runs VoP (100% match on Nordic Components AB) and dispatches the €4,000 immediate SEPA transfer via Open Payments (transitioning to `AUTHORIZATION_REQUIRED` awaiting bank SCA).
  10. **Future-Dated Payment**: Payment Controller dispatches the €6,000 payment scheduled for the 14th using the PSD2 `requestedExecutionDate` parameter.

---

## Step 3: Inspect Cryptographic Proofs & Remittance (1:45 - 2:20)
- Click on the **Immediate Settlement (€4,000)** card:
  - Show the **EPC / PSD2 SEPA Remittance Advice** modal: Debtor & Creditor IBANs, VoP `MATCH`, Decoupled SCA approach, and End-to-End Idempotency key.
- Click the **`Payload`** button on any claim:
  - Point out the **SHA-512 Evidence Hash** and the **Ed25519 Digital Signature** (clearly separated).

---

## Step 4: Show Distributed Network Flow & Policy Rejection (2:20 - 2:50)
- Click **`Distributed Network Flow`** in the top header:
  - Show Node Alpha (Supplier VPC) and Node Beta (Buyer VPC) communicating over the untrusted message wire with signed JSON envelopes.
- Click **`Test Rejection`**:
  - Show the Supplier attempting to push an out-of-policy €8,000 demand.
  - Show the deterministic policy engine intercepting and blocking the payment before any banking API is called.
  - Highlight the two explicit violations:
    1. *€8,000 exceeds legal per-payment mandate ceiling (€6,000)*
    2. *€8,000 exceeds Buyer internal maximum-today liquidity limit (€4,000)*

---

## Step 5: Export Audit Trail & Conclusion (2:50 - 3:00)
- Click **`Export JSON`** to demonstrate the machine-readable immutable audit log for compliance.
- **Closing Statement**:
  > *"Settlement Network proves that B2B invoice collection can be fully automated, privacy-preserving, and deterministically safe under human mandate control. Thank you!"*
