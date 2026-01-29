---
name: Fix Input Focus Reset
overview: Stop input focus loss in Plan Studio by decoupling autosave state from disabling form fields, so typing doesn't toggle disabled on each keystroke.
todos: []
isProject: false
---

# Fix PlanStudio Input Focus

## Context

Typing in any tab causes UI re-render and focus loss because autosave toggles the `saving` flag on every keystroke, and all inputs use `disabled={saving}` in `[apps/web/src/pages/PlanStudio.tsx](apps/web/src/pages/PlanStudio.tsx)`.

## Plan

- Inspect `PlanStudio` state and handlers in `[apps/web/src/pages/PlanStudio.tsx](apps/web/src/pages/PlanStudio.tsx)` to separate autosave status from “busy” state used to disable inputs.
- Introduce a dedicated `isAutosaving` (or similar) state for the debounce save path, and keep `saving` (or rename to `isBusy`) for explicit actions like regenerate/validate/render.
- Update tab components (`HookTab`, `OutlineTab`, `ScriptTab`, `ScenesTab`) to **not** disable text inputs on autosave; only disable buttons or fields during explicit operations.
- Ensure the debounce timer continues to work, and keep a lightweight visual indicator for autosave if needed, without disabling fields.

## Target files

- `[apps/web/src/pages/PlanStudio.tsx](apps/web/src/pages/PlanStudio.tsx)`

## Notes

The current blur behavior is caused by `setSaving(true)` inside `autosave()` and `disabled={saving}` on inputs like:

```686:692:apps/web/src/pages/PlanStudio.tsx
<textarea
  className="textarea text-sm"
  rows={3}
  value={scene.narrationText}
  onChange={(e) => onChange(scene.id, 'narrationText', e.target.value)}
  disabled={disabled || scene.isLocked}
/>
```

Removing autosave from `disabled` should stop focus loss while keeping debounced saves.