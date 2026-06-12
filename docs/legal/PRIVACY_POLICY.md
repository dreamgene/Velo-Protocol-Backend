# Velo Privacy Policy

**Last updated: 2026-06-05**

> **LEGAL NOTICE**: Draft template — requires legal review before publication.

---

## 1. Information We Collect

**Account data**: name, email address, business information provided at registration.

**Transaction data**: invoice amounts, payment events, paging tokens, Stellar addresses processed through the platform.

**Technical data**: IP addresses, user agent strings, request timestamps (used for rate limiting and fraud detection).

**Compliance data**: OFAC screening results for Stellar addresses.

## 2. How We Use Information

- To provide and operate the Service
- To process payments and calculate settlements
- To comply with legal obligations (OFAC, AML/KYC requirements)
- To detect fraud and prevent abuse
- To send transactional emails (payment confirmations, settlement notices)

## 3. Data Sharing

We do not sell your personal data. We share data only with:

- **TRM Labs**: Stellar address screening for OFAC compliance
- **AWS**: Infrastructure hosting (encrypted at rest and in transit)
- **Postmark**: Transactional email delivery
- Law enforcement when required by valid legal process

## 4. Data Retention

- Account data: retained for the duration of your account plus 7 years (regulatory requirement)
- Transaction data: retained for 7 years
- Audit logs: retained for 3 years

## 5. Your Rights (GDPR — EU/EEA)

If you are located in the EU/EEA, you have the right to:
- **Access** your personal data (data export)
- **Erasure** of your personal data ("right to be forgotten") — subject to legal retention obligations
- **Rectification** of inaccurate data
- **Portability** of your data
- **Object** to processing

Submit requests via: Dashboard → Settings → GDPR Requests, or email: privacy@velo.finance

We respond within 30 days.

## 6. Security

- All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- Private keys managed exclusively via AWS KMS — never stored in application memory
- API keys and webhook secrets stored as SHA-256 hashes only
- JWT tokens stored in httpOnly, Secure, SameSite=Strict cookies
- Penetration testing performed annually

## 7. Cookies

We use only a single session cookie (`velo_session`) which is httpOnly, Secure, and SameSite=Strict. We do not use tracking or advertising cookies.

## 8. Changes

We will notify you of material changes by email 30 days in advance.

## 9. Contact

Privacy inquiries: privacy@velo.finance
