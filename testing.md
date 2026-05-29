# 🧪 Testing Strategy
## Unit · Integration · E2E · Security · Isolation · AI Eval · Accessibility · Load

> Testing pyramid for a multi-tenant SaaS. Every layer catches different bugs.

---

## 📋 Table of Contents

1. [Test Pyramid](#test-pyramid)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [End-to-End Tests (Playwright)](#end-to-end-tests-playwright)
5. [Security Tests](#security-tests)
6. [Workspace Isolation Test Suite](#workspace-isolation-test-suite)
7. [AI Evaluation Tests](#ai-evaluation-tests)
8. [Accessibility Tests](#accessibility-tests)
9. [Performance / Load Tests](#performance--load-tests)
10. [Visual Regression Tests](#visual-regression-tests)
11. [CI Pipeline](#ci-pipeline)
12. [Coverage Targets](#coverage-targets)

---

## Test Pyramid

```
                     ▲
                    ╱ ╲
                   ╱E2E╲                  5%   (Playwright — 50-100 tests)
                  ╱─────╲
                 ╱       ╲
                ╱Integrtn ╲                15%  (supertest — 500-1000 tests)
               ╱───────────╲
              ╱             ╲
             ╱     Unit       ╲             80% (Jest — 5000-10000 tests)
            ╱─────────────────╲

  CI runs ALL on every PR.   Total wall time target: <10 minutes.
```

### Why the Pyramid Shape

- Unit tests: fast (ms), isolated, easy to debug → write many
- Integration: slower (100s of ms), real DB → write important paths
- E2E: slow (seconds-minutes), brittle → write critical user flows only

---

## Unit Tests

### Library: Jest 29

```bash
# Backend (each service)
yarn test
yarn test --coverage
yarn test --watch

# Frontend
yarn test:web
```

### What to Unit Test

| Category | Examples |
|---|---|
| **Pure functions** | Keyword scoring formula, cost calculator, content score |
| **Service business logic** | Lead scoring rules engine, attribution model calculator |
| **Validators** | Joi schemas, AI output validators, email format checks |
| **Utility functions** | Date formatters, slug generators, JWT helpers |
| **React component logic** | Hooks, reducers, derived state |

### Example

```javascript
// services/crm-automation/_services/__tests__/lead-scoring.test.js
const { calculateScoreDelta } = require('../lead-scoring.service');

describe('Lead Scoring', () => {
  test('email open adds +10', () => {
    expect(calculateScoreDelta({ event: 'email_open' })).toBe(10);
  });

  test('pricing page visit adds +20', () => {
    expect(calculateScoreDelta({ event: 'page_view', url: '/pricing' })).toBe(20);
  });

  test('unsubscribe subtracts 30', () => {
    expect(calculateScoreDelta({ event: 'email_unsubscribe' })).toBe(-30);
  });

  test('score decays after 30 days of inactivity', () => {
    const lastActivity = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    expect(calculateScoreDecay(100, lastActivity)).toBeLessThan(100);
  });
});
```

### Mocking External Services

```javascript
// __mocks__/aiProvider.js
module.exports = {
  generate: jest.fn().mockResolvedValue({
    text: 'Mocked AI response',
    tokens_in: 100, tokens_out: 200, cost_usd: 0,
  })
};

// In tests:
jest.mock('../ai-provider.service');
const { generate } = require('../ai-provider.service');
generate.mockResolvedValueOnce({ text: 'specific response' });
```

### Coverage Targets

| Service | Unit Test Coverage Target |
|---|---|
| Pure business logic (`_services/*`) | 90% |
| Validators | 100% |
| Controllers / Routes | 70% (integration covers the rest) |
| Frontend hooks/utils | 80% |
| Frontend components | 50% (integration + Storybook cover visuals) |

---

## Integration Tests

### Library: Supertest + Jest

Tests run against a real test database (separate MySQL/PostgreSQL schema per service).

### Setup

```javascript
// jest.setup.js
beforeAll(async () => {
  await sequelize.sync({ force: true });  // recreate schema
  await seedTestData();
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  // Clean tables (preserve schema)
  for (const model of Object.values(sequelize.models)) {
    await model.destroy({ where: {}, force: true });
  }
});
```

### Example

```javascript
// services/marketing-core/__tests__/auth.routes.test.js
const request = require('supertest');
const app = require('../app');

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await User.create({
      user_email: 'test@example.com',
      password_hash: await bcrypt.hash('Pass1234!', 10),
      status: 'active',
      email_verified: true,
    });
  });

  test('valid credentials return access_token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Pass1234!' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=')])
    );
  });

  test('invalid password returns 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.access_token).toBeUndefined();
  });

  test('rate limit triggers after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'wrong' });
    }
    const res = await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'Pass1234!' });
    expect(res.status).toBe(429);
  });
});
```

### What to Integration Test

- Every API endpoint: happy path + error cases
- Authentication / authorization paths
- Database transactions (rollback on error)
- Bull job processing (run synchronously in tests)
- Webhook receivers (post mock payloads, verify processing)

---

## End-to-End Tests (Playwright)

### Library: Playwright

```bash
yarn add -D @playwright/test
yarn playwright install
```

### What to E2E Test

Only **critical user flows**. Don't test every page.

| Flow | Why |
|---|---|
| Signup → first login → onboarding complete | Activation funnel |
| **One-Click Capture end-to-end** | Flagship feature |
| Create + send email campaign | Core money-making flow |
| Connect social account → schedule post → verify published | Social marketing critical |
| Create form → submit lead → verify CRM contact | Lead capture |
| Run SEO audit → view results → take action | SEO core |
| Invite team member → accept → access workspace | Multi-user |
| Upgrade subscription → access new features | Revenue |
| Cancel subscription → workspace state changes | Churn flow |
| Agency creates client → client logs in → sees branded UI | White-label |
| Workspace isolation: user A cannot see user B data | Critical security |

### Example

```typescript
// e2e/one-click-capture.spec.ts
import { test, expect } from '@playwright/test';

test('one-click capture creates full campaign', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'TestPass1234!');
  await page.click('button[type=submit]');

  await page.waitForURL('/dashboard');
  await page.click('text=One-Click Capture');

  await page.fill('input[placeholder*="URL"]', 'https://example-restaurant.com');
  await page.click('button:has-text("Start")');

  // Wait for SSE streaming to complete (all 11 steps)
  await expect(page.locator('text=Step 11')).toBeVisible({ timeout: 180_000 });
  await expect(page.locator('text=Campaign created')).toBeVisible();

  // Verify outputs
  await expect(page.locator('text=12 blog posts scheduled')).toBeVisible();
  await expect(page.locator('text=30 social posts')).toBeVisible();
  await expect(page.locator('text=Google Ads ready')).toBeVisible();

  // Click into the campaign to verify it persists
  await page.click('text=View Campaign');
  await expect(page.locator('h1')).toContainText('Example Restaurant');
});
```

### Test Data Strategy

- Each test creates its own user/workspace
- Cleanup after each test (delete workspace)
- Shared fixtures for read-only data
- Run in parallel via Playwright workers

### Run Modes

```bash
# Headless (CI default)
yarn e2e

# Headed (debugging)
yarn e2e --headed

# Single test, debug mode
yarn e2e one-click-capture --debug

# Trace viewer for failed tests
yarn playwright show-report
```

---

## Security Tests

### Categories

1. **Authentication bypass**
2. **SQL injection (via Sequelize injection paths)**
3. **XSS in user-generated content**
4. **CSRF on state-changing operations**
5. **JWT manipulation**
6. **Webhook signature verification**
7. **OAuth state parameter validation**

### Example

```javascript
// tests/security/jwt-manipulation.test.js
describe('JWT Security', () => {
  test('expired token returns 401', async () => {
    const expiredToken = jwt.sign({ id: 'u1' }, SECRET, { expiresIn: '-1h' });
    const res = await request(app)
      .get('/api/v1/seo/keywords')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  test('token signed with wrong secret returns 401', async () => {
    const fakeToken = jwt.sign({ id: 'u1' }, 'wrong-secret');
    const res = await request(app)
      .get('/api/v1/seo/keywords')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  test('algorithm=none attack blocked', async () => {
    // Force algorithm=none (classic JWT attack)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'u1' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    const res = await request(app)
      .get('/api/v1/seo/keywords')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });
});
```

### Automated Security Scanning

```yaml
# .github/workflows/security.yml
- name: Snyk vulnerability scan
  uses: snyk/actions/node@master
  with:
    args: --severity-threshold=high

- name: OWASP ZAP scan
  uses: zaproxy/action-full-scan@v0.6.0
  with:
    target: https://staging.yourplatform.com

- name: gitleaks secret detection
  uses: gitleaks/gitleaks-action@v2
```

---

## Workspace Isolation Test Suite

See `security.md` for the full template. This is **the most critical test suite** — a workspace isolation bug = catastrophic breach.

### Run on EVERY PR

```bash
yarn test:isolation
```

### Comprehensive Matrix

For **every** API endpoint × **every** HTTP method:

| Test | Expected |
|---|---|
| User A creates resource → User B can't read it | 403 / 404 |
| User A creates resource → User B can't update it | 403 / 404 |
| User A creates resource → User B can't delete it | 403 / 404 |
| User A's list does not contain User B's resources | resource absent |
| User A POSTs with `workspace_id: B` in body | Backend uses JWT workspace_id, not body |
| User A's URL params for `workspace_id: B` | 403 (unless agency relationship) |
| Agency owner of A can access client B (linked) | 200 |
| Agency owner of A cannot access unrelated client C | 403 |
| Platform admin can access all | 200 (with impersonation audit log entry) |

### Auto-Generated Tests

A generator script reads OpenAPI spec → creates isolation test for every endpoint. CI fails if new endpoint added without isolation test.

---

## AI Evaluation Tests

See `ai-platform.md` for the full eval harness. Summary:

```bash
# Eval all prompts against test set
yarn ai:eval

# Eval specific prompt
yarn ai:eval seo_blog_post --version v4

# Compare versions
yarn ai:compare seo_blog_post v3 v4

# Output:
# seo_blog_post v4 vs v3:
#   Pass rate: 92% vs 87%  (+5%)
#   Avg cost:  $0.028 vs $0.032  (-12%)
#   Avg latency: 8.2s vs 7.8s  (+5%)
#   ✅ v4 wins on quality, cost; loses on latency
#   Recommend: promote to 25% rollout
```

### Test Cases

Stored in `prompts/*.testCases.js`. Mix of:
- Realistic customer inputs (anonymised)
- Edge cases (very long brand voice, conflicting instructions)
- Adversarial inputs (prompt injection attempts)
- Multilingual inputs

### Quality Metrics

- Validation pass rate (must be > 95%)
- Hallucination detection rate
- Flesch-Kincaid score (readability)
- Word count adherence (±20%)
- Keyword inclusion compliance
- Human rating (sample 1% for blind review)

---

## Accessibility Tests

### Automated

```bash
# Run jest-axe on every component
yarn test:a11y

# Lighthouse CI
yarn lighthouse:ci
```

```javascript
// Component test with axe
import { axe } from 'jest-axe';

test('login form has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual

- Quarterly NVDA + VoiceOver smoke test on critical flows
- Keyboard-only navigation review for every new feature
- Colour contrast verified via Chrome DevTools

### Lighthouse Targets

```javascript
// .lighthouserc.json
{
  "ci": {
    "collect": { "url": ["http://localhost:3000/login", "http://localhost:3000/dashboard"] },
    "assert": {
      "assertions": {
        "categories:performance":   ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices":["error", { "minScore": 0.90 }],
        "categories:seo":            ["error", { "minScore": 0.90 }]
      }
    }
  }
}
```

---

## Performance / Load Tests

### Library: k6

```bash
brew install k6
```

### Critical Tests

```javascript
// load/track-endpoint.js — 1000 events/sec sustained
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },   // ramp up
    { duration: '5m',  target: 1000 },  // sustained
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],   // P95 < 100ms
    http_req_failed: ['rate<0.01'],     // < 1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    event_type: 'page_view',
    url: 'https://example.com/products/123',
    session_id: `s_${__VU}_${__ITER}`,
    workspace_id: 'ws_test_load',
  });
  const res = http.post('https://staging.yourplatform.com/api/v1/analytics/track',
    payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': r => r.status === 200 });
}
```

### Other Load Targets

| Endpoint | Target |
|---|---|
| `/api/v1/analytics/track` | 1,000 req/sec, P95 < 100ms |
| `/api/v1/core/auth/login` | 100 req/sec, P95 < 500ms |
| `/api/v1/seo/keywords` (50k rows) | P95 < 500ms |
| `/api/v1/campaigns/one-click-capture` | 50 concurrent, complete < 120s each |
| Webhook delivery | 500 webhooks/sec sustained |

### Run Frequency

- Pre-release: full load suite
- Weekly: nightly cron of subset
- Pre-major-feature: targeted load test for that feature

---

## Visual Regression Tests

### Tool: Chromatic (Storybook-integrated)

- Every component story rendered in baseline
- PR generates new snapshots
- Visual diff shown in PR
- Designer approves intentional changes
- CI fails if unapproved visual change

### What Gets VRT

- All shared components in `components/ui/`
- Page-level layouts
- Email templates (visual diff against approved baselines)

---

## CI Pipeline

### `.github/workflows/ci.yml` (high-level)

```yaml
name: CI
on: [pull_request, push]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: yarn install --immutable
      - run: yarn lint
      - run: yarn type-check

  unit-and-integration:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:11
        env: { MARIADB_ROOT_PASSWORD: test }
      redis: { image: redis:7-alpine }
    steps:
      - uses: actions/checkout@v4
      - run: yarn install --immutable
      - run: yarn migrate:test
      - run: yarn test --coverage
      - uses: codecov/codecov-action@v4

  isolation-tests:
    runs-on: ubuntu-latest
    services: { mysql: { ... }, redis: { ... } }
    steps:
      - run: yarn test:isolation

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: snyk/actions/node@master
        env: { SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }} }
      - uses: gitleaks/gitleaks-action@v2

  e2e:
    runs-on: ubuntu-latest
    needs: [unit-and-integration]
    steps:
      - run: yarn build
      - run: yarn playwright install --with-deps
      - run: yarn e2e

  ai-eval:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: yarn ai:eval --report
      - uses: actions/upload-artifact@v4
        with: { name: ai-eval-report, path: eval-results/ }

  a11y:
    runs-on: ubuntu-latest
    steps:
      - run: yarn build
      - run: yarn lighthouse:ci

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: chromaui/action@v11
        with: { projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }} }
```

### Total CI Time Target

< 10 minutes from PR open to all checks green. Beyond this, dev velocity collapses.

---

## Coverage Targets

| Type | Target | Enforcement |
|---|---|---|
| Unit test coverage | 80% lines, 70% branches | CI fail if drops below |
| Integration test coverage | All API endpoints have at least one happy-path test | CI fail if new endpoint without test |
| Isolation tests | All endpoints with workspace_id parameter | Auto-generated from OpenAPI |
| E2E tests | All critical flows pass | CI fail on any |
| AI eval pass rate | 95% on test cases | Warn at 92%, fail at 90% |
| A11y violations | 0 critical, 0 serious on Lighthouse | CI fail on any |
| Bundle size | < 300KB initial JS | CI fail if exceeded |
| Lighthouse performance | > 85 | CI fail below |

### Mutation Testing (Phase 4)

- Run `stryker-mutator` weekly to find weak tests
- Tests should fail when production code is mutated
- High mutation score = high test quality
