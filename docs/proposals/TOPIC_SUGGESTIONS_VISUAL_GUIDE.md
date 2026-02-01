# Topic Suggestions Feature - Visual Guide

## Location in UI: QuickCreate Page

### File Path
```
apps/web/src/pages/QuickCreate.tsx
```

## 1. Button Implementation (Lines 207-218)

```tsx
<div className="flex items-center justify-between mb-2">
  <label className="block text-sm font-medium text-gray-300">Topic / Seed</label>
  <button
    type="button"
    onClick={handleSuggestTopics}
    disabled={isLoading || loadingSuggestions || !status?.providers.openai}
    className="text-sm px-3 py-1 rounded-lg transition-colors"
    style={{ background: 'var(--color-surface-2)', color: 'var(--color-primary)' }}
  >
    {loadingSuggestions ? 'Loading...' : 'Suggest viral topics'}
  </button>
</div>
```

**Visual Appearance:**
```
┌─────────────────────────────────────────────────────┐
│ Topic / Seed          [Suggest viral topics] button │
│ ┌─────────────────────────────────────────────────┐ │
│ │ e.g., 5 surprising facts about the deep ocean  │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 2. Suggestions Display (Lines 227-249)

When suggestions are loaded, they appear as clickable chips below the topic input:

```tsx
{suggestions && suggestions.length > 0 && (
  <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
      Pick a topic:
    </p>
    <div className="flex flex-wrap gap-2">
      {suggestions.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => {
            setFormData({ ...formData, topic: t });
            setSuggestions(null);
          }}
          className="text-left text-sm px-3 py-2 rounded-lg border transition-colors hover:border-[var(--color-primary)]"
        >
          {t.length > 50 ? `${t.slice(0, 50)}...` : t}
        </button>
      ))}
    </div>
  </div>
)}
```

**Visual Appearance After Clicking Button:**
```
┌─────────────────────────────────────────────────────────────┐
│ Topic / Seed          [Loading...] or [Suggest viral topics]│
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Pick a topic:                                                │
│ ┌──────────────────────┐ ┌──────────────────────┐         │
│ │ 5 mysteries of the   │ │ The truth about the  │         │
│ │ Bermuda Triangle     │ │ Titanic disaster     │  ...    │
│ └──────────────────────┘ └──────────────────────┘         │
│ ┌──────────────────────┐ ┌──────────────────────┐         │
│ │ Ancient civilizations│ │ Deep ocean creatures │  ...    │
│ └──────────────────────┘ └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 3. Handler Logic (Lines 178-190)

```typescript
const handleSuggestTopics = async () => {
  setError('');
  setLoadingSuggestions(true);
  setSuggestions(null);
  try {
    // Fetches suggestions filtered by currently selected niche pack
    const list = await getTopicSuggestions(formData.nichePackId, 10);
    setSuggestions(list);
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setLoadingSuggestions(false);
  }
};
```

## User Flow

### Step 1: Initial State
```
User sees the QuickCreate form with:
- Niche pack selector (Facts, Horror, Gaming, etc.)
- Topic input field
- "Suggest viral topics" button
```

### Step 2: Click Button
```
Button text changes to "Loading..."
Button becomes disabled
API request sent to /api/topic-suggestions?nichePackId=facts&limit=10
```

### Step 3: Suggestions Appear
```
10 AI-generated topic suggestions appear as clickable chips
Each chip shows a topic related to the selected niche pack
Chips have hover effects (border color changes)
```

### Step 4: Select Suggestion
```
User clicks a chip
Topic field is populated with the selected text
Suggestions disappear (cleared from state)
User can now submit the form or edit the topic
```

## Integration with Niche Packs

The feature **automatically filters** suggestions by the selected niche pack:

| Niche Pack | Example Suggestions |
|------------|---------------------|
| Facts | "5 surprising facts about the deep ocean", "The truth about..." |
| Horror | "5 terrifying urban legends", "The haunting story of..." |
| Gaming | "Top 5 gaming secrets nobody knows", "The evolution of..." |
| Story | "The incredible journey of...", "A tale of..." |
| Top5 | "Top 5 mysteries of ancient Egypt", "5 shocking discoveries..." |

## Error States

### OpenAI Not Configured
```
Button is disabled (no tooltip currently shown)
Topic suggestions are unavailable until OpenAI is configured
```

### Test Mode
```
API returns 403
Error message: "Topic suggestions disabled in APP_TEST_MODE"
```

### Network Error
```
Error displayed below form
Message: "Request failed" or specific error from API
Suggestions cleared
```

## Code Quality Checks

✅ TypeScript: No errors, fully typed
✅ ESLint: No warnings or errors  
✅ Follows existing patterns from codebase
✅ Uses existing UI components and styles
✅ Matches theme variables (--color-*)

## Verification Steps for Manual Testing

1. Navigate to `/create` (QuickCreate page, or `/` which redirects to `/create`)
2. Observe "Suggest viral topics" button next to "Topic / Seed" label
3. Click the button
4. Verify button shows "Loading..." temporarily
5. Verify suggestions appear as chips below topic field
6. Click a suggestion chip
7. Verify topic field is populated
8. Verify suggestions disappear after selection
9. Change niche pack and click button again
10. Verify suggestions reflect the new niche pack theme

## Files Modified/Created

- ✅ Backend: `apps/server/src/routes/topicSuggestions.ts` (already existed)
- ✅ Frontend: `apps/web/src/pages/QuickCreate.tsx` (already existed)
- ✅ API Client: `apps/web/src/api/client.ts` (already existed)
- ✅ E2E Test: `apps/web/tests/e2e/topic-suggestions.spec.ts` (newly created)
- ✅ Documentation: `TOPIC_SUGGESTIONS_IMPLEMENTATION.md` (same directory)
