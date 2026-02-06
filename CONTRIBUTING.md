# Contributing to TikTok-AI-Agent

First off, thank you for considering contributing to TikTok-AI-Agent! It's people like you that make this project better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Message Conventions](#commit-message-conventions)
- [Project Structure](#project-structure)
- [Need Help?](#need-help)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- **Node.js**: v20.19.0 or v22.12.0+ (see [.node-version](.node-version))
- **npm**: v8+ (comes with Node.js)
- **FFmpeg**: Required for video rendering
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **OpenAI API Key**: Required for AI features (get one at [platform.openai.com](https://platform.openai.com))

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
   cd TikTok-AI-Agent
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. **Run Database Migrations**
   ```bash
   npm run db:migrate:dev
   ```

5. **Start Development Servers**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

6. **Verify Installation**
   ```bash
   npm run check  # Runs lint + typecheck
   npm run test   # Runs unit and integration tests
   ```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features (if exists)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring

### Making Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style and patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run lint          # Check code style
   npm run typecheck     # Check TypeScript
   npm run test          # Run unit tests
   npm run test:e2e      # Run E2E tests (optional)
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
   See [Commit Message Conventions](#commit-message-conventions) below.

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template with details

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm run test` and `npm run test:e2e`)
- [ ] Code passes linting (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Documentation updated (if applicable)
- [ ] No secrets or API keys committed
- [ ] PR title follows commit conventions

### PR Requirements

1. **Title Format**: Follow [Conventional Commits](https://www.conventionalcommits.org/)
   - `feat: add topic suggestion caching`
   - `fix: resolve memory leak in render pipeline`
   - `docs: update API reference`

2. **Description**: Include:
   - What problem does this solve?
   - How does it solve it?
   - Any breaking changes?
   - Screenshots (for UI changes)
   - Related issue numbers

3. **Code Review**: At least one maintainer must approve

4. **CI Checks**: All GitHub Actions must pass
   - Lint and typecheck
   - Backend tests
   - Render pipeline tests
   - E2E tests (if applicable)

### After PR is Merged

- Delete your feature branch
- Pull latest changes from main
- Close related issues (if any)

## Coding Standards

### TypeScript

- **Strict Mode**: Always enabled
- **No `any`**: Use proper types or `unknown`
- **Interfaces over Types**: For object shapes
- **Explicit Return Types**: For public functions

```typescript
// ✅ Good
export function calculateCost(scenes: Scene[]): number {
  return scenes.reduce((sum, scene) => sum + scene.cost, 0);
}

// ❌ Bad
export function calculateCost(scenes: any) {
  return scenes.reduce((sum, scene) => sum + scene.cost, 0);
}
```

### Code Style

- **ESLint**: Configuration in `eslint.config.mjs`
- **Prettier**: Configuration in `.prettierrc`
- **Line Length**: Max 100 characters (enforced by Prettier)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes (enforced by Prettier)
- **Semicolons**: Required (enforced by Prettier)

### File Organization

```typescript
// 1. External imports
import express from 'express';
import { z } from 'zod';

// 2. Internal imports (absolute paths)
import { prisma } from '../db/client.js';
import { logInfo } from '../utils/logger.js';

// 3. Type definitions
interface MyType {
  // ...
}

// 4. Constants
const MAX_RETRIES = 3;

// 5. Functions
export function myFunction() {
  // ...
}
```

### Naming Conventions

- **Files**: `camelCase.ts` for utilities, `PascalCase.tsx` for React components
- **Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Functions**: `camelCase`
- **React Components**: `PascalCase`

### Error Handling

```typescript
// ✅ Always use try-catch for JSON.parse
let data = {};
try {
  data = JSON.parse(jsonString);
} catch (error) {
  logError('Failed to parse JSON:', error);
  data = {}; // Provide sensible default
}

// ✅ Use Zod for input validation
const schema = z.object({
  topic: z.string().min(1).max(500),
  nichePackId: z.string().min(1),
});

const result = schema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({
    error: 'Invalid input',
    details: result.error.flatten(),
  });
}
```

### Logging

```typescript
import { logInfo, logError, logWarn, logDebug } from '../utils/logger.js';

// ✅ Use structured logging
logInfo('Starting render', { runId, projectId });
logError('Render failed', { error, runId });

// ❌ Don't use console.log
console.log('Starting render');
```

## Testing Requirements

### Unit Tests

- **Framework**: Vitest
- **Location**: `apps/server/tests/*.unit.test.ts`
- **Coverage**: Aim for 80%+ on new code
- **Naming**: `*.unit.test.ts` for unit tests

```typescript
import { describe, it, expect } from 'vitest';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Tests

- **Framework**: Vitest + Supertest
- **Location**: `apps/server/tests/*.integration.test.ts`
- **Purpose**: Test API endpoints and database interactions

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

describe('GET /api/health', () => {
  it('should return 200 OK', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
```

### E2E Tests

- **Framework**: Playwright
- **Location**: `apps/web/tests/e2e/*.spec.ts`
- **Purpose**: Test user workflows in browser

### Running Tests

```bash
# Unit + Integration tests
npm run test

# Unit tests only (with verbose output)
npm run test:only

# Render pipeline tests (dry-run mode)
npm run test:render

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage --workspace=apps/server
```

### Test Requirements for PRs

- All new features must include tests
- Bug fixes should include regression tests
- Tests must pass in CI before merge
- Maintain or improve code coverage

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring (no functionality change)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI configuration changes
- `chore`: Other changes (tooling, etc.)

### Examples

```bash
# Feature
git commit -m "feat(render): add scene transition effects"

# Bug fix
git commit -m "fix(api): resolve memory leak in SSE connections"

# Documentation
git commit -m "docs: update API reference with new endpoints"

# Breaking change
git commit -m "feat(api)!: change response format for /api/projects"
```

### Scope (Optional)

Common scopes in this project:
- `api` - Backend API
- `render` - Render pipeline
- `plan` - Plan generation
- `ui` - Frontend components
- `db` - Database/Prisma
- `ci` - CI/CD
- `deps` - Dependencies

## Issue Templates

We provide structured issue templates to ensure all necessary information is captured:

### Bug Reports
Use the bug report template for any defects or unexpected behavior. Include:
- **Severity level** - Critical/High/Medium/Low
- **Steps to reproduce** - Clear, numbered steps
- **Expected vs actual behavior**
- **Environment** - Development/Production/Test
- **Version or commit SHA**
- **Relevant logs or error messages**

### Tasks/Features
Use the task template for new features or improvements:
- **Priority** - P0 (Critical), P1 (High), P2 (Medium)
- **Description** - What needs to be done
- **Acceptance criteria** - Definition of done
- **Additional context** - Links, references, notes

## Automated Workflows

### Release Automation
This project uses [Release Please](https://github.com/googleapis/release-please) to automate versioning and changelog generation based on conventional commits.

**Commit message format:**
- `feat:` triggers a minor version bump (e.g., 1.0.0 → 1.1.0)
- `fix:` triggers a patch version bump (e.g., 1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` triggers a major version bump (e.g., 1.0.0 → 2.0.0)

When merged to `main`, Release Please will:
1. Create/update a release PR with changelog
2. On release PR merge, create a GitHub release
3. Build and attach release artifacts

### Dependency Updates
[Dependabot](https://docs.github.com/en/code-security/dependabot) automatically:
- Checks for dependency updates weekly (Mondays at 9 AM)
- Groups related updates (dev dependencies, testing tools, etc.)
- Creates PRs with changelogs
- Monitors GitHub Actions versions monthly

PRs are labeled with:
- `dependencies` - All dependency updates
- `component:backend` or `component:frontend` - Workspace-specific
- `ci/cd` - GitHub Actions updates

### PR Automation
Pull requests are automatically enhanced with:

**Auto-labeling** based on changed files:
- `component:frontend` - Changes in `apps/web/`
- `component:backend` - Changes in `apps/server/`
- `component:database` - Changes in `prisma/`
- `documentation` - Changes to `.md` files
- `testing` - Changes to `.test.` or `.spec.` files
- `ci/cd` - Changes to `.github/workflows/`

**Size labels** based on total changes:
- `size/xs` - < 10 lines
- `size/s` - 10-99 lines
- `size/m` - 100-499 lines
- `size/l` - 500-999 lines
- `size/xl` - 1000+ lines (triggers warning)

**Quality checks:**
- Warns on PRs with 500+ changed lines
- Reminds about issue linking (Closes #123)
- Suggests test coverage when code changes without test changes

## Project Structure

```
TikTok-AI-Agent/
├── apps/
│   ├── server/           # Backend application
│   │   ├── src/
│   │   │   ├── index.ts        # Express app entry
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── services/       # Business logic
│   │   │   ├── db/             # Database client
│   │   │   └── utils/          # Utilities
│   │   ├── prisma/             # Database schema
│   │   └── tests/              # Backend tests
│   │
│   └── web/              # Frontend application
│       ├── src/
│       │   ├── pages/          # Route pages
│       │   ├── components/     # React components
│       │   └── api/            # API client
│       └── tests/              # Frontend tests
│
├── docs/                 # Documentation
├── .github/              # GitHub Actions workflows
├── .cursor/              # Cursor AI configuration
└── scripts/              # Utility scripts
```

### Key Files

- `package.json` - Root package config (monorepo)
- `eslint.config.mjs` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `playwright.config.mjs` - E2E test configuration
- `.env.example` - Environment variable template
- `Dockerfile` - Production Docker build
- `docker-compose.yml` - Local Docker setup

## Need Help?

- **Questions**: Open a [Discussion](https://github.com/sedarged/TikTok-AI-Agent/discussions)
- **Bugs**: Open an [Issue](https://github.com/sedarged/TikTok-AI-Agent/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Support**: See [SUPPORT.md](SUPPORT.md)

## Additional Resources

- [Architecture Documentation](docs/architecture.md)
- [API Reference](docs/api.md)
- [Testing Guide](docs/testing.md)
- [Project Status](STATUS.md) - Current priorities and active work
- [Cursor AI Guidelines](AGENTS.md)

---

Thank you for contributing! 🎉
