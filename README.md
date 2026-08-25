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

## Core Capabilities

1. **Autonomous Protocol Negotiation**: A 12-state finite state machine (FSM) guiding bilateral agents through verifiable claim envelopes and liquidity preservation.
2. **1-Click Bilateral Handshake**: Agents auto-match accounts payable, compute the 30-day cash curve, and formulate optimal multi-tranche terms awaiting only 1-click confirmation.
3. **Persistent `SETTLEMENT BASIS`**: Expandable deterministic audit trail showing real-time PSD2 cash runway, ERP inflow triangulation, and payroll buffer protection.
4. **Deterministic Mandate Firewall**: 12 mathematical policy rules enforcing spending caps, payee verification, and reserve buffers without LLM intervention.
5. **TransCare Double-Financing Defense**: SHA-512 cryptographic lien registry locking receivables to prevent multi-lender factoring fraud.
6. **PSD2 / SEPA Instant Integration**: Verification of Payee (VoP) pre-flight checks and real-time bank settlement execution.

---

## Documentation Links
- [Local Deployment Guide](docs/local-deployment.md)
- [3-Minute Hackathon Demo Script](docs/demo-script.md)
- [Comprehensive Implementation Audit](docs/implementation-audit.md)
- [API Integration Status & Classifications](docs/api-integration-status.md)
- [Known Limitations & Operational Assumptions](docs/known-limitations.md)
- [Architecture & Sequence Diagrams](docs/architecture.md)
- [Trust Boundaries & Data Privacy Model](docs/trust-boundaries.md)
