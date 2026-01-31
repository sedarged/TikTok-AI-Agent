# ADR 0002: Monorepo Structure with npm Workspaces

**Date**: 2026-01-31  
**Status**: Accepted  
**Decision Makers**: Development Team

## Context

The TikTok-AI-Agent project consists of two distinct applications:
1. **Backend API** - Express server handling AI integration, video rendering, and data persistence
2. **Frontend UI** - React application for user interaction and video preview

We needed to decide on a repository structure that would:
- Allow code sharing between frontend and backend
- Simplify dependency management
- Enable coordinated development and testing
- Support independent deployment of frontend and backend
- Maintain clear boundaries between concerns

## Decision

We will use a **monorepo structure** with **npm workspaces** to manage both applications in a single repository.

### Structure

```
TikTok-AI-Agent/
├── apps/
│   ├── server/    # Backend workspace
│   └── web/       # Frontend workspace
├── package.json    # Root workspace configuration
├── node_modules/   # Shared dependencies (hoisted)
└── docs/           # Shared documentation
```

### Workspace Configuration

Root `package.json`:
```json
{
  "workspaces": [
    "apps/server",
    "apps/web"
  ]
}
```

### Dependency Management

- **Shared dependencies**: Installed once at root (e.g., TypeScript, ESLint, Prettier)
- **Workspace-specific**: Installed in respective `apps/*/node_modules`
- **Hoisting**: npm automatically hoists common dependencies to root

### Scripts

Root scripts coordinate both workspaces:
```json
{
  "dev": "concurrently \"npm run dev:server\" \"npm run dev:web\"",
  "build": "npm run build --workspace=apps/web && npm run build --workspace=apps/server",
  "test": "npm run test --workspace=apps/server && npm run test:runSse --workspace=apps/server"
}
```

## Consequences

### Positive

1. **Single Source of Truth**: One repository, one issue tracker, one PR process
2. **Atomic Changes**: Frontend and backend changes can be made in single commit
3. **Shared Dependencies**: TypeScript, ESLint, Prettier installed once
4. **Simplified CI/CD**: Single workflow tests both applications
5. **Type Sharing**: Can export types from server to web if needed (future)
6. **Coordinated Versioning**: Single version number for the whole project

### Negative

1. **Larger Repository**: More code to clone and manage
2. **Build Complexity**: Must coordinate build order (web before server for static files)
3. **Deployment Coupling**: Changes to one app trigger CI for both (though we have separate jobs)
4. **Learning Curve**: Developers need to understand workspace mechanics

### Neutral

1. **Not a True Monorepo Tool**: npm workspaces is simpler than Nx/Turborepo but less powerful
2. **No Build Caching**: Each build starts fresh (could add Turborepo later)

## Alternatives Considered

### 1. Separate Repositories (Polyrepo)

**Pros**:
- Clear separation of concerns
- Independent versioning and deployment
- Smaller clones

**Cons**:
- Harder to keep APIs in sync
- Duplicate dependencies and tooling config
- More complex PR process for cross-cutting changes
- Two issue trackers to manage

**Verdict**: Rejected because coordination overhead outweighs benefits

### 2. Monorepo with Nx/Turborepo

**Pros**:
- Advanced build caching
- Task orchestration
- Dependency graph analysis

**Cons**:
- Significant learning curve
- Additional configuration overhead
- Overkill for 2-app project

**Verdict**: Rejected for now, can revisit if project grows to 5+ apps

### 3. Server-Side Rendered (SSR) Monolith

**Pros**:
- Single deployment unit
- No CORS configuration needed
- Simpler architecture

**Cons**:
- Couples frontend and backend deployment
- Harder to scale independently
- Limits frontend framework choices

**Verdict**: Rejected because we want independent frontend/backend deployment

## Implementation Notes

### Running Both Apps

```bash
# Development (concurrent)
npm run dev

# Production
npm run build
npm start
```

### Adding Dependencies

```bash
# Root dependency (shared)
npm install -D typescript

# Workspace dependency
npm install express --workspace=apps/server
npm install react --workspace=apps/web
```

### Type Sharing (Future)

To share types between apps:

1. Create `packages/shared-types/`
2. Add to workspaces array
3. Import in both apps

**Not yet implemented** - current approach keeps apps independent.

## Related Decisions

- [ADR 0001: Record Architecture Decisions](0001-record-architecture-decisions.md)
- [ADR 0003: Render Pipeline Design](0003-render-pipeline-design.md)

## Migration Path

If we need to split into separate repos:

1. Use `git subtree split` to extract each workspace
2. Create new repositories for server and web
3. Update CI/CD workflows
4. Coordinate releases via GitHub releases

**Estimated effort**: 2-3 days

## References

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [Monorepo vs Polyrepo](https://earthly.dev/blog/monorepo-vs-polyrepo/)
- [Why Monorepos Are Great](https://danluu.com/monorepo/)

---

**Status**: Accepted and implemented  
**Review Date**: 2026-06-30 (reassess if project grows to 5+ apps)
