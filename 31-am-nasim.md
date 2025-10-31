# 31 AM - Nasim

## Done
- [x] Implement end-to-end SHA-256 checksum verification
  - Compute SHA-256 in browser before upload (chunked)
  - Send checksum to backend; store in R2 `customMetadata.sha256`
  - Expose checksum on download via `X-Checksum-SHA256` header
  - Verify downloaded bytes in browser and block on mismatch
- [x] Improve hashing UX and performance
  - Increased hashing chunk size to 32MB for faster hashing
  - Progress now shows “Hashing X%” then “Uploading X%”
- [x] Provide checksum testing instructions (curl, DevTools, and R2 metadata)
