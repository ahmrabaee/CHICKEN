import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    messageAr?: string;
    details?: unknown[];
  };
  meta: {
    timestamp: string;
    requestId?: string;
    path: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let messageAr = 'حدث خطأ غير متوقع';
    let details: unknown[] | undefined;

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const exRes = exceptionResponse as Record<string, unknown>;
        errorCode = (exRes.code as string) || this.getErrorCodeFromStatus(status);
        message = (exRes.message as string) || exception.message;
        messageAr = (exRes.messageAr as string) || this.getArabicMessage(errorCode);
        details = exRes.details as unknown[] | undefined;
      } else {
        message = exceptionResponse as string;
        errorCode = this.getErrorCodeFromStatus(status);
        messageAr = this.getArabicMessage(errorCode);
      }
    }
    // Handle Prisma errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      errorCode = prismaError.code;
      message = prismaError.message;
      messageAr = prismaError.messageAr;
    }
    // Handle validation errors (Prisma schema/args validation)
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'VALIDATION_ERROR';
      message = exception.message || 'Invalid data provided';
      messageAr = 'البيانات المدخلة غير صالحة';
      details = [exception.message];
    }
    // Handle unknown errors
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        messageAr,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'] as string,
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    messageAr: string;
  } {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        const field = (error.meta?.target as string[])?.join(', ') || 'field';
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE_ENTRY',
          message: `A record with this ${field} already exists`,
          messageAr: `يوجد سجل بهذا ${field} بالفعل`,
        };
      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
          messageAr: 'السجل المطلوب غير موجود',
        };
      case 'P2003': // Foreign key constraint
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_ERROR',
          message: 'Related record does not exist',
          messageAr: 'السجل المرتبط غير موجود',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
          messageAr: 'حدث خطأ في قاعدة البيانات',
        };
    }
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return statusCodes[status] || 'UNKNOWN_ERROR';
  }

  private getArabicMessage(code: string): string {
    const messages: Record<string, string> = {
      VALIDATION_ERROR: 'فشل التحقق من البيانات',
      UNAUTHORIZED: 'غير مصرح',
      FORBIDDEN: 'تم رفض الوصول',
      NOT_FOUND: 'غير موجود',
      CONFLICT: 'تعارض في البيانات',
      DUPLICATE_ENTRY: 'السجل موجود بالفعل',
      INTERNAL_ERROR: 'خطأ في الخادم',
      INVALID_CREDENTIALS: 'بيانات الاعتماد غير صحيحة',
      TOKEN_EXPIRED: 'انتهت صلاحية الرمز',
      INSUFFICIENT_STOCK: 'المخزون غير كافي',
      CREDIT_LIMIT_EXCEEDED: 'تم تجاوز الحد الائتماني',
      DISCOUNT_LIMIT_EXCEEDED: 'تم تجاوز حد الخصم',
    };
    return messages[code] || 'حدث خطأ';
  }
}
