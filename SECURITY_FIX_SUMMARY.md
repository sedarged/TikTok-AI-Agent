# Security Fix Summary: IDOR Vulnerability

**Date**: 2026-02-04  
**Severity**: Critical  
**Status**: ✅ FIXED

## Vulnerability Description

An Insecure Direct Object Reference (IDOR) vulnerability was discovered in the plan update endpoint (`PUT /api/plan/:planVersionId`). This allowed an authenticated user to modify scenes belonging to other plans by including their scene IDs in a plan update request.

### Attack Scenario

1. Attacker creates or accesses Project A with Plan A containing Scene X
2. Attacker obtains Scene ID from Project B's Plan B (Scene Y)
3. Attacker sends update request to Plan A including Scene Y's ID
4. **Before fix**: Scene Y gets modified even though it belongs to Plan B
5. **After fix**: Scene Y is silently skipped; only scenes belonging to Plan A are updated

## Technical Details

### Affected Endpoint
- `PUT /api/plan/:planVersionId`
- Lines 119-147 in `apps/server/src/routes/plan.ts`

### Root Cause
The endpoint did not verify that scenes being updated belonged to the plan being modified. It only checked:
- If the scene exists
- If the scene is locked

It did NOT check:
- If `scene.planVersionId === planVersionId`

### Fix Implementation

Added ownership validation before updating scenes:

```typescript
// Verify scene belongs to this plan (ownership check)
if (!existingScene || existingScene.planVersionId !== planVersionId) {
  // Skip scenes that don't belong to this plan
  continue;
}
```

This ensures:
- Only scenes with matching `planVersionId` are updated
- Foreign scene IDs are silently ignored
- Data integrity is maintained across plans

## Testing

### New Tests Created
Created comprehensive integration tests in `apps/server/tests/idor.integration.test.ts`:

1. ✅ `should allow updating scene via /api/scene/:sceneId`
2. ✅ `should allow locking scene via /api/scene/:sceneId/lock`
3. ✅ `should allow regenerating scene via /api/scene/:sceneId/regenerate`
4. ✅ `should prevent updating scenes from different plan via /api/plan/:planVersionId` (KEY TEST)
5. ✅ `should allow updating scenes that belong to the plan being updated`

### Test Results
```
✓ tests/idor.integration.test.ts (5 tests) 836ms
  ✓ IDOR vulnerability tests
    ✓ Scene update endpoint
      ✓ should allow updating scene via /api/scene/:sceneId 580ms
      ✓ should allow locking scene via /api/scene/:sceneId/lock 94ms
      ✓ should allow regenerating scene via /api/scene/:sceneId/regenerate 46ms
    ✓ Plan update endpoint with scene updates
      ✓ should prevent updating scenes from different plan 73ms
      ✓ should allow updating scenes that belong to the plan 43ms

✓ tests/api.integration.test.ts (8 tests) 899ms
  ✓ All existing tests pass

Total: 13/13 tests passing
```

### Security Validation
- ✅ CodeQL scan: 0 alerts
- ✅ ESLint: No issues
- ✅ Code review: Approved
- ✅ Manual verification: Completed

## Impact Assessment

### Before Fix
- ⚠️ Cross-plan scene modification possible
- ⚠️ Data integrity violations
- ⚠️ Potential for malicious content injection
- ⚠️ Lock bypass across plans

### After Fix
- ✅ Scenes can only be modified within their own plan
- ✅ Data integrity maintained
- ✅ No cross-plan interference
- ✅ Lock mechanisms properly enforced

## Deployment Notes

### Breaking Changes
None. This is a backward-compatible security fix.

### API Behavior Changes
- Requests that include scene IDs from other plans will no longer modify those scenes
- Foreign scene IDs are silently ignored (no error returned)
- Legitimate use cases continue to work as expected

### Rollout Recommendation
✅ Safe to deploy immediately. No migration required.

## Related Issues
- Issue: [BUG]: IDOR vulnerability: scene/plan endpoints allow arbitrary updates
- PR: #[number] - Fix IDOR vulnerability in scene/plan endpoints

## Verification Commands

```bash
# Run IDOR-specific tests
npm run test -- apps/server/tests/idor.integration.test.ts

# Run all integration tests
npm run test -- apps/server/tests/api.integration.test.ts apps/server/tests/idor.integration.test.ts

# Run security scan
npm run codeql
```

## Additional Security Considerations

While this fix addresses the specific IDOR vulnerability, consider these future enhancements:

1. **Multi-tenancy**: Add user model and proper authentication/authorization
2. **Audit logging**: Track all scene modifications with user context
3. **Rate limiting**: Add endpoint rate limiting to prevent abuse
4. **Input validation**: Consider returning 403 Forbidden instead of silently skipping
5. **API versioning**: Consider explicit v2 API with stricter validation

## Sign-off

- ✅ Security fix implemented
- ✅ Tests passing
- ✅ No regressions
- ✅ Documentation updated
- ✅ Ready for production deployment
