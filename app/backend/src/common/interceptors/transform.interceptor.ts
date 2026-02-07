import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        // If data is already in the expected format, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Check if response includes pagination info
        if (data && typeof data === 'object' && 'items' in data && 'pagination' in data) {
          return {
            success: true as const,
            data: data.items,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.headers['x-request-id'] as string,
            },
            pagination: data.pagination,
          };
        }

        // Standard response wrapper
        return {
          success: true as const,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.headers['x-request-id'] as string,
          },
        };
      }),
    );
  }
}
