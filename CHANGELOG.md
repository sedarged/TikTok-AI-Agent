# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
