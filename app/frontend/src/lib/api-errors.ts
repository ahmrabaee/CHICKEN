/**
 * Blueprint 03 — Posting Workflow API Error Handling
 * Centralizes error codes from backend (PERIOD_LOCKED, FREEZE_DATE, etc.)
 */

export type PostingErrorCode =
    | "PERIOD_LOCKED"
    | "FREEZE_DATE"
    | "ALREADY_CANCELLED"
    | "ALREADY_REVERSED"
    | "ALREADY_POSTED";

export const POSTING_ERROR_MESSAGES: Record<
    PostingErrorCode,
    { title: string; description?: string }
> = {
    PERIOD_LOCKED: {
        title: "الفترة المحاسبية مغلقة",
        description: "لا يمكن تنفيذ هذا الإجراء - الفترة المحاسبية مغلقة",
    },
    FREEZE_DATE: {
        title: "تاريخ التجميد",
        description: "التاريخ قبل تاريخ التجميد المحاسبي",
    },
    ALREADY_CANCELLED: {
        title: "مُلغى بالفعل",
        description: "المستند مُلغى ولا يمكن تنفيذ هذا الإجراء",
    },
    ALREADY_REVERSED: {
        title: "معكوس بالفعل",
        description: "القيد المحاسبي معكوس بالفعل",
    },
    ALREADY_POSTED: {
        title: "مرحّل بالفعل",
        description: "المستند مرحّل إلى الدفاتر بالفعل",
    },
};

export function getPostingErrorToast(error: unknown): {
    variant: "destructive";
    title: string;
    description?: string;
} | null {
    const err = error as { response?: { data?: { code?: string } } };
    const code = err?.response?.data?.code as PostingErrorCode | undefined;
    if (code && POSTING_ERROR_MESSAGES[code]) {
        const msg = POSTING_ERROR_MESSAGES[code];
        return {
            variant: "destructive" as const,
            title: msg.title,
            description: msg.description,
        };
    }
    return null;
}
