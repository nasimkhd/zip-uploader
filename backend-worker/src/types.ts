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

export interface Publisher {
  normalizedName: string;
  displayName: string;
  guid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface UploadResult {
  success: boolean;
  key: string;
  filename: string;
  size?: number;
  location?: string;
  correlationId?: string;
}

export interface MultipartInitResult {
  uploadId: string;
  key: string;
  filename: string;
}

export interface MultipartPartResult {
  partNumber: number;
  etag: string;
  success: boolean;
}

export interface MultipartCompleteResult {
  success: boolean;
  key: string;
  location: string;
}

export interface FileInfo {
  key: string;
  filename: string;
  size: number;
  lastModified: string | Date;
  etag?: string;
}

export interface ListFilesResult {
  prefix: string;
  folders?: string[];
  files: FileInfo[];
  truncated: boolean;
  cursor?: string | null;
}

export interface SearchFilesResult {
  prefix: string;
  q: string;
  files: FileInfo[];
  truncated: boolean;
  cursor?: string | null;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  service: string;
  r2_connected: boolean;
  timestamp: string;
  error?: string;
}

export interface LogContext {
  correlationId?: string;
  pathname?: string;
  method?: string;
  [key: string]: unknown;
}

