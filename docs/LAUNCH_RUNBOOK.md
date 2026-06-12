# Velo Production Launch Runbook

**Version**: 1.0  
**Audience**: Engineering, DevOps, on-call

---

## Pre-Launch Checklist (T-7 days)

### Infrastructure
- [ ] AWS KMS keys created in `us-east-1` and `eu-west-1`
- [ ] RDS PostgreSQL 15 Multi-AZ cluster provisioned
- [ ] ElastiCache Redis 7 cluster with AOF persistence enabled
- [ ] ECS clusters created (`velo-prod-api`, `velo-prod-reconciler`)
- [ ] ECR repositories created and lifecycle policies set
- [ ] ACM certificates issued for `api.velo.finance` and `app.velo.finance`
- [ ] ALB listeners configured (443 → ECS, 80 → redirect 443)
- [ ] Cloudflare DNS entries created (proxy enabled)
- [ ] S3 bucket for static assets with CloudFront distribution

### Secrets (never commit these)
- [ ] `JWT_SECRET` — 64 random bytes in AWS Secrets Manager
- [ ] `DATABASE_URL` — RDS connection string with SSL
- [ ] `REDIS_URL` — ElastiCache connection string with TLS
- [ ] `HORIZON_URL` — Stellar Horizon endpoint
- [ ] `TREASURY_ADDRESS` — production Stellar account
- [ ] `KMS_KEY_ID` — AWS KMS key ARN for treasury signing
- [ ] `TRM_LABS_API_KEY` — sanctions screening
- [ ] `POSTMARK_API_KEY` — transactional email
- [ ] `CORS_ORIGINS` — `https://app.velo.finance`

### Database
- [ ] Run migrations: `npm run migrate` (verifies idempotency)
- [ ] Confirm `schema_migrations` table shows 010 entries
- [ ] Confirm RLS policies active: `SELECT * FROM pg_policies;`
- [ ] Create production merchant: update seed with live data
- [ ] Test RLS: run query as `app_user` with `app.current_merchant_id` set

### Stellar
- [ ] Treasury account funded with XLM for transaction fees
- [ ] USDC trustline established on treasury account
- [ ] Verify muxed address generation: test 10 invoice creations
- [ ] Reconciler cursor seeded: confirm `reconciler_state` has `('cursor', '')`

## Launch Day (T-0)

### T-4h: Final validation
```bash
# Run security audit
./scripts/pre-launch-audit.sh

# Smoke test staging (must all pass)
curl -sf https://staging-api.velo.finance/health | jq .
curl -sf https://staging-api.velo.finance/health/deep | jq .
```

### T-1h: Deploy
```bash
# Tag and push — triggers deploy-backend.yml
git tag deploy/$(date +%Y%m%d-%H%M)
git push origin --tags

# Watch deployment
aws ecs describe-services \
  --cluster velo-prod \
  --services velo-api \
  --query 'services[0].deployments'
```

### T-0: Go live
1. Switch Cloudflare DNS from maintenance page to ALB
2. Confirm `/health` returns `{"status":"ok"}` from production URL
3. Create one live test invoice through dashboard
4. Verify reconciler picks it up within 5 seconds (check logs)
5. Process test payment and confirm SSE status update fires

### First hour monitoring
- CloudWatch dashboard: API latency p99, error rate, reconciler lag
- Sentry: watch for new issues
- PagerDuty: confirm on-call rotation active

---

## Operational Runbook

### Incident levels
| Level | Criteria | Response time | Escalation |
|-------|----------|---------------|------------|
| P0 | Payments failing, data loss risk | 15 min | CEO + CTO |
| P1 | >5% error rate or >2s p99 latency | 30 min | On-call engineer |
| P2 | Degraded feature, <5% impacted | 4h | Next business day |

### Common issues

#### Reconciler stuck (no cursor progress)
```bash
# Check cursor
psql $DATABASE_URL -c "SELECT * FROM reconciler_state;"

# Check reconciler logs
aws logs tail /velo/reconciler --follow --since 10m

# Manual restart
aws ecs update-service --cluster velo-prod --service velo-reconciler --force-new-deployment
```

#### Settlement failed
```bash
# Check settlement status
psql $DATABASE_URL -c "SELECT * FROM settlements ORDER BY created_at DESC LIMIT 5;"

# Retry settlement (idempotent — safe to re-run)
curl -X POST https://api.velo.finance/settlements/retry \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Webhook delivery failures
```bash
# Check dead-letter entries
psql $DATABASE_URL -c "
  SELECT w.url, wd.attempts, wd.last_error
  FROM webhook_deliveries wd
  JOIN webhooks w ON w.id = wd.webhook_id
  WHERE wd.status = 'dead'
  ORDER BY wd.updated_at DESC;
"

# Re-queue specific delivery (Redis stream XADD)
```

#### Database connection pool exhaustion
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Graceful restart of API (ECS rolling update)
aws ecs update-service --cluster velo-prod --service velo-api --force-new-deployment
```

### Rollback procedure
```bash
# Identify last known good task definition
aws ecs describe-services --cluster velo-prod --services velo-api \
  --query 'services[0].deployments'

# Roll back to previous
aws ecs update-service \
  --cluster velo-prod \
  --service velo-api \
  --task-definition velo-api:<PREVIOUS_REVISION>
```

### Database migration rollback
Migrations are intentionally written to be forward-only (additive). Rollback = deploy fix forward.

---

## Disaster Recovery

### RTO / RPO targets
| Scenario | RTO | RPO |
|----------|-----|-----|
| AZ failure | < 5 min (Multi-AZ failover) | 0 (synchronous replica) |
| Region failure | < 4h | < 1h (cross-region backup) |
| Data corruption | < 8h | < 1h (point-in-time restore) |

### Database restore
```bash
# List snapshots
aws rds describe-db-snapshots --db-instance-identifier velo-prod-postgres

# Restore to point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier velo-prod-postgres \
  --target-db-instance-identifier velo-prod-postgres-restore \
  --restore-time 2026-06-05T02:00:00Z
```

---

## Contacts

| Role | Contact |
|------|---------|
| On-call engineer | PagerDuty rotation |
| Database | DBA team |
| Stellar / blockchain | Protocol team |
| Legal / compliance | legal@velo.finance |
| AWS support | Enterprise support case |
