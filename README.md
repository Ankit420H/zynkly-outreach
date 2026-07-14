# Zynkly Outreach

> Enterprise-grade email campaign orchestration platform.

**Version:** 0.1.0  
**License:** Proprietary  
**Architecture:** Monolith (Next.js 16 Full-Stack)  
**Database:** PostgreSQL + Redis  
**Background Jobs:** Inngest  

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [Prerequisites](#prerequisites)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Security](#security)
9. [Contributing](#contributing)

---

## Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser / Mobile]
        CDN[CDN / Edge Cache]
    end

    subgraph "Application Layer"
        LB[Load Balancer]
        NextJS[Next.js 16 App Server<br/>React 19 + Server Actions]
        Auth[NextAuth v5<br/>Session Management]
    end

    subgraph "Background Processing"
        Inngest[Inngest Worker<br/>Campaign Sending]
        Redis[(Redis<br/>Cache + Pub/Sub)]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary + Read Replica)]
        SMTP[SMTP Profiles<br/>Gmail / Outlook / SES]
        Blob[Blob Storage<br/>Attachments]
    end

    subgraph "External Services"
        Email[Recipient Mail Servers]
    end

    Browser --> CDN
    CDN --> LB
    LB --> NextJS
    NextJS --> Auth
    NextJS --> Redis
    NextJS --> PG
    NextJS --> Inngest
    Inngest --> Redis
    Inngest --> PG
    Inngest --> SMTP
    SMTP --> Email
    NextJS --> Blob
```

### Key Components

| Component | Responsibility | Tech |
|-----------|---------------|------|
| **Next.js App Server** | SSR, API routes, Server Actions, auth | Next.js 16, React 19 |
| **Prisma ORM** | Database access, migrations | Prisma Client |
| **Inngest** | Durable background job execution | Inngest Cloud / Self-hosted |
| **Redis** | Session cache, rate limiting, pub/sub | Upstash Redis |
| **PostgreSQL** | Primary datastore | AWS RDS / GCP Cloud SQL |
| **SMTP Profiles** | Outbound email delivery | Nodemailer + provider APIs |

---

## Data Flow

```mermaid
flowchart LR
    A[User creates campaign] --> B[Validate via Preflight API]
    B --> C{Valid?}
    C -->|Yes| D[Persist Campaign + Queue Items]
    C -->|No| E[Return validation errors]
    D --> F[Inngest triggers send event]
    F --> G[Worker picks queue items]
    G --> H[Send via SMTP Profile]
    H --> I{Success?}
    I -->|Yes| J[Mark SENT + increment counters]
    I -->|No| K[Mark FAILED + retry/backoff]
    J --> L[Update dashboard in real-time]
    K --> L
```

### Request Lifecycle

1. **Client Request** → Load Balancer → Next.js Server
2. **Auth Check** → NextAuth validates session (Redis-backed)
3. **Route Handling** → App Router renders page or API route returns JSON
4. **Server Action** → Direct DB mutation via Prisma (no API layer)
5. **Background Job** → Inngest event triggers async worker
6. **Response** → Client receives updated state or WebSocket push

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20.x | Runtime |
| pnpm | >= 9.x | Package manager |
| PostgreSQL | >= 15.x | Database |
| Redis | >= 7.x | Cache / Queue |
| Docker | >= 24.x | Containerization |
| Docker Compose | >= 2.x | Local orchestration |

---

## Local Development

### Option A: Docker Compose (Recommended)

```bash
# Clone repository
git clone git@github.com:your-org/zynkly-outreach.git
cd zynkly-outreach

# Copy environment template
cp .env.example .env

# Start all services
docker compose up -d

# Run migrations
docker compose exec app npx prisma migrate deploy

# Seed database (optional)
docker compose exec app npx prisma db seed

# Access application
open http://localhost:3000
```

### Option B: Native Installation

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and Redis locally
# Ensure DATABASE_URL and REDIS_URL are set in .env

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

---

## Environment Variables

See `.env.example` for the full list. Critical variables:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/zynkly"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
AUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

# Inngest
INGEST_EVENT_KEY="..."
INGEST_SIGNING_KEY="..."

# SMTP (at least one profile required for testing)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."

# Encryption (32+ chars)
SMTP_ENCRYPTION_KEY="..."

# Blob Storage
BLOB_READ_WRITE_TOKEN="..."
```

> **Security Note:** Never commit `.env` to version control. Use your secret manager in production.

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

---

## Deployment

### CI/CD Pipeline

- **Trigger:** Push to `main` or `release/*`
- **Steps:**
  1. Lint + Type-check
  2. Security scan (Snyk / Trivy)
  3. Build Docker image
  4. Push to ECR / GCR
  5. Deploy to ECS / Cloud Run (rolling update)
  6. Run smoke tests
  7. Notify Slack / Email

### Infrastructure

- **Compute:** AWS ECS Fargate / GCP Cloud Run
- **Database:** AWS RDS PostgreSQL Multi-AZ
- **Cache:** ElastiCache / Memorystore
- **Secrets:** AWS Secrets Manager / GCP Secret Manager
- **Monitoring:** Datadog / CloudWatch + Sentry

See `docs/DEPLOYMENT.md` for runbooks.

---

## Security

- **Authentication:** NextAuth v5 with credential provider
- **Authorization:** Role-based access control (RBAC) at Server Action layer
- **Data Protection:** SMTP passwords encrypted at rest via `crypto-js`
- **Input Validation:** Zod schemas on all Server Actions and API routes
- **Rate Limiting:** Redis-backed rate limiter on API routes
- **CORS:** Strict origin policy in production
- **Dependencies:** Automated vulnerability scanning in CI

---

## Contributing

See `docs/CONTRIBUTING.md` and `docs/GIT_BRANCHING_STRATEGY.md`.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Proprietary. All rights reserved.