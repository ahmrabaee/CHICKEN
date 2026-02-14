/**
 * DocumentStatusGuard — Blueprint 03 Posting Workflow Control
 *
 * Validates document status (docstatus) before operations.
 * docstatus: 0 = Draft, 1 = Submitted, 2 = Cancelled
 */

import { BadRequestException } from '@nestjs/common';

/** Document with docstatus field */
export interface DocumentWithStatus {
  docstatus: number;
}

export class DocumentStatusGuard {
  /** Throws if document is not Draft (docstatus !== 0) */
  static requireDraft(doc: DocumentWithStatus): void {
    if (doc.docstatus !== 0) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Document must be in draft state',
        messageAr: 'المستند يجب أن يكون في حالة مسودة',
      });
    }
  }

  /** Throws if document is not Submitted (docstatus !== 1) */
  static requireSubmitted(doc: DocumentWithStatus): void {
    if (doc.docstatus !== 1) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Document must be submitted',
        messageAr: 'المستند يجب أن يكون مُرحّلاً',
      });
    }
  }

  /** Throws if document is Cancelled (docstatus === 2) */
  static requireNotCancelled(doc: DocumentWithStatus): void {
    if (doc.docstatus === 2) {
      throw new BadRequestException({
        code: 'ALREADY_CANCELLED',
        message: 'Document is already cancelled',
        messageAr: 'المستند ملغى بالفعل',
      });
    }
  }

  /** Throws if document is not editable (Submitted or Cancelled) */
  static requireEditable(doc: DocumentWithStatus): void {
    if (doc.docstatus !== 0) {
      throw new BadRequestException({
        code: 'NOT_EDITABLE',
        message: 'Document cannot be modified after submit',
        messageAr: 'لا يمكن تعديل المستند بعد الترحيل',
      });
    }
  }
}
