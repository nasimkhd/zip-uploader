# Tail Tracking Deployment Notes

## Testing in Staging

To test tail tracking with real worker logs:

1. **Deploy worker to staging:**
   ```bash
   cd backend-worker
   wrangler deploy --env staging
   ```

2. **Start tail tracking:**
   ```bash
   npm run tail
   ```

3. **In another terminal, trigger requests:**
   ```bash
   curl -X POST https://your-worker.workers.dev/api/upload \
     -F "file=@test.zip"
   ```

4. **Verify logs appear:**
   - Check console output for formatted logs
   - Check `logs/tail.log` for saved logs
   - Check `logs/filter.log` for filtered entries

5. **Test query tools:**
   ```bash
   # Query by correlation ID
   node tail/query-logs.js <correlation-id>
   
   # Query all errors
   node tail/query-errors.js
   ```

## Notes

- Tail tracking requires `wrangler tail` to be installed
- Must be connected to Cloudflare account
- Staging environment must be configured in wrangler.toml
- Logs are saved locally in `logs/` directory

