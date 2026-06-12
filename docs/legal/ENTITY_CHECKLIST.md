# Velo Entity & Legal Checklist

> Pre-launch legal checklist — consult qualified legal counsel for each item.

---

## Corporate Structure

- [ ] Incorporate legal entity (Delaware C-Corp recommended for US VC-backed companies, or Cayman Islands for international)
- [ ] Register DBA / trade name "Velo" in operating jurisdictions
- [ ] Open business bank account
- [ ] Set up company equity and founder vesting schedule

## Money Transmission & Licensing

- [ ] Determine if Money Services Business (MSB) registration with FinCEN is required
- [ ] Assess state money transmitter license requirements (US)
- [ ] Assess e-money / payment institution licensing (EU — PSD2)
- [ ] Engage AML/KYC counsel for compliance program design
- [ ] Establish Bank Secrecy Act (BSA) compliance program if required
- [ ] Implement SAR filing procedures

## OFAC / Sanctions Compliance

- [ ] Formal OFAC compliance program documented
- [ ] TRM Labs contract signed (or equivalent sanctions screening provider)
- [ ] Blocked transaction procedures documented
- [ ] Employee training on sanctions compliance

## Tax

- [ ] Register for applicable sales tax / VAT in operating jurisdictions
- [ ] Establish transfer pricing documentation (if multi-entity)
- [ ] Crypto-specific tax reporting obligations reviewed (1099-DA for US)

## Insurance

- [ ] Cyber liability insurance (minimum $1M coverage recommended)
- [ ] Directors and Officers (D&O) insurance
- [ ] Professional liability (E&O) insurance
- [ ] Crime / fidelity bond

## Intellectual Property

- [ ] Trademark "Velo" in primary markets (US, EU, UK, APAC)
- [ ] Source code copyright notices in place
- [ ] Open source license audit (verify all dependencies)
- [ ] IP assignment agreements signed by all founders and employees

## Customer Agreements

- [ ] Terms of Service reviewed by counsel and published
- [ ] Privacy Policy reviewed by counsel and published
- [ ] DPA (Data Processing Agreement) template created for B2B customers
- [ ] Merchant agreement reviewed and published
- [ ] Cookie policy (minimal — first-party session only)

## Employment

- [ ] Offer letters with IP assignment and confidentiality clauses
- [ ] Employee handbook
- [ ] Background check policy for employees with system access

## Security & Audits

- [ ] Pre-launch penetration test scheduled (within 90 days of launch)
- [ ] Smart contract audit (invoice, treasury, compliance contracts)
- [ ] Bug bounty program established
- [ ] SOC 2 Type I audit roadmap (target: 12 months post-launch)

## Launch Blockers (Must-complete before first live transaction)

- [ ] OFAC screening live and tested
- [ ] TOS and Privacy Policy published at canonical URLs
- [ ] Incident response plan documented
- [ ] Key personnel notified of on-call rotation
- [ ] KMS keys rotated from test to production
- [ ] All environment variables validated against Zod schema on startup
- [ ] Pre-launch security audit script passing (scripts/pre-launch-audit.sh)
