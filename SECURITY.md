# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in TikTok-AI-Agent, please report it by emailing the repository owner or creating a private security advisory on GitHub.

**Please do NOT create public GitHub issues for security vulnerabilities.**

### What to Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

We aim to respond to security reports within 48 hours.

---

## Security Best Practices

### For Production Deployment:

#### 1. Environment Variables

```bash
# Set strong CORS restrictions
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Use production-grade database
DATABASE_URL="file:./production.db"  # Or PostgreSQL in production

# Protect API keys
OPENAI_API_KEY=sk-your-secret-key-here

# Enable API authentication (REQUIRED for production)
# Generate a secure random key: openssl rand -hex 32
API_KEY=your-secure-api-key-here

# Set to production
NODE_ENV=production
```

**⚠️ IMPORTANT:** Always set `API_KEY` in production to protect your API endpoints from unauthorized access.

#### 2. API Authentication

**Status:** ✅ Implemented (as of 2026-02-04)

All state-changing API endpoints (POST, PUT, PATCH, DELETE) now require authentication when `API_KEY` is configured.

**How it works:**
- **Production (`NODE_ENV=production`):** `API_KEY` is **required**. The server will fail to start if `API_KEY` is not set, preventing unauthenticated deployments.
- **When API_KEY is configured:** Clients must include `Authorization: Bearer <API_KEY>` header for all write operations (POST/PUT/PATCH/DELETE)
- **Read-only endpoints (GET):** Remain accessible without authentication for backward compatibility
- **Development/test environments:** If `API_KEY` is not set, the server runs in unsecured development mode where all endpoints are accessible. **Never use this mode in production.**

**Example client usage:**

```typescript
// JavaScript/TypeScript
const response = await fetch('http://localhost:3001/api/project', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ topic: 'My topic', nichePackId: 'facts' }),
});
```

```bash
# curl
curl -X POST http://localhost:3001/api/project \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"topic":"My topic","nichePackId":"facts"}'
```

#### 3. Artifact Access Control

The current implementation serves artifacts via static file serving without authentication. For production:

**Option A:** Add authentication middleware (recommended for now)

```typescript
app.use('/artifacts', authMiddleware, express.static(env.ARTIFACTS_DIR));
```

**Option B:** Use signed URLs with expiration

```typescript
// Generate temporary signed URLs for downloads
const signedUrl = generateSignedUrl(artifactPath, { expiresIn: 3600 });
```

**Option C:** Move artifacts to cloud storage (S3, GCS, Azure Blob)

```typescript
// Stream from cloud storage with proper access control
const stream = await s3.getObject({ Bucket, Key }).createReadStream();
```

#### 4. CSRF Protection

**Status:** ✅ Implemented (as of 2026-02-04)

Cross-Site Request Forgery (CSRF) protection is implemented via:
- **No cookie-based authentication:** The API is intentionally designed not to use cookies or server-side sessions for authentication.
- **Credentialed CORS disabled:** Cross-origin requests with credentials are not allowed, so this API cannot be safely used with cookie-based auth from other origins.
- **Bearer token authentication for writes in production:** When `API_KEY` is configured (production), all state-changing operations require an `Authorization: Bearer …` header.

This prevents CSRF-style browser form/XHR attacks in production because:
1. Browsers cannot add arbitrary `Authorization` headers to cross-site form submissions, and cross-origin XHR/fetch with custom auth headers is blocked by CORS.
2. The server never uses cookies for authentication, so there is no ambient credential that a victim's browser could automatically attach to a cross-site request.
3. Without a valid `Authorization: Bearer …` token, state-changing requests (POST/PUT/PATCH/DELETE) are rejected when `API_KEY` is required.

In development/test environments (no `API_KEY`), the server is intentionally more permissive; do not expose those environments to untrusted origins.

**Important:** If you add cookie-based authentication in the future, you MUST:
- Implement CSRF token validation (e.g., using `csurf` package)
- OR use `SameSite=Strict` or `SameSite=Lax` cookie attributes
- OR keep credentials disabled and continue using Bearer tokens only

Configuration is in `apps/server/src/index.ts`.

#### 5. Rate Limiting

**Status:** ✅ Implemented

Rate limiting is already configured in the application. The limits are:
- Development/test: 1000 requests per 15 minutes (permissive for testing)
- Production: 100 requests per 15 minutes per IP

Configuration is in `apps/server/src/index.ts`.

#### 6. Security Headers

**Status:** ✅ Implemented

Security headers (via Helmet.js) are already configured:

```typescript
import helmet from 'helmet';
app.use(helmet());
```

#### 7. HTTPS Only

Always use HTTPS in production. Configure your reverse proxy (nginx/Caddy) or hosting platform accordingly.

#### 8. Input Validation

**Status:** ✅ Implemented

All input validation is done with Zod schemas. Never bypass validation:

```typescript
// Always validate user input
const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: parsed.error });
}
```

---

## Known Security Considerations

### 1. SQLite Database

SQLite is suitable for development and small deployments but has limitations:

- No user authentication
- File-based (backup carefully)
- Limited concurrent writes

For production, consider PostgreSQL with proper access controls.

### 2. OpenAI API Key

The OpenAI API key is stored in environment variables and should:

- Never be committed to version control
- Be rotated regularly
- Have rate limits configured in OpenAI dashboard
- Use restricted API keys if available

### 3. FFmpeg Execution

FFmpeg commands are constructed with user input. Current safeguards:

- Input validation via Zod schemas
- Timeouts on all executions
- Limited to predefined effect presets

### 4. File Upload

Currently, the app generates content via AI (no file uploads). If adding file uploads:

- Validate file types and sizes
- Scan for malware
- Store in isolated directory
- Use unique, non-guessable filenames

### 5. Dependency Vulnerabilities

Current known vulnerabilities:

- `vite@5.1.6`: Moderate severity (dev-time only)
- `esbuild@0.24.2`: Moderate severity (bundled with vite)

Run `npm audit` regularly and update dependencies.

---

## Security Checklist for Deployment

- [x] Set `API_KEY` in production (REQUIRED) ✅ New as of 2026-02-04
- [x] CSRF protection enabled (credentials disabled) ✅ New as of 2026-02-04
- [ ] Set `ALLOWED_ORIGINS` in production
- [x] Set `NODE_ENV=production`
- [x] Use HTTPS (configure reverse proxy)
- [ ] Add authentication for artifact downloads
- [x] Enable rate limiting ✅ Already implemented
- [x] Add security headers (helmet) ✅ Already implemented
- [x] Review and restrict CORS settings ✅ Credentials disabled
- [ ] Rotate API keys regularly
- [ ] Set up automated backups
- [ ] Monitor logs for suspicious activity
- [x] Keep dependencies updated
- [ ] Use process manager (PM2/systemd)
- [ ] Configure firewall rules
- [ ] Implement secrets management (Vault/AWS Secrets Manager)
- [ ] Set up monitoring and alerting

---

## Security Audit History

| Date       | Auditor                      | Findings                    | Status                      |
| ---------- | ---------------------------- | --------------------------- | --------------------------- |
| 2026-02-04 | CSRF Protection Review       | CORS credentials enabled without CSRF tokens | Fixed: Disabled CORS credentials |
| 2026-01-29 | Comprehensive Security Audit | 85+ issues found, 25+ fixed | Major issues fixed (CORS, path traversal, JSON parsing, input validation) |

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

## Contact

For security-related questions or concerns, please contact the repository maintainer.
