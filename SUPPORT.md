# Support

Thank you for using TikTok-AI-Agent! This document provides information on how to get help, report issues, and find resources.

## Getting Help

### Documentation

Before opening an issue, please check the following resources:

- **[README.md](README.md)** - Quick start guide and feature overview
- **[Documentation Index](DOCUMENTATION_INDEX.md)** - Complete map of all documentation
- **[docs/ folder](docs/)** - Detailed documentation including:
  - [Setup Guide](docs/setup.md) - Detailed installation instructions
  - [Configuration](docs/configuration.md) - Environment variables and settings
  - [Development Guide](docs/development.md) - Developer workflow
  - [API Reference](docs/api.md) - Complete API documentation
  - [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions
- **[Testing Guide](TESTING_GUIDE.md)** - How to run and write tests
- **[Security](SECURITY.md)** - Security policies and best practices

### Common Questions

**Q: How do I get started?**  
A: Follow the [Quick Start](README.md#quick-start) in the README. Make sure you have Node.js 20.19+ or 22.12+, FFmpeg, and an OpenAI API key.

**Q: The application won't start. What should I check?**  
A: Common issues:
1. Check that FFmpeg is installed: `ffmpeg -version`
2. Verify your `.env` file has `OPENAI_API_KEY` set
3. Run `npm install` to ensure all dependencies are installed
4. Check logs for specific error messages

**Q: How much does it cost to generate a video?**  
A: See [COST_ANALYSIS_60SEC_VIDEO.md](COST_ANALYSIS_60SEC_VIDEO.md) for a detailed breakdown. Typically $0.50-$1.50 per 60-second video depending on niche pack and configuration.

**Q: Can I use local AI models instead of OpenAI?**  
A: Not currently implemented. See [LOCAL_PROVIDERS_AND_COST_REDUCTION.md](LOCAL_PROVIDERS_AND_COST_REDUCTION.md) for future plans.

**Q: How do I deploy to production?**  
A: See [docs/deployment.md](docs/deployment.md) for Docker, Railway.app, and other deployment options.

## Reporting Issues

### Before Reporting

1. **Search existing issues**: Your issue may already be reported
2. **Check troubleshooting guide**: [docs/troubleshooting.md](docs/troubleshooting.md)
3. **Verify prerequisites**: Node.js version, FFmpeg, environment variables
4. **Test with latest version**: `git pull && npm install`

### Bug Reports

**Create a bug report**: [GitHub Issues](https://github.com/sedarged/TikTok-AI-Agent/issues/new)

Please include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**:
  - OS: (e.g., macOS 14.0, Ubuntu 22.04, Windows 11)
  - Node.js version: `node --version`
  - npm version: `npm --version`
  - FFmpeg version: `ffmpeg -version`
- **Logs**: Relevant log output (redact API keys!)
- **Screenshots**: If applicable

**Example:**

```markdown
**Bug Description**
Render fails at ffmpeg_render step with timeout error

**Steps to Reproduce**
1. Create project with horror niche pack
2. Generate plan
3. Start render
4. Render fails after 5 minutes

**Environment**
- OS: Ubuntu 22.04
- Node.js: v22.12.0
- FFmpeg: 4.4.2

**Logs**
```
[ERROR] FFmpeg render timeout after 300000ms
[ERROR] Run failed at step: ffmpeg_render
```
```

### Feature Requests

**Request a feature**: [GitHub Discussions](https://github.com/sedarged/TikTok-AI-Agent/discussions/new?category=ideas)

Please describe:

- **Problem**: What problem does this solve?
- **Proposed Solution**: How would you solve it?
- **Alternatives**: Any alternative solutions you've considered?
- **Use Case**: Specific scenario where this would be useful

### Security Vulnerabilities

**⚠️ DO NOT open public issues for security vulnerabilities**

See [SECURITY.md](SECURITY.md) for responsible disclosure process.

## Where to Find Logs

### Development Mode

Logs are printed to console with Winston logger:

```bash
npm run dev
```

Log levels:
- `info` - Normal operations
- `warn` - Warning conditions
- `error` - Error conditions
- `debug` - Detailed debugging (set `LOG_LEVEL=debug` in `.env`)

### Production Mode

Logs are output in JSON format to stdout:

```bash
npm start
```

To save logs to file:

```bash
npm start > app.log 2>&1
```

### Docker

View container logs:

```bash
docker logs tiktok-ai-agent

# Follow logs in real-time
docker logs -f tiktok-ai-agent

# Last 100 lines
docker logs --tail 100 tiktok-ai-agent
```

### Log Locations

- **Application Logs**: stdout/stderr (captured by Docker/systemd)
- **Database**: `./data/dev.db` (development) or path from `DATABASE_URL`
- **Render Artifacts**: `./artifacts/` or path from `ARTIFACTS_DIR`
- **Music Library**: `./assets/music/` or path from `MUSIC_LIBRARY_DIR`

## Community Support

### Discussions

Join the conversation on [GitHub Discussions](https://github.com/sedarged/TikTok-AI-Agent/discussions):

- **Q&A** - Ask and answer questions
- **Ideas** - Propose new features
- **Show and Tell** - Share what you've built
- **General** - General discussion

### Contributing

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- Coding standards
- Testing requirements
- Pull request process

## Response Time

- **Issues**: We aim to respond within 48-72 hours
- **Security Issues**: Within 24 hours (see [SECURITY.md](SECURITY.md))
- **Pull Requests**: Review within 1 week

**Note**: This is an open-source project maintained by volunteers. Response times may vary.

## Health Checks

### Application Health

Check if the application is running:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "mode": "development",
  "database": "connected",
  "providers": {
    "openai": true,
    "elevenlabs": false,
    "ffmpeg": true
  }
}
```

### FFmpeg Status

Verify FFmpeg is available:

```bash
ffmpeg -version
```

### Database Status

Check database connection:

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555

## Additional Resources

### Project Documentation

- [Architecture Overview](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Operations Runbook](docs/operations-runbook.md)
- [Development Master Plan](DEVELOPMENT_MASTER_PLAN.md)

### External Documentation

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

### AI Agent Resources

If you're using Cursor or GitHub Copilot:

- [AGENTS.md](AGENTS.md) - Instructions for AI coding agents
- [.cursor/rules/](.cursor/rules/) - Project-specific AI rules
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - GitHub Copilot patterns

## Contact

- **GitHub Issues**: [Report bugs](https://github.com/sedarged/TikTok-AI-Agent/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/sedarged/TikTok-AI-Agent/discussions)
- **Security**: See [SECURITY.md](SECURITY.md)

---

**Thank you for being part of the TikTok-AI-Agent community!** 🎬✨
