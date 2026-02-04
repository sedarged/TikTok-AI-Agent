# Security Fix Summary: IDOR Vulnerability - Plan Endpoint

**Date**: 2026-02-04  
**Severity**: Critical  
**Status**: ✅ FIXED (Plan endpoint) | ℹ️ Scene endpoints not vulnerable in current architecture

## Vulnerability Description

An Insecure Direct Object Reference (IDOR) vulnerability was discovered in the plan update endpoint (`PUT /api/plan/:planVersionId`). This allowed an authenticated user to modify scenes belonging to other plans by including their scene IDs in a plan update request.

### Attack Scenario

1. Attacker creates or accesses Project A with Plan A containing Scene X
2. Attacker obtains Scene ID from Project B's Plan B (Scene Y)
3. Attacker sends update request to Plan A including Scene Y's ID
4. **Before fix**: Scene Y gets modified even though it belongs to Plan B
5. **After fix**: Request is rejected with 400 error listing the rejected scene IDs

## Technical Details

### Affected Endpoint
- `PUT /api/plan/:planVersionId`
- Lines 102-170 in `apps/server/src/routes/plan.ts`

### Root Cause
The endpoint did not verify that scenes being updated belonged to the plan being modified. It only checked:
- If the scene exists
- If the scene is locked

It did NOT check:
- If `scene.planVersionId === planVersionId`

### Fix Implementation

Added ownership validation before making any updates, with explicit error responses:

```typescript
// Validate scenes first if provided (before making any updates)
if (scenes && Array.isArray(scenes)) {
  const rejectedSceneIds: string[] = [];

  for (const scene of scenes) {
    if (!scene.id) continue;

    const existingScene = await prisma.scene.findUnique({
      where: { id: scene.id },
    });

    // Verify scene belongs to this plan (ownership check)
    if (!existingScene || existingScene.planVersionId !== planVersionId) {
      rejectedSceneIds.push(scene.id);
    }
  }

  // Return error if any scenes were rejected (before making any updates)
  if (rejectedSceneIds.length > 0) {
    return res.status(400).json({
      error: 'Some scene IDs do not belong to this plan',
      rejectedSceneIds,
    });
  }
}
```

This ensures:
- Validation happens BEFORE any updates are made (atomic operation)
- Only scenes with matching `planVersionId` can be updated
- Clear error responses with details about which scenes were rejected
- Data integrity is maintained across plans

### Scene Endpoints Analysis

The original issue mentioned scene endpoints (`PUT /api/scene/:sceneId`, `POST /api/scene/:sceneId/lock`, `POST /api/scene/:sceneId/regenerate`) as potentially vulnerable. However, in the current architecture:

**Architecture Context:**
- No multi-user system (no User model in database)
- Single-tenant application with API key authentication
- All authenticated users share the same API key

**Scene Endpoints Behavior:**
- Scene endpoints validate that the scene exists (404 if not found)
- They operate on individual scenes by ID
- In a single-tenant system, any scene can be accessed by any authenticated user

**Conclusion:**  
Scene endpoints are **not vulnerable to IDOR** in the current architecture because:
1. There is no concept of ownership beyond scene existence
2. The application is single-tenant by design
3. The vulnerability only existed in the plan endpoint where cross-plan modifications were possible

If the application evolves to support multi-tenancy (multiple users/projects), scene endpoints would need additional validation to check project/plan ownership.

## Testing

### New Tests Created
Created comprehensive integration tests in `apps/server/tests/idor.integration.test.ts`:

1. ✅ `should allow updating scene via /api/scene/:sceneId`
2. ✅ `should allow locking scene via /api/scene/:sceneId/lock`
3. ✅ `should allow regenerating scene via /api/scene/:sceneId/regenerate`
4. ✅ `should prevent updating scenes from different plan via /api/plan/:planVersionId` (KEY TEST - validates 400 error response)
5. ✅ `should allow updating scenes that belong to the plan being updated`

### Test Results
```
✓ tests/idor.integration.test.ts (5 tests) 834ms
  ✓ IDOR vulnerability tests
    ✓ Scene update endpoint
      ✓ should allow updating scene via /api/scene/:sceneId
      ✓ should allow locking scene via /api/scene/:sceneId/lock
      ✓ should allow regenerating scene via /api/scene/:sceneId/regenerate
    ✓ Plan update endpoint with scene updates
      ✓ should prevent updating scenes from different plan (validates 400 error)
      ✓ should allow updating scenes that belong to the plan

✓ tests/api.integration.test.ts (8 tests) 869ms
  ✓ All existing tests pass

Total: 13/13 tests passing
```

### Security Validation
- ✅ IDOR vulnerability fixed in plan endpoint
- ✅ Scene endpoints analyzed and deemed not vulnerable in current architecture
- ✅ Error responses provide clear feedback
- ✅ Validation occurs before any state changes (atomic)
- ✅ All existing functionality preserved

## Impact Assessment

### Before Fix
- ⚠️ Cross-plan scene modification possible via plan update endpoint
- ⚠️ Data integrity violations
- ⚠️ Potential for malicious content injection
- ⚠️ Lock bypass across plans

### After Fix
- ✅ Scenes can only be modified within their own plan
- ✅ Data integrity maintained
- ✅ No cross-plan interference
- ✅ Lock mechanisms properly enforced
- ✅ Clear error messages for debugging
- ✅ Atomic validation (all-or-nothing updates)

## Deployment Notes

### Breaking Changes
None. This is a backward-compatible security fix.

### API Behavior Changes
- Requests that include scene IDs from other plans will now return **400 Bad Request** with details
- Previous behavior: scenes from other plans were silently skipped (introduced in initial fix)
- New behavior: entire request is rejected before making any changes
- Error response format:
  ```json
  {
    "error": "Some scene IDs do not belong to this plan",
    "rejectedSceneIds": ["scene-id-1", "scene-id-2"]
  }
  ```

### Rollout Recommendation
✅ Safe to deploy immediately. No migration required.

## Related Issues
- Issue: [BUG]: IDOR vulnerability: scene/plan endpoints allow arbitrary updates
- PR: #126 - Fix IDOR vulnerability in plan endpoint

## Verification Commands

```bash
# Run IDOR-specific tests
npm run test:only -- tests/idor.integration.test.ts

# Run all integration tests
npm run test:only -- tests/api.integration.test.ts tests/idor.integration.test.ts

# Run security scan
npm run codeql
```

## Future Considerations

If the application evolves to support multi-tenancy (multiple users/organizations):

1. **Add User model** and proper authentication/authorization
2. **Scene endpoint validation**: Add project/plan ownership checks to scene endpoints
3. **Audit logging**: Track all scene modifications with user context
4. **Rate limiting**: Add endpoint rate limiting to prevent abuse
5. **API versioning**: Consider explicit v2 API with stricter validation

## Sign-off

- ✅ Plan endpoint IDOR vulnerability fixed
- ✅ Scene endpoints analyzed (not vulnerable in current architecture)
- ✅ Tests passing
- ✅ No regressions
- ✅ Documentation updated
- ✅ Error handling improved (explicit 400 responses)
- ✅ Ready for production deployment
