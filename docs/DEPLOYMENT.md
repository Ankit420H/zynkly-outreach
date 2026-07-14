# Deployment Runbook

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Incident Response](#incident-response)

---

## Pre-Deployment Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] Lint passing (`pnpm lint`)
- [ ] Type-check passing (`pnpm type-check`)
- [ ] Security scan passed (no critical vulnerabilities)
- [ ] Database migrations tested locally
- [ ] Secrets rotated if compromised
- [ ] Feature flags configured for new features
- [ ] Runbook updated with new endpoints/config
- [ ] On-call engineer notified (if applicable)

---

## Deployment Procedures

### Option A: GitHub Actions (Automated)

1. **Trigger:** Push to `main` or `release/*` branch
2. **Pipeline:**
   - Lint & type-check
   - Unit/integration tests
   - Security scan (Trivy, npm audit)
   - Build Docker image
   - Push to GHCR
   - Deploy to Cloud Run / Fly.io
   - Run smoke tests
   - Shift traffic to new revision

### Option B: Manual Deployment

```bash
# 1. Build Docker image
docker build -t zynkly-app:latest .

# 2. Tag and push to registry
docker tag zynkly-app:latest ghcr.io/your-org/zynkly-app:latest
docker push ghcr.io/your-org/zynkly-app:latest

# 3. Deploy to Cloud Run
gcloud run deploy zynkly-app \
  --image=ghcr.io/your-org/zynkly-app:latest \
  --region=us-central1 \
  --platform=managed \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10

# 4. Verify deployment
curl -f https://zynkly.your-domain.com/healthz
curl -f https://zynkly.your-domain.com/readyz
```

---

## Rollback Procedures

### Automated Rollback

```bash
# Rollback to previous revision on Cloud Run
gcloud run services update-traffic zynkly-app \
  --region=us-central1 \
  --to-revisions=zynkly-app-00001-abc=100
```

### Manual Rollback

```bash
# 1. Identify previous good commit
git log --oneline -10

# 2. Revert commit
git revert <bad-commit-sha>
git push origin main

# 3. Or rollback via tag
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0
git checkout v1.1.0
git tag v1.2.0
git push origin v1.2.0
```

### Database Rollback

```bash
# Prisma: migrate to specific migration
pnpm db:migrate:prod --to <migration-name>

# Or use Prisma Studio to manually fix data
pnpm db:studio
```

---

## Post-Deployment Verification

### Smoke Tests

```bash
# Health checks
curl -f https://zynkly.your-domain.com/healthz
curl -f https://zynkly.your-domain.com/readyz

# Functional tests
curl -f https://zynkly.your-domain.com/api/health
curl -f https://zynkly.your-domain.com/login

# Check logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit 50 \
  --format json
```

### Monitoring Dashboards

- **Grafana:** http://grafana.your-domain.com
  - Request rate & latency
  - Error rate
  - Database connection pool
  - Redis cache hit rate
  - Queue depth

- **Prometheus Alerts:** Check Alertmanager for firing alerts

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P0 | Complete outage | < 15 min | App returning 500 for all requests |
| P1 | Degraded service | < 1 hour | High error rate, slow responses |
| P2 | Minor impact | < 4 hours | Single feature broken |
| P3 | No user impact | Next business day | Internal tool broken |

### Escalation Path

```
Engineer on-call
  → Tech Lead (15 min if no response)
  → Engineering Manager (30 min if no response)
  → CTO (1 hour for P0/P1)
```

### Incident Communication

1. **Internal:** Post to #incidents Slack channel
2. **Status Page:** Update status.your-domain.com
3. **External:** Email notification to affected users (if data breach)

### Post-Incident Review

1. Timeline reconstruction
2. Root cause analysis (5 Whys)
3. Action items to prevent recurrence
4. Update runbooks
5. Schedule retro meeting within 48 hours

---

## Useful Commands

```bash
# View logs
gcloud logging tail "resource.type=cloud_run_revision"

# Check current revision
gcloud run services describe zynkly-app --region=us-central1

# Rollback traffic
gcloud run services update-traffic zynkly-app \
  --region=us-central1 \
  --to-revisions=<revision>=100

# Database connection
gcloud sql connect zynkly-postgres --user=zynkly

# Redis CLI
redis-cli -h redis-host PING

# Check Vault status
vault status
vault secrets list

# Run migrations
pnpm db:migrate:prod

# Seed database
pnpm db:seed
```