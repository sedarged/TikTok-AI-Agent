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

# Set to production
NODE_ENV=production
```

#### 2. Artifact Access Control
The current implementation serves artifacts via static file serving without authentication. For production:

**Option A:** Add authentication middleware
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

#### 3. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

#### 4. Security Headers
Add helmet.js for security headers:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

#### 5. HTTPS Only
Always use HTTPS in production. Configure your reverse proxy (nginx/Caddy) or hosting platform accordingly.

#### 6. Input Validation
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

- [ ] Set `ALLOWED_ORIGINS` in production
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (configure reverse proxy)
- [ ] Add authentication for artifact downloads
- [ ] Enable rate limiting
- [ ] Add security headers (helmet)
- [ ] Review and restrict CORS settings
- [ ] Rotate API keys regularly
- [ ] Set up automated backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use process manager (PM2/systemd)
- [ ] Configure firewall rules
- [ ] Implement secrets management (Vault/AWS Secrets Manager)
- [ ] Set up monitoring and alerting

---

## Security Audit History

| Date | Auditor | Findings | Status |
|------|---------|----------|--------|
| 2026-01-29 | Comprehensive Security Audit | 85+ issues found, 25+ fixed | See AUDIT_REPORT.md |

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

## Contact

For security-related questions or concerns, please contact the repository maintainer.
