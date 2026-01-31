# Topic Suggestions Feature - Implementation Documentation

## Overview
The topic suggestions feature is **fully implemented** in both backend and frontend. This document provides evidence and details of the implementation.

## Backend Implementation

### Endpoint
- **URL**: `GET /api/topic-suggestions`
- **File**: `apps/server/src/routes/topicSuggestions.ts`
- **Registered**: `apps/server/src/index.ts` (line 145)

### Query Parameters
```typescript
{
  nichePackId: string;  // Required, min 1 char
  limit?: number;       // Optional, 1-20, default 10
}
```

### Response
Returns an array of strings (topic suggestions):
```json
[
  "5 surprising facts about the deep ocean",
  "The real story behind the Titanic",
  ...
]
```

### Validation & Error Handling
- Zod schema validates inputs (lines 10-13)
- Returns 403 if `APP_TEST_MODE` is enabled
- Returns 400 if OpenAI is not configured
- Returns 400 if niche pack is invalid
- Returns 500 on server errors with error message

## Frontend Implementation

### API Client
- **File**: `apps/web/src/api/client.ts`
- **Function**: `getTopicSuggestions(nichePackId: string, limit: number = 10): Promise<string[]>`
- **Lines**: 70-76

### UI Component (QuickCreate.tsx)

#### State Management
```typescript
const [suggestions, setSuggestions] = useState<string[] | null>(null);
const [loadingSuggestions, setLoadingSuggestions] = useState(false);
```
**Lines**: 54-55

#### Handler Function
```typescript
const handleSuggestTopics = async () => {
  setError('');
  setLoadingSuggestions(true);
  setSuggestions(null);
  try {
    const list = await getTopicSuggestions(formData.nichePackId, 10);
    setSuggestions(list);
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setLoadingSuggestions(false);
  }
};
```
**Lines**: 178-190

#### UI Elements

##### Button (Lines 209-217)
```tsx
<button
  type="button"
  onClick={handleSuggestTopics}
  disabled={isLoading || loadingSuggestions || !status?.providers.openai}
  className="text-sm px-3 py-1 rounded-lg transition-colors"
  style={{ background: 'var(--color-surface-2)', color: 'var(--color-primary)' }}
>
  {loadingSuggestions ? 'Loading...' : 'Suggest viral topics'}
</button>
```

**Features**:
- Positioned next to "Topic / Seed" label
- Shows "Loading..." when fetching
- Disabled when: loading, suggestions loading, or OpenAI not configured
- Uses theme colors for consistent styling

##### Suggestions Display (Lines 227-249)
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
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          {t.length > 50 ? `${t.slice(0, 50)}...` : t}
        </button>
      ))}
    </div>
  </div>
)}
```

**Features**:
- Conditional rendering (only shows when suggestions exist)
- Displays as clickable chips
- Truncates long topics to 50 characters
- Hover effect highlights primary color
- Clicking a suggestion:
  - Populates the topic field
  - Clears suggestions list
- Unobtrusive design with theme colors

## Acceptance Criteria Status

✅ **Add "Suggest Topics" button to QuickCreate.tsx**
   - Implemented at lines 209-217

✅ **Fetch suggestions from `/api/topic-suggestions`**
   - Handler at lines 178-190 calls `getTopicSuggestions()`

✅ **Display suggestions as clickable chips or list**
   - Implemented at lines 227-249 as clickable chips

✅ **Clicking suggestion populates topic field**
   - Click handler at lines 237-239 updates `formData.topic`

✅ **Filter suggestions by niche pack if selected**
   - Handler passes `formData.nichePackId` to API (line 183)

✅ **UI is unobtrusive and helpful**
   - Conditional rendering
   - Only shows when suggestions exist
   - Clear visual hierarchy
   - Consistent theme styling

## Testing

### Type Safety
✅ Passes TypeScript type checking
```bash
npm run typecheck
```

### Code Quality
✅ Passes ESLint
```bash
npm run lint
```

### E2E Test
Added test file: `apps/web/tests/e2e/topic-suggestions.spec.ts`
- Verifies button presence
- Verifies topic input field
- Verifies button positioning
- Verifies disabled state logic

## Usage Flow

1. User navigates to QuickCreate page (/)
2. User selects a niche pack (e.g., "Facts", "Horror", "Gaming")
3. User clicks "Suggest viral topics" button
4. Button shows "Loading..." while fetching
5. Backend generates 10 AI-powered topic suggestions based on selected niche pack
6. Suggestions appear as clickable chips below topic field
7. User clicks a suggestion
8. Topic field is populated with selected suggestion
9. Suggestions list disappears
10. User can proceed to generate plan

## Error Handling

### Frontend
- Shows error message in UI if API call fails
- Button disabled when OpenAI not configured
- Graceful fallback with error display

### Backend
- 403 in test mode (feature disabled)
- 400 for invalid inputs or missing OpenAI key
- 400 for invalid niche pack
- 500 for server errors

## Dependencies

### Backend
- OpenAI API (for generating suggestions)
- Trends service (`apps/server/src/services/trends/topicSuggestions.ts`)
- Niche pack system

### Frontend
- React (state management, rendering)
- API client with fetch wrapper
- Error handling utilities

## Conclusion

The topic suggestions feature is **fully functional and production-ready**. All acceptance criteria from the original issue are met. The implementation follows project conventions for:
- Input validation (Zod)
- Error handling
- State management
- UI patterns
- Type safety
- Code quality

No additional changes are required for this feature.
