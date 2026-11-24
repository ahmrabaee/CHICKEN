import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Global audit interceptor (fix C-5).
 *
 * Writes an audit-log row for EVERY successful mutating request
 * (POST/PUT/PATCH/DELETE), capturing who (user id + username), when, what
 * (entity type + id derived from the route) and the action. This guarantees
 * "every create/update/delete across the system is recorded" without each
 * service having to call the audit service by hand.
 *
 * It runs after the handler resolves, so the business transaction has already
 * committed — the audit write is a separate, fire-and-forget insert that can
 * never fail or roll back the original request.
 */
const SENSITIVE_KEYS = [
  'password', 'currentpassword', 'newpassword', 'confirmpassword', 'oldpassword',
  'token', 'accesstoken', 'refreshtoken', 'secret', 'jwt',
];

function redact(value: any, depth = 0): any {
  if (depth > 5 || value == null || typeof value !== 'object') return value;
  const out: any = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) out[key] = '***';
    else out[key] = redact(value[key], depth + 1);
  }
  return out;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = (req?.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }
    return next.handle().pipe(
      tap((responseBody) => {
        // Never let auditing affect the request outcome.
        try {
          this.write(req, method, responseBody);
        } catch {
          /* swallowed */
        }
      }),
    );
  }

  private write(req: any, method: string, responseBody: any): void {
    const url: string = (req.originalUrl || req.url || '').split('?')[0];
    const segs = url.split('/').filter(Boolean); // ['v1','sales','123','void']
    const vIdx = segs.indexOf('v1');
    const parts = vIdx >= 0 ? segs.slice(vIdx + 1) : segs;
    const entityType = parts[0] || 'unknown';

    // Auth already writes rich, dedicated audit rows (login/logout/password).
    if (entityType === 'auth' || entityType === 'audit') return;

    // Specific action from a trailing verb segment (void, write-off, approve,
    // post, submit, apply, cancel…), otherwise derive from the HTTP method.
    const last = parts[parts.length - 1];
    const action =
      parts.length >= 2 && last && Number.isNaN(Number(last))
        ? last.replace(/-/g, '_')
        : method === 'POST'
          ? 'create'
          : method === 'DELETE'
            ? 'delete'
            : 'update';

    // Entity id: last numeric path segment, else the created row's id.
    let entityId: number | null = null;
    for (const p of parts) {
      if (p !== '' && !Number.isNaN(Number(p))) entityId = Number(p);
    }
    if (entityId == null) {
      const data = responseBody?.data ?? responseBody;
      if (data && typeof data === 'object' && typeof data.id === 'number') entityId = data.id;
    }

    const user = req.user || {};
    const changes = JSON.stringify({ method, path: url, body: redact(req.body) }).slice(0, 4000);
    const ip = (req.headers?.['x-forwarded-for'] || req.ip || '').toString().slice(0, 100) || null;
    const ua = (req.headers?.['user-agent'] || '').toString().slice(0, 250) || null;

    // Fire-and-forget: a failed audit insert must not break the response.
    this.prisma.auditLog
      .create({
        data: {
          userId: typeof user.id === 'number' ? user.id : null,
          username: user.username ?? 'system',
          action,
          entityType,
          entityId,
          changes,
          ipAddress: ip,
          userAgent: ua,
          branchId: typeof user.branchId === 'number' ? user.branchId : null,
        },
      })
      .catch(() => {});
  }
}
