# Settlement Network — Known Limitations & Operational Assumptions

This document clearly outlines the current limitations, architectural trade-offs, and operational assumptions of the MVP implementation.

---

## 1. Banking Authorization & SCA (Strong Customer Authentication)

- **Limitation**: Under European PSD2 law (Regulatory Technical Standards on SCA), Payment Initiation Services (PIS) require customer authentication via the ASPSP (e.g. BankID, SMS OTP, or Decoupled Mobile Banking App approval).
- **Agent Behavior**: The agent initiates the payment instruction and verifies its acceptance by the banking gateway (`AUTHORIZATION_REQUIRED` / `RCVD`). The agent **cannot** bypass or forge human biometrics; the treasurer or CFO approves the batch in their mobile banking app.
- **Demo Mode**: The mock adapter simulates this state transition (`AUTHORIZATION_REQUIRED`) in compliance with the Berlin Group NextGenPSD2 schema.

---

## 2. Open Payments AIS (Account Information Services) PSU Consent

- **Limitation**: In live production Open Payments environments, fetching live bank account balances (`/psd2/accountinformation/v1/accounts`) requires a browser redirect OAuth2 consent flow where the end user logs into their bank to authorize a 90-day consent token.
- **Agent Behavior**: In the automated backend daemon context without interactive browser redirects, the agent uses structured mock account telemetry to evaluate liquidity policies.

---

## 3. Zwapgrid API.1 Accounting Consent

- **Limitation**: Accessing live sales invoices (AR) or supplier invoices (AP) via `https://apione.zwapgrid.com` requires an active `consentId` provisioned through an ERP integration handshake (e.g. Fortnox, Visma, Business Central).
- **Fallback**: When running without an active `ZWAPGRID_CONSENT_ID`, `RealZwapgridAdapter` automatically falls back to seeded mock invoice data (`MockZwapgridAdapter`), maintaining 100% testability and zero crashes.

---

## 4. Single-Currency MVP Scope

- **Limitation**: The current negotiation finite state machine is configured for Euro (`EUR`) single-currency obligations. Multi-currency FX hedging via Open Payments FX quotes (`/psd2/paymentinitiation/v1/fx`) is defined in the adapter interface but not triggered in the default 3-minute demo flow.
