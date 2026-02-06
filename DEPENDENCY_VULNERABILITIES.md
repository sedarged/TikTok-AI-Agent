# Dependency Vulnerabilities - Fixed

**Date:** 2026-02-06  
**Fixed by:** npm overrides in root package.json

## Overview

This document tracks dependency vulnerabilities identified by `npm audit` and their resolution. All 8 moderate severity vulnerabilities have been addressed using npm overrides to force vulnerable transitive dependencies to safe versions.

## Vulnerabilities Fixed

### 1. Hono XSS through ErrorBoundary Component
- **CVE/Advisory:** GHSA-9r54-q6cx-xmh5
- **Severity:** Moderate (CVSS 4.7)
- **Affected Version:** hono ≤4.11.6
- **Fixed Version:** 4.11.7
- **Vector:** `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N`
- **Description:** XSS vulnerability in ErrorBoundary component
- **Package Path:** `prisma → @prisma/dev → hono`

### 2. Hono Cache Middleware Web Cache Deception
- **CVE/Advisory:** GHSA-6wqw-2p9w-4vw4
- **Severity:** Moderate (CVSS 5.3)
- **Affected Version:** hono <4.11.7
- **Fixed Version:** 4.11.7
- **Vector:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **CWE:** CWE-524, CWE-613
- **Description:** Cache middleware ignores "Cache-Control: private" leading to Web Cache Deception
- **Package Path:** `prisma → @prisma/dev → hono`

### 3. Hono IPv4 Address Validation Bypass
- **CVE/Advisory:** GHSA-r354-f388-2fhh
- **Severity:** Moderate (CVSS 4.8)
- **Affected Version:** hono <4.11.7
- **Fixed Version:** 4.11.7
- **Vector:** `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N`
- **CWE:** CWE-185
- **Description:** IPv4 address validation bypass in IP Restriction Middleware allows IP spoofing
- **Package Path:** `prisma → @prisma/dev → hono`

### 4. Hono Arbitrary Key Read in Serve Static Middleware
- **CVE/Advisory:** GHSA-w332-q679-j88p
- **Severity:** Moderate (CVSS 5.3)
- **Affected Version:** hono <4.11.7
- **Fixed Version:** 4.11.7
- **Vector:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **CWE:** CWE-200, CWE-284, CWE-668
- **Description:** Arbitrary key read in Serve static Middleware (Cloudflare Workers Adapter)
- **Package Path:** `prisma → @prisma/dev → hono`

### 5. Lodash Prototype Pollution
- **CVE/Advisory:** GHSA-xxjr-mmjv-4gpg
- **Severity:** Moderate (CVSS 6.5)
- **Affected Version:** lodash 4.0.0 - 4.17.21
- **Fixed Version:** N/A (chevrotain 11.1.1 switched from lodash to lodash-es 4.17.23)
- **Vector:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`
- **CWE:** CWE-1321
- **Description:** Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions
- **Package Path:** `prisma → @prisma/dev → @mrleebo/prisma-ast → chevrotain → lodash`

### 6-8. Chevrotain and Sub-packages (lodash dependency)
- **Affected Packages:** 
  - `chevrotain` 10.0.0 - 10.5.0
  - `@chevrotain/cst-dts-gen` 10.0.0 - 10.5.0
  - `@chevrotain/gast` ≤10.5.0
- **Fixed Version:** chevrotain 11.1.1 (switched from lodash to lodash-es)
- **Package Path:** `prisma → @prisma/dev → @mrleebo/prisma-ast → chevrotain`
- **Description:** These packages depended on vulnerable lodash version

## Resolution Strategy

Since these vulnerabilities exist in transitive dev dependencies of Prisma (not runtime dependencies), we used npm's `overrides` feature to force the affected packages to safe versions:

```json
"overrides": {
  "hono": "^4.11.7",
  "lodash": "^4.17.23",
  "chevrotain": "^11.1.1"
}
```

**Note:** The `lodash` override is not strictly necessary since chevrotain 11.1.1 switched to `lodash-es` instead of `lodash`. However, it's included as a safeguard in case any other dependency still uses the vulnerable lodash version.

### Why Not Direct Upgrades?

1. These packages are not direct dependencies of our application
2. They're bundled with `@prisma/dev` which is used by Prisma CLI for development tools
3. Prisma 7.3.0 is the latest stable version
4. Using overrides is the recommended approach for transitive dependency vulnerabilities

## Impact Assessment

### Runtime Impact: None
These vulnerabilities are in **development-only dependencies** used by Prisma's CLI tools:
- `hono`: Used by Prisma Studio's dev server
- `chevrotain`/`lodash`: Used by Prisma's schema parser

These packages are **not included** in the production build or runtime.

### Build/Development Impact: Minimal
- All tests pass after upgrade
- TypeScript compilation succeeds
- Linting completes without errors
- Prisma generate/migrate work correctly
- No breaking changes observed

## Verification

```bash
# Before fix
npm audit
# 8 moderate severity vulnerabilities

# After fix
npm audit
# found 0 vulnerabilities
```

## Testing Performed

- ✅ `npm run typecheck` - All types valid
- ✅ `npm run build` - Build succeeds
- ✅ `npm run lint` - No new lint errors
- ✅ `npm run test` - All 85 tests pass
- ✅ `npm audit` - 0 vulnerabilities

## Maintenance Notes

### Future Considerations

1. **Monitor Prisma Updates**: When upgrading Prisma, check if they've updated these dependencies
2. **Review Overrides Periodically**: Remove overrides when Prisma updates bundled dependencies
3. **Check for New Vulnerabilities**: Run `npm audit` regularly as part of CI/CD
4. **Keep Overrides Minimal**: Only override packages with known vulnerabilities

### When to Remove Overrides

These overrides can be removed when:
- Prisma updates `@prisma/dev` to include these fixes
- Prisma removes the affected dependencies entirely
- We upgrade to a newer Prisma major version that resolves these

### Monitoring

Add to regular maintenance checklist:
```bash
# Run monthly or before releases
npm audit
npm outdated
```

## References

- **GitHub Advisory Database**: https://github.com/advisories
- **npm Overrides Documentation**: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides
- **Prisma Issue Tracker**: https://github.com/prisma/prisma/issues

## Change Log

- **2026-02-06**: Fixed all 8 moderate vulnerabilities using npm overrides
  - hono: 4.11.4 → 4.11.7
  - lodash: eliminated (chevrotain 11.1.1 doesn't use it)
  - chevrotain: 10.5.0 → 11.1.1
