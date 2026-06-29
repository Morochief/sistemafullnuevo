/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SECURITY Phase 3 Fix #17: Audit Logging Module
 *
 * Writes one JSON object per line (JSON Lines format) to audit.log.
 * Uses fs.appendFile (async) which performs an atomic append on the OS level,
 * avoiding race conditions between concurrent writes without an explicit mutex.
 */

import fs from 'fs';
import { prisma } from './src/lib/prisma.ts';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUDIT_LOG_PATH = path.join(__dirname, 'audit.log');

export interface AuditEntry {
  usuario: string;
  accion: string;
  recurso: string;
  resultado: 'success' | 'failure';
  ip: string;
  /** Optional extra detail; will be merged into the logged line */
  detalle?: string;
}

/**
 * Append an audit entry to audit.log as a single JSON line.
 * Never throws: audit logging failures must not break the request flow.
 */
export function auditLog(entry: AuditEntry): void {
  const record = {
    timestamp: new Date().toISOString(),
    usuario: entry.usuario,
    accion: entry.accion,
    recurso: entry.recurso,
    resultado: entry.resultado,
    ip: entry.ip,
    ...(entry.detalle ? { detalle: entry.detalle } : {})
  };

  const line = JSON.stringify(record) + '\n';

  // fs.appendFile opens with O_APPEND so concurrent appends are atomic per write.
  fs.appendFile(AUDIT_LOG_PATH, line, (err) => {
    if (err) {
      // Fall back to stderr; do not crash the request.
      console.error('[AUDIT] Failed to write audit log entry:', err.message);
    }
  });
}

/**
 * Helper to extract a best-effort client IP from an Express request.
 */
export function getClientIp(req: { ip?: string; headers?: Record<string, any>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
