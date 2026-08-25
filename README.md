# Handslag Protokoll 

> **Agentic Financial Handshake — Autonomous B2B Settlement Where Enterprise Finances Shake Hands.**

Handslag Protokoll is an autonomous, policy-bounded B2B settlement network where autonomous finance agents (**Nordic Components AB** and **Aurora Retail AB**) reconcile working capital, verify bilateral obligations, and execute SEPA instant bank settlements with mathematical certainty and zero LLM payment authority.

**Live Production Deployment**: [https://handslag-protokoll-442191986455.europe-north1.run.app](https://handslag-protokoll-442191986455.europe-north1.run.app)

---

## ⚡ Quick Local Deployment (Docker)

```bash
# 1. Build local container
docker build -t handslag-protokoll:local .

# 2. Run locally on port 3000
docker run --rm -p 3000:8080 \
  -e INTEGRATION_MODE=mock \
  -e DATABASE_URL="file:/app/data/dev.db" \
  handslag-protokoll:local
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

👉 **Full Step-by-Step Local Guide**: [docs/local-deployment.md](docs/local-deployment.md)

---

## 🛠️ Environment Variables Reference

| Variable | Required | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | SQLite database connection string | `file:./dev.db` |
| `INTEGRATION_MODE` | No | Open Payments mode (`mock`, `sandbox`, `real`) | `mock` |
| `ZWAPGRID_MODE` | No | Zwapgrid data classification (`mock`, `test`, `live`) | `mock` |
| `ZWAPGRID_LIVE_ENABLED` | Required for live | Explicit production-accounting guard (`true`/`false`) | `false` |
| `ZWAPGRID_API_KEY` | Required for test/live | API key for `https://apione.zwapgrid.com` | `""` |
| `ZWAPGRID_CONSENT_ID`| Required for test/live | Accepted connected customer ERP consent identifier | `""` |
| `ZWAPGRID_SUPPLIER_CONSENT_ID`| Optional | Supplier ERP consent ID if different from buyer | `""` |
| `ZWAPGRID_BUYER_CONSENT_ID`| Optional | Buyer ERP consent ID if different from supplier | `""` |
| `OPEN_PAYMENT_CLIENT_ID` | Optional | OAuth2 client ID for Open Payments Europe | `""` |
| `OPEN_PAYMENT_CLIENT_SECRET` | Optional | OAuth2 client secret for Open Payments | `""` |
| `OPEN_PAYMENT_AUTH_HOST` | Optional | OAuth2 authorization server host | `auth.openbankingplatform.com` |
| `OPEN_PAYMENT_API_HOST` | Optional | PSD2 API gateway host | `api.openbankingplatform.com` |

---

## 🔌 Integration Modes

Open Payments keeps its existing `INTEGRATION_MODE` setting. Zwapgrid is configured independently:

- **`ZWAPGRID_MODE=mock`**: Offline local fixtures. No Zwapgrid request is made.
- **`ZWAPGRID_MODE=test`**: Real Zwapgrid API requests using a consent connected to test or seeded accounting data. The UI labels evidence as `Zwapgrid [TEST DATA]`.
- **`ZWAPGRID_MODE=live`**: Production accounting data, only when `ZWAPGRID_LIVE_ENABLED=true`. The UI labels evidence as `Zwapgrid [LIVE DATA]`.

A real HTTP request does not automatically mean the accounting data is production data. The consent and connected accounting system determine that classification.

---

## 🌟 Core Capabilities

1. **Autonomous Protocol Negotiation**: A 12-state finite state machine (FSM) guiding bilateral agents through verifiable claim envelopes and liquidity preservation.
2. **1-Click Bilateral Handshake**: Agents auto-match accounts payable, compute the 30-day cash curve, and formulate optimal multi-tranche terms awaiting only 1-click confirmation.
3. **Persistent `SETTLEMENT BASIS`**: Expandable deterministic audit trail showing real-time PSD2 cash runway, ERP inflow triangulation, and payroll buffer protection.
4. **Deterministic Mandate Firewall**: 12 mathematical policy rules enforcing spending caps, payee verification, and reserve buffers without LLM intervention.
5. **TransCare Double-Financing Defense**: SHA-512 cryptographic lien registry locking receivables to prevent multi-lender factoring fraud.
6. **PSD2 / SEPA Instant Integration**: Verification of Payee (VoP) pre-flight checks and real-time bank settlement execution.

---

## 📚 Documentation Links
- [Local Deployment Guide](docs/local-deployment.md)
- [3-Minute Hackathon Demo Script](docs/demo-script.md)
- [Comprehensive Implementation Audit](docs/implementation-audit.md)
- [API Integration Status & Classifications](docs/api-integration-status.md)
- [Known Limitations & Operational Assumptions](docs/known-limitations.md)
- [Architecture & Sequence Diagrams](docs/architecture.md)
- [Trust Boundaries & Data Privacy Model](docs/trust-boundaries.md)
