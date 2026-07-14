# Git Branching Strategy

## Model: Trunk-Based Development with Release Branches

This repository follows **Trunk-Based Development** with protected `main` and `release/*` branches. This enables continuous integration, feature flags, and zero-downtime releases while maintaining auditability.

## Branch Structure

```
main (protected)
  ├── release/1.2.0 (protected, created for stabilization)
  │     ├── hotfix/1.2.1 (protected, branched from release)
  │     └── ...
  ├── feature/campaign-preflight (short-lived)
  ├── feature/bulk-actions (short-lived)
  └── fix/login-redirect (short-lived)
```

## Branch Purposes

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code. Every commit is deployable. | Protected: require PR, status checks, 1 approval |
| `release/*` | Stabilization branch for upcoming release. Bug fixes only. | Protected: require PR, no force pushes |
| `feature/*` | New features. Short-lived (< 3 days ideal). | No protection; PR required to merge |
| `fix/*` | Bug fixes. Can branch from `main` or `release/*`. | No protection; PR required to merge |
| `hotfix/*` | Emergency production fixes. Branched from `release/*` or `main`. | PR required; expedited review |

## Workflow

### 1. Feature Development
```bash
git checkout main
git pull origin main
git checkout -b feature/campaign-preflight
# ... work ...
git push origin feature/campaign-preflight
# Open PR to main
```

### 2. Release Preparation
```bash
# When main is ready for release
git checkout main
git checkout -b release/1.2.0
# Bump version in package.json, CHANGELOG.md
# Only bug fixes merge here
git push origin release/1.2.0
```

### 3. Hotfix
```bash
git checkout release/1.2.0
git checkout -b hotfix/1.2.1
# ... fix ...
git push origin hotfix/1.2.1
# Open PR to release/1.2.0 AND main (if applicable)
```

### 4. Merge & Deploy
- Merges to `main` trigger CI/CD pipeline.
- Merges to `release/*` trigger release pipeline.
- `main` is always deployable; `release/*` is frozen except for critical fixes.

## PR Requirements

- **Title convention:** `type(scope): description`
  - `feat(campaigns): add preflight validation`
  - `fix(auth): resolve redirect loop`
  - `docs(readme): update setup instructions`
- **Description:** Problem, solution, testing notes, screenshots (if UI).
- **Reviews:** Minimum 1 approval for `main`, 2 for `release/*`.
- **Checks:** Lint, type-check, tests, security scan must pass.
- **Squash merge:** Enabled for `feature/*` and `fix/*`. Merge commit for `release/*` and `hotfix/*`.

## Versioning

- Semantic Versioning (`MAJOR.MINOR.PATCH`).
- `main` always reflects the next release.
- `release/*` reflects the stabilizing version.
- Tags are created on `main` after successful production deploy.

## Tagging

```bash
git tag -a v1.2.0 -m "Release 1.2.0: Campaign Wizard Collapse"
git push origin v1.2.0
```

## Rollback Procedure

1. Identify bad commit SHA on `main`.
2. Revert commit: `git revert <sha>` or roll back tag.
3. Push to `main` triggers automatic rollback deploy.
4. Create `hotfix/*` branch from previous good tag for root-cause fix.

## Secrets & Sensitive Data

- **Never** commit secrets, keys, or credentials.
- Use `.env.example` to document required variables.
- Secrets are injected at build/deploy time via CI/CD or secret manager.
- If a secret is committed, rotate immediately and purge from git history.