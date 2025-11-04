/// <reference types="@cloudflare/workers-types" />

/**
 * Type definitions for backend worker environment
 */

export interface Env {
  R2_BUCKET_NAME: R2Bucket;
  API_KEY_PUBLIC?: string;
  API_KEY_ADMIN?: string;
  MAX_FILE_SIZE?: string;
  CHUNK_SIZE?: string;
  MAX_CONCURRENT_UPLOADS?: string;
}

export interface ApiValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface LogContext {
  correlationId?: string;
  pathname?: string;
  method?: string;
  error?: any;
  [key: string]: any;
}
