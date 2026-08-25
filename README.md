# Settlement Network 🤝

> **Autonomous, Policy-Bounded B2B Invoice Settlement Protocol with Verifiable Claims and Deterministic Mandates**

Settlement Network is a hackathon-grade MVP where two autonomous, policy-constrained finance agents (**Supplier Agent: Nordic Components AB** and **Buyer Agent: Aurora Retail AB**) negotiate and initiate settlement of an overdue €10,000 B2B invoice without ever exposing raw financial ledgers or allowing an LLM to touch payment authorization.

---

## What the Product Does

1. **Autonomous Protocol Negotiation**: A 12-state finite state machine (FSM) guides agents through verifiable evidence retrieval, obligation matching, privacy-preserving liquidity constraints, and structured counterproposals.
2. **Verifiable Claim Envelopes**: Asymmetric **Ed25519** cryptographic signatures (`@noble/ed25519`) and **SHA-512** evidence hashing on all inter-agent messages.
3. **Data Minimization & Trust Boundaries**: Neither agent accesses the other's raw accounts or ledgers. Sensitive bank balances are translated into minimal privacy-preserving claims (e.g. *"Maximum policy-compliant payment today: €4,000"*).
4. **Deterministic Policy Gatekeeper**: Mathematical policy validation enforcing 11 safety checks (per-payment ceilings, daily limits, cumulative limits, expiry dates, approved counterparties, approved destination IBANs, and idempotency protection).
5. **Open Payments PSD2 & Zwapgrid Integration**:
   - Verification of Payee (VoP) pre-flight checks (`POST /premium/v1/payee-verifications`).
   - SEPA Credit Transfers with SCA (`AUTHORIZATION_REQUIRED` / `RCVD`) status tracking.
   - Future-dated payments scheduled via the native NextGenPSD2 `requestedExecutionDate` parameter.
   - Scoped accounting integration for sales invoices (AR) & purchase invoices (AP).
6. **Auditable Provenance**: Complete chronological audit trail with correlation IDs and JSON export.

---

## High-Level Architecture

```
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     NODE ALPHA: SUPPLIER      │         │       NODE BETA: BUYER        │
│     Nordic Components AB      │         │       Aurora Retail AB        │
│                               │         │                               │
│  ┌─────────────────────────┐  │         │  ┌─────────────────────────┐  │
│  │ Supplier Settlement     │  │         │  │ Buyer Settlement        │  │
│  │ Agent (Ed25519 Key A)   │  │         │  │ Agent (Ed25519 Key B)   │  │
│  └───────────┬─────────────┘  │         │  └───────────┬─────────────┘  │
│              │                │         │              │                │
│  ┌───────────▼─────────────┐  │         │  ┌───────────▼─────────────┐  │
│  │ Zwapgrid Connection     │  │         │  │ Open Payments PSD2      │  │
│  │ Scope: Sales Invoices AR│  │         │  │ Scope: PIS & AIS        │  │
│  └─────────────────────────┘  │         │  └─────────────────────────┘  │
└──────────────┬────────────────┘         └──────────────┬────────────────┘
               │                                         │
               │        Signed Claim Envelopes Wire      │
               └────────────────► ◄──────────────────────┘
                         (No Raw Financial Data)
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │    MandatePolicyEngine (No LLM)   │
                 │      11-Point Safety Firewall     │
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │     PaymentController (PSD2)      │
                 │   VoP Check ➔ SEPA Initiation     │
                 └───────────────────────────────────┘
```

---

## Setup & Execution Instructions

### 1. Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env
```

### 2. Environment Variables Reference

| Variable | Required | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | SQLite database connection string | `file:./dev.db` |
| `INTEGRATION_MODE` | No | Integration mode (`mock`, `sandbox`, `real`) | `mock` |
| `ZWAPGRID_API_KEY` | Optional | API key for `https://apione.zwapgrid.com` | `""` |
| `ZWAPGRID_CONSENT_ID`| Optional | Connected customer ERP consent identifier | `""` |
| `OPEN_PAYMENT_CLIENT_ID` | Optional | OAuth2 client ID for Open Payments Europe | `""` |
| `OPEN_PAYMENT_CLIENT_SECRET` | Optional | OAuth2 client secret for Open Payments | `""` |
| `OPEN_PAYMENT_AUTH_HOST` | Optional | OAuth2 authorization server host | `auth.openbankingplatform.com` |
| `OPEN_PAYMENT_API_HOST` | Optional | PSD2 API gateway host | `api.openbankingplatform.com` |

---

## Integration Modes

- **`MOCK` (Default Demo Mode)**: Runs completely offline using structured Berlin Group NextGenPSD2 and Zwapgrid API.1 test fixtures. Allows testing without external dependencies.
- **`SANDBOX`**: Connects to `api.sandbox.openbankingplatform.com` using sandbox client credentials.
- **`LIVE`**: Connects to production Zwapgrid and Open Payments gateways when live credentials and active consent IDs are provided.

---

## Test & Build Commands (Containerized per Security Guidelines)

Run the full automated test suite (17 tests) inside a throwaway Docker container:
```bash
docker run --rm -v "$(pwd)":/app -w /app node:20 sh -c "npx vitest run"
```

Compile the Next.js production build:
```bash
docker run --rm -v "$(pwd)":/app -w /app node:20 sh -c "node ./node_modules/next/dist/bin/next build"
```

Run the application in Docker:
```bash
docker run --rm -p 3000:3000 -v "$(pwd)":/app -w /app node:20 sh -c "node ./node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0"
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation Links
- [3-Minute Hackathon Demo Script](docs/demo-script.md)
- [Comprehensive Implementation Audit](docs/implementation-audit.md)
- [API Integration Status & Classifications](docs/api-integration-status.md)
- [Known Limitations & Operational Assumptions](docs/known-limitations.md)
- [Architecture & Sequence Diagrams](docs/architecture.md)
- [Trust Boundaries & Data Privacy Model](docs/trust-boundaries.md)
