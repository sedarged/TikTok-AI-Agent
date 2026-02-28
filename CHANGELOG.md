# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/sedarged/TikTok-AI-Agent/compare/v1.1.1...v1.2.0) (2026-02-28)


### Features

* add comprehensive XML escaping tests and improve documentation ([d00c8ee](https://github.com/sedarged/TikTok-AI-Agent/commit/d00c8ee3609a9898100600744febcc2e0418cb6e))
* full frontend E2E screenshot tour — all 8 routes verified + deep audit (0 vulnerabilities) ([abcd552](https://github.com/sedarged/TikTok-AI-Agent/commit/abcd5529ec8628d38675734a1c61e43a6b11b937))


### Bug Fixes

* add rollup &gt;=4.59.0 override to resolve CVE GHSA-mw96-cpmx-2vgc (0 vulnerabilities) ([8902fdd](https://github.com/sedarged/TikTok-AI-Agent/commit/8902fdde93f0e0ab61db2481e1a4e445aa9ae05d))
* deep audit — lint, types, tests, security, deps, render queue ([c222987](https://github.com/sedarged/TikTok-AI-Agent/commit/c22298743e2f1c28c10217c9ea919e1a15001a6e))
* deep audit — lint, types, tests, security, deps, render queue ([69c2a3f](https://github.com/sedarged/TikTok-AI-Agent/commit/69c2a3f96f72251b6b647d5186166a9418e4a94e))
* merge main into branch to resolve PR conflicts ([a9c72c1](https://github.com/sedarged/TikTok-AI-Agent/commit/a9c72c1a13e96a0437fe40eb08dcebd5285af0e9))
* remove rollup from dependencies (overrides-only — code review fix) ([18d8582](https://github.com/sedarged/TikTok-AI-Agent/commit/18d8582b76a48d40994a1b15175dc5e6dfc83543))
* resolve merge conflict between PR [#187](https://github.com/sedarged/TikTok-AI-Agent/issues/187) and main ([003d52c](https://github.com/sedarged/TikTok-AI-Agent/commit/003d52c6b105dcd5ef06eae385ad91843f963dc4))
* review pass — unhandled rejections, retry logic, rate limit, SSE logging ([e53077f](https://github.com/sedarged/TikTok-AI-Agent/commit/e53077f06300b69f3688e665533183a65c5fb0fd))
* XML escaping, hashtag type safety, and queue mutex for processNextInQueue ([001077f](https://github.com/sedarged/TikTok-AI-Agent/commit/001077fe6f41c3a2462edf3f99cebff13ead8f36))
* XML escaping, hashtag type safety, and queue mutex for processNextInQueue ([bf5b95e](https://github.com/sedarged/TikTok-AI-Agent/commit/bf5b95e852603ab44bbcfc00300bb7396aba9768))
* XML escaping, hashtag type validation, queue mutex ([7365bfc](https://github.com/sedarged/TikTok-AI-Agent/commit/7365bfcb74e4e4ec84d3415bae0f03e450881c74))
* XML escaping, hashtag type validation, queue race condition ([805e439](https://github.com/sedarged/TikTok-AI-Agent/commit/805e43907ce511b32d1e9cd6681ca898411c6f16))

## [1.1.1](https://github.com/sedarged/TikTok-AI-Agent/compare/v1.1.0...v1.1.1) (2026-02-04)


### Bug Fixes

* Add UUID and positive duration validation to scene update schema ([9690057](https://github.com/sedarged/TikTok-AI-Agent/commit/96900578eab48d820e51b437593a0240290c7949))

## [1.1.0](https://github.com/sedarged/TikTok-AI-Agent/compare/v1.0.0...v1.1.0) (2026-02-04)


### Features

* implement caching for topic suggestions endpoint ([aafcbe0](https://github.com/sedarged/TikTok-AI-Agent/commit/aafcbe01da9e0ca4f573db9c61ba0ac87bbb9510))


### Bug Fixes

* address code review feedback ([c7ac0fc](https://github.com/sedarged/TikTok-AI-Agent/commit/c7ac0fc3b95cd01a7c5a82ec90ac569486c7bb9a))

## 1.0.0 (2026-02-01)


### Features

* Add database logging and CHANGELOG ([3abdfc4](https://github.com/sedarged/TikTok-AI-Agent/commit/3abdfc49eeb26337c07f0621df4410a52c2e1fff))
* Add GitHub Codespaces configuration for mobile testing ([f5ab25d](https://github.com/sedarged/TikTok-AI-Agent/commit/f5ab25dfce0d4226f85ead50e92f6d0a80d66b16))
* Add Railway/Render deployment configuration ([a793eab](https://github.com/sedarged/TikTok-AI-Agent/commit/a793eab2f75cae7d4b920d3c6f1d59e99e05c465))
* **ci:** add development automation improvements ([f7b3239](https://github.com/sedarged/TikTok-AI-Agent/commit/f7b323954eba6d2c5cdb43cc67d15c4edfca88f2))
* Complete TikTok AI video generator app ([0489001](https://github.com/sedarged/TikTok-AI-Agent/commit/0489001b8070ba7fbf09ba2f9e0023d7f8e3b190))
* Enable network access for mobile testing ([c72e65c](https://github.com/sedarged/TikTok-AI-Agent/commit/c72e65c1e33b74ae998bcf6b75967ffe0460832b))
* **PR1:** Add automation + STATUS SSOT system ([4738cd4](https://github.com/sedarged/TikTok-AI-Agent/commit/4738cd411356128da95e2fbb7976806dd65e4339))
* **PR2:** Add AI docs structure and reduce duplication ([1b61bda](https://github.com/sedarged/TikTok-AI-Agent/commit/1b61bdaeb4884b553358a8f0909528021367653d))
* **PR3:** Move cost and proposal docs with migration log ([f0e3e65](https://github.com/sedarged/TikTok-AI-Agent/commit/f0e3e65ed57418a538b5d14f2740dafff54e538c))
* **PR4:** Clean up old docs after migration verification ([5f361fc](https://github.com/sedarged/TikTok-AI-Agent/commit/5f361fcad9935692dd80b4dbf0c94d77060f17da))


### Bug Fixes

* Add JSON.parse protection and rate limiting ([d74541a](https://github.com/sedarged/TikTok-AI-Agent/commit/d74541adb517b4ace188e1e15f3a6e5aad82ce68))
* Add Procfile for Railway deployment ([a3bde29](https://github.com/sedarged/TikTok-AI-Agent/commit/a3bde2951902f7fd62713f3a24eece6a10cd506f))
* Add railway.toml and node version files ([701fc77](https://github.com/sedarged/TikTok-AI-Agent/commit/701fc771157228833d53dc410df6516a3dc1d197))
* Address code review feedback ([fbbe69d](https://github.com/sedarged/TikTok-AI-Agent/commit/fbbe69dabe6f54e75e9087fb6cd913a4640475a0))
* **ci:** address PR review feedback for automation workflows ([9991600](https://github.com/sedarged/TikTok-AI-Agent/commit/9991600cfd4606a4bb7a10b049e29ab6805c718e))
* correct relative path to STATUS.md in always-project-standards.mdc ([2593914](https://github.com/sedarged/TikTok-AI-Agent/commit/25939148a8693af5311e5425f57efba047f4a1a7))
* Improve env file path resolution ([208daf5](https://github.com/sedarged/TikTok-AI-Agent/commit/208daf5411997ee250b7a7d7fbdc52d90175bfe0))
* Remove incorrect fallback logic in channelPresets.ts ([57fcad9](https://github.com/sedarged/TikTok-AI-Agent/commit/57fcad9b07118269de164dce0570bf8ccc132825))

## [Unreleased]

### Added
- **Comprehensive Documentation Suite (Issue #139)**
  - `docs/REPO_REALITY.md` - Evidence-based repository reality check with 500+ lines of verified tech stack, structure, scripts, env vars, CI/CD, and external services (all claims backed by file paths)
  - `ARCHITECTURE.md` at root - High-level system architecture with component diagrams, data flows, database schema, design patterns, deployment architecture, performance/security considerations (463 lines)
  - `RUNBOOK.md` at root - Operations runbook for dev/prod workflows, health checks, logs, common failures with recovery steps, test modes, production checklist (398 lines)
  - Updated `docs/README.md` to include REPO_REALITY.md as first entry under Getting Started section
  - Enhanced `.env.example` with LOG_LEVEL variable documentation
- Parallel image generation for scene pipeline
  - Images are now generated concurrently (default: 3 concurrent requests) using p-limit
  - Configurable concurrency via `MAX_CONCURRENT_IMAGE_GENERATION` environment variable
  - Reduces end-to-end render time for multi-scene projects
  - Maintains all existing features: caching, dry-run mode, cancellation, error handling
- Comprehensive documentation suite
  - LICENSE file (MIT License)
  - CONTRIBUTING.md with contribution guidelines
  - CODE_OF_CONDUCT.md (Contributor Covenant v2.1)
  - SUPPORT.md for getting help and reporting issues
  - Complete /docs folder with 12+ detailed documentation pages
  - Architecture Decision Records (ADR) in docs/adr/
  - API reference documentation
  - Data model and database schema documentation
  - Operations runbook for production deployment

### Changed
- Cleaned up repository by removing 19 obsolete files (3,738+ lines)
  - Removed 9 outdated planning documents from `.cursor/plans/`
  - Removed 4 archived audit documents
  - Removed 6 unused setup scripts
- Updated DOCUMENTATION_INDEX.md to reflect current documentation structure
- Fixed broken documentation references in multiple files
- Enhanced README.md with complete developer onboarding

### Security
- **[CRITICAL]** Wrapped all `JSON.parse()` calls in try-catch blocks to prevent server crashes on malformed JSON
  - Fixed in `topicSuggestions.ts`, `planGenerator.ts`, and other service files
  - Added proper error handling and logging for JSON parsing failures
- **[HIGH]** Added rate limiting middleware to protect API endpoints
  - Configured with `express-rate-limit`: 100 requests per 15 minutes in production, 1000 in development
  - Automatically skipped in test mode
- **[MEDIUM]** Enabled Content Security Policy (CSP) in production via Helmet
  - Disabled in development/test for local testing flexibility
  - Configured with secure defaults for scripts, styles, images, and connections
- **[LOW]** Improved input validation
  - POST `/api/run/:runId/retry` already had Zod validation (verified)
  - All endpoints now consistently use `safeParse()` with proper error responses

### Changed
- **[BREAKING]** Replaced all `console.log`, `console.error`, and `console.warn` calls with structured Winston logger
  - New logger utility at `apps/server/src/utils/logger.ts`
  - Supports JSON logging in production, colorized output in development
  - Silent in test mode (except errors) to reduce noise
  - Includes helper functions: `logInfo()`, `logError()`, `logWarn()`, `logDebug()`
- Removed `any` types from codebase
  - Replaced `pack: any` with proper `NichePack` type in `planGenerator.ts`
  - Improved type safety throughout the application
- Enhanced error handling in empty catch blocks
  - All previously silent catch blocks now log debug information
  - Better observability for debugging issues in production

### Added
- Database query logging in development mode
  - Prisma client now logs queries, errors, and warnings in development
  - Only errors logged in test and errors+warnings in production to reduce noise
- Express rate limiting dependency (`express-rate-limit@^8.2.1`)
- Winston logging dependency (`winston@^3.x`)

### Fixed
- Unused import linting errors across multiple files
- TypeScript strict mode compliance issues
- Path traversal security check logging (already present, now uses structured logger)

### Developer Experience
- All tests passing with new logging infrastructure
- TypeScript compilation clean with no errors
- ESLint passing with no violations
- Better error context in logs for debugging

## [1.0.0] - 2026-01-29

### Added
- Initial release of TikTok AI Video Generator
- Full-stack application with React frontend and Express backend
- OpenAI integration for plan generation, TTS, and image generation
- FFmpeg-based video rendering pipeline
- 12 niche packs (horror, facts, motivation, etc.)
- Real-time progress streaming via Server-Sent Events
- Prisma database with SQLite (production-ready for PostgreSQL)
- Comprehensive test suite (unit, integration, E2E)

[Unreleased]: https://github.com/sedarged/TikTok-AI-Agent/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sedarged/TikTok-AI-Agent/releases/tag/v1.0.0
