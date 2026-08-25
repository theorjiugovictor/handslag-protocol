# Settlement Network — API Integration Status

This document explicitly classifies each financial API capability according to its real-world implementation status.

| Service | Capability | Classification | Technical Description / Endpoints |
| :--- | :--- | :--- | :--- |
| **Open Payments** | OAuth2 Token Flow | **REAL / SANDBOX** *(Mock Fallback)* | `POST https://auth.openbankingplatform.com/connect/token` with `client_credentials` grant type. Real client credentials request implemented in `RealOpenPaymentsAdapter`; falls back to `MockOpenPaymentsAdapter` if unconfigured. |
| **Open Payments** | SEPA Payment Initiation (PIS) | **REAL / SANDBOX** *(Mock Fallback)* | `POST /psd2/paymentinitiation/v1/payments/sepa-credit-transfers`. Requires mandatory headers (`X-Request-ID`, `PSU-IP-Address`, `PSU-User-Agent`). Correctly records payment initiation in `AUTHORIZATION_REQUIRED` (`RCVD`), awaiting bank SCA approval. |
| **Open Payments** | Future-Dated Payments | **REAL / SANDBOX** *(Mock Fallback)* | Supported natively in Open Payments NextGenPSD2 standard via `requestedExecutionDate` ISO date parameter on payment initiation. |
| **Open Payments** | Payment Status Query | **REAL / SANDBOX** *(Mock Fallback)* | `GET /psd2/paymentinitiation/v1/payments/sepa-credit-transfers/{paymentId}/status`. |
| **Open Payments** | Verification of Payee (VoP) | **REAL / SANDBOX** *(Mock Fallback)* | `POST /premium/v1/payee-verifications`. Pre-flight check verifying destination IBAN matches creditor legal name before payment initiation. |
| **Open Payments** | Account Information (AIS) | **MOCKED** *(Requires PSU Browser Redirect)* | Real AIS requires PSU interactive browser redirect for OAuth2 `authorization_code` grant and Consent creation (`/psd2/consent/v1/consents`). Structured mock account telemetry used for automated backend agent evaluation. |
| **Zwapgrid** | Unified Accounting Auth | **REAL** *(Mock Fallback)* | Requires `x-api-key` and `x-correlation-id` headers against `https://apione.zwapgrid.com`. |
| **Zwapgrid** | Sales Invoices (AR) | **REAL** *(Mock Fallback)* | `GET /accounting/api/v1/consents/{consentId}/salesinvoices`. Real execution requires an active consent ID from a connected ERP; gracefully falls back to mock mode if unconfigured. |
| **Zwapgrid** | Purchase Invoices (AP) | **REAL** *(Mock Fallback)* | `GET /accounting/api/v1/consents/{consentId}/supplierinvoices`. Real execution requires active buyer consent ID. |
| **Internal Engine** | Ed25519 Claim Signatures | **REAL (Active RFC 8032)** | Pure cryptographic asymmetric signing (`@noble/ed25519` + SHA-512 evidence hashing) generating verifiable claim envelopes with separate evidence hashes and digital signatures. |
| **Internal Engine** | Deterministic Mandate Engine | **REAL (Active Mathematical Firewall)** | 11-point mathematical validation verifying per-payment ceilings, cumulative caps, daily caps, counterparty IDs, approved destination IBANs, active mandate validation, and duplicate instruction detection. |
