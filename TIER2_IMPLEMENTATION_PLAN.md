# TIER 2: CRITICAL TASKS - Implementation Plan

**Date Created:** Week of [Monday]  
**Status:** Planning Phase  
**Priority:** CRITICAL - Security & Observability

---

## OVERVIEW

Tier 2 consists of two critical tasks that must be completed to ensure the system is secure and debuggable:

1. **TASK 2.1**: Implement X-API-Key Authentication
2. **TASK 2.2**: Implement Tail Tracking System for Workers

Both tasks share common requirements and should be implemented following the architectural principles and coding standards outlined in PROJECT_BRIEFING.md.

---

## COMMON REQUIREMENTS FOR ALL TIER 2 TASKS

### Shared Coding Standards (from PROJECT_BRIEFING.md lines 52-59)

- **TypeScript strict mode** (Note: Current codebase is JavaScript; consider TypeScript migration or strict JS validation)
- **Input validation at worker entry** - All endpoints validate inputs before processing
- **Structured logging** - JSON format with correlation IDs for traceability
- **No hardcoded paths** - Use environment variables from wrangler.toml or secrets
- **Clear error codes** - Not generic "error" messages; specific error codes like "INVALID_KEY", "MISSING_KEY", etc.

### Shared Infrastructure Requirements

1. **Wrangler Secrets Management**
   - API keys stored in wrangler secrets (NOT in code)
   - Separate keys for different environments (staging, production)
   - Admin vs public key separation

2. **Testing Requirements**
   - Unit tests for each component
   - Integration tests for full flows
   - Error path testing
   - Security testing (injection attempts, invalid keys, etc.)

3. **Deployment Requirements**
   - Deploy to staging environment first
   - Verify all functionality in staging
   - Document all configuration changes
   - Update wrangler.toml with necessary bindings

4. **Documentation Requirements**
   - Code comments explaining implementation
   - Update README with new features
   - Document API key setup process
   - Document tail logging usage

5. **Logging & Observability**
   - All operations log with correlation IDs
   - Error logging includes full context
   - Success operations logged for debugging
   - Logs structured in JSON format

---

## TASK 2.1: Implement X-API-Key Authentication

### Overview
Add X-API-Key validation to all 11 endpoints to restrict access to authorized clients.

### Endpoints Requiring Protection

Based on `backend-worker/src/index.js`, the following 11 endpoints need authentication:

1. `POST /api/upload` - Simple file upload
2. `POST /api/upload/multipart/init` - Initiate multipart upload
3. `POST /api/upload/multipart/part` - Upload a chunk
4. `POST /api/upload/multipart/complete` - Complete multipart upload
5. `POST /api/upload/multipart/abort` - Abort multipart upload
6. `GET /api/search` - Search files recursively
7. `GET /api/files` - List files
8. `DELETE /api/files/{key}` - Delete a file
9. `GET /api/files/{key}` - Download a file
10. `GET /api/files-inline/{key}` - Get file inline
11. **(Note:** `/api/health` excluded per briefing - health checks typically don't require auth)

**Actual count: 10 endpoints** (health excluded, but verify if briefing meant 11 including health or if there's another endpoint)

### Implementation Requirements

#### 1. API Key Management
- [ ] Generate API keys for staging environment
- [ ] Generate API keys for production environment (separate)
- [ ] Store keys in wrangler secrets: `API_KEY_PUBLIC` and `API_KEY_ADMIN`
- [ ] Document key generation process
- [ ] Separate admin keys for operations like DELETE

#### 2. Middleware Implementation
- [ ] Create `validateApiKey()` function in `backend-worker/src/index.js`
- [ ] Check `X-API-Key` header on all protected endpoints
- [ ] Return 401 with `{ error: "Unauthorized", code: "INVALID_KEY" }` if missing/invalid
- [ ] Log invalid attempts with key prefix only (first 8 chars, e.g., `abc12345...`)
- [ ] Skip validation for `/api/health` endpoint
- [ ] Handle CORS preflight (OPTIONS) requests without auth

#### 3. Error Handling
- [ ] Missing key: `code: "MISSING_KEY"`
- [ ] Invalid key: `code: "INVALID_KEY"`
- [ ] Admin required: `code: "ADMIN_KEY_REQUIRED"`
- [ ] All error responses include correlation ID if available

#### 4. Frontend Integration
- [ ] Update frontend to include `X-API-Key` header in all API requests
- [ ] Store API key in environment variable or config
- [ ] Handle 401 responses gracefully (show user-friendly error)
- [ ] Update CORS headers to include `X-API-Key` (already present in frontend-worker)

#### 5. Testing Requirements
- [ ] Test all 10 endpoints without key → 401
- [ ] Test all 10 endpoints with invalid key → 401
- [ ] Test all 10 endpoints with valid key → success
- [ ] Test admin-only endpoints with public key → 403 or appropriate error
- [ ] Test CORS preflight → no auth required
- [ ] Test health endpoint → no auth required
- [ ] Verify keys not logged in full (security check)

### Success Criteria
- [ ] All 10 endpoints protected
- [ ] All tests pass
- [ ] Keys stored in wrangler secrets
- [ ] Keys never logged in full
- [ ] Frontend updated to send API key
- [ ] Documentation complete

---

## TASK 2.2: Implement Tail Tracking System for Workers

### Overview
Capture and persistently store worker logs locally for debugging. Detailed implementation guide exists in `TAIL_IMPLEMENTATION_GUIDE.md`.

### Implementation Requirements

#### 1. Directory Structure
- [ ] Create `logs/` directory in project root
- [ ] Create `tail/` directory for formatter scripts
- [ ] Ensure `.gitignore` excludes `logs/` directory

#### 2. Log Formatter Scripts
- [ ] Create `tail/format-logs.js` - Smart formatter (filters noise)
- [ ] Create `tail/format-logs-all.js` - Unfiltered formatter
- [ ] Create `tail/query-logs.js` - Query by correlation ID
- [ ] Create `tail/query-errors.js` - Find all errors
- [ ] Create `tail/test-parser.js` - Parser test suite

#### 3. NPM Scripts Configuration
- [ ] Add `"tail": "wrangler tail --env staging | node tail/format-logs.js"` to `backend-worker/package.json`
- [ ] Add `"tail:all": "wrangler tail --env staging | node tail/format-logs-all.js"`
- [ ] Add `"test:tail-parser": "node tail/test-parser.js"`
- [ ] Add helper scripts for querying logs

#### 4. Log Format Requirements
- [ ] Parse wrangler tail JSON output
- [ ] Format as: `[TIMESTAMP] METHOD PATH → STATUS (DURATION) ✓/❌ | MESSAGE`
- [ ] Extract correlation IDs from logs
- [ ] Filter noise (OPTIONS, static assets, etc.)
- [ ] Save to `logs/tail.log` (main stream)
- [ ] Save filtered diagnostics to `logs/filter.log`

#### 5. Log Rotation
- [ ] Implement daily log rotation
- [ ] Archive old logs with date suffix
- [ ] Document rotation process

#### 6. Testing Requirements
- [ ] Run `npm run tail` and verify it streams logs
- [ ] Verify logs appear in readable format
- [ ] Test correlation ID extraction
- [ ] Test error detection (❌ markers)
- [ ] Test query by correlation ID
- [ ] Test error query script
- [ ] Run parser test suite → all pass

### Success Criteria
- [ ] `npm run tail` starts without errors
- [ ] Logs appear in real-time in console
- [ ] `logs/tail.log` contains readable entries
- [ ] `logs/filter.log` shows diagnostic events
- [ ] Can query by correlation ID
- [ ] Can find all errors
- [ ] Parser test passes
- [ ] LLM can read and understand logs

---

## MUTUAL DEPENDENCIES & COORDINATION

### Task Order Recommendation
1. **Start with TASK 2.2 (Tail Tracking)** - Provides visibility for debugging TASK 2.1
2. **Then implement TASK 2.1 (Authentication)** - Can debug issues using tail logs

### Shared Components
- Both require structured logging with correlation IDs
- Both need wrangler secrets configuration
- Both need staging environment deployment
- Both need comprehensive testing
- Both need documentation updates

### Integration Points
- Tail tracking will capture authentication failures
- Authentication middleware should log with correlation IDs (for tail tracking)
- Both tasks test error handling scenarios
- Both tasks require environment variable management

---

## TESTING STRATEGY

### Unit Tests
- Test API key validation logic in isolation
- Test log formatter with sample wrangler tail output
- Test error code generation
- Test correlation ID extraction

### Integration Tests
- Test full request flow with valid API key
- Test full request flow with invalid API key
- Test tail tracking with actual worker deployment
- Test log query scripts with real log files

### End-to-End Tests
- Upload file with valid API key → success
- Upload file without API key → 401
- Upload file with invalid API key → 401
- Check tail logs show authentication events
- Query logs by correlation ID from upload

### Error Path Testing
- Missing API key header
- Invalid API key format
- Expired API key (if implemented)
- Tail formatter with malformed JSON
- Log file read errors

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All code changes committed
- [ ] All tests passing locally
- [ ] Code review completed
- [ ] Documentation updated

### Staging Deployment
- [ ] Wrangler secrets configured for staging
- [ ] Workers deployed to staging
- [ ] Verify API key authentication works
- [ ] Verify tail tracking works
- [ ] Test all endpoints
- [ ] Verify logs are being captured

### Production Deployment (Future)
- [ ] Generate production API keys
- [ ] Store production keys in secrets
- [ ] Deploy to production
- [ ] Verify functionality
- [ ] Monitor logs for errors

---

## DOCUMENTATION REQUIREMENTS

### Code Documentation
- [ ] Comments explaining API key validation logic
- [ ] Comments explaining log formatter logic
- [ ] Comments explaining error codes
- [ ] JSDoc comments for exported functions

### User Documentation
- [ ] README update: How to set up API keys
- [ ] README update: How to use tail tracking
- [ ] README update: How to query logs
- [ ] README update: Error code reference

### Developer Documentation
- [ ] Document API key generation process
- [ ] Document wrangler secrets setup
- [ ] Document tail tracking usage
- [ ] Document debugging workflow

---

## RISK MITIGATION

### Authentication Risks
- **Risk:** API keys leaked in logs
  - **Mitigation:** Only log key prefix (first 8 chars)
  
- **Risk:** Frontend can't access API
  - **Mitigation:** Test frontend integration early, handle 401 gracefully

- **Risk:** Breaking existing functionality
  - **Mitigation:** Comprehensive testing, staged rollout

### Tail Tracking Risks
- **Risk:** Log files grow too large
  - **Mitigation:** Daily rotation, limit file size
  
- **Risk:** Performance impact from logging
  - **Mitigation:** Async logging, buffering

- **Risk:** Parser crashes on malformed logs
  - **Mitigation:** Error handling in parser, test suite

---

## COMPLETION CRITERIA

A task is considered COMPLETE when:

1. ✅ All code changes committed
2. ✅ All tests passing (unit, integration, E2E)
3. ✅ Deployed to staging environment
4. ✅ E2E test passes in staging
5. ✅ Logs reviewed (no unexpected errors)
6. ✅ Code reviewed and approved
7. ✅ Documentation complete (code comments + README)
8. ✅ Completion report submitted

---

## REFERENCES

- **PROJECT_BRIEFING.md** - Lines 52-59 (Coding Standards), Lines 444-562 (Tier 2 Tasks)
- **TAIL_IMPLEMENTATION_GUIDE.md** - Complete implementation guide for TASK 2.2
- **backend-worker/src/index.js** - Current endpoint implementation
- **frontend-worker/src/index.js** - Frontend worker code

---

**End of Tier 2 Implementation Plan**

