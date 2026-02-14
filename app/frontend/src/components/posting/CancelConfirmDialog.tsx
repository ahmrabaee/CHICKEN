/**
 * Blueprint 03 — Cancel Confirm Dialog (RTL)
 * Reusable dialog for cancel operations with GL reversal note
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface CancelConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    entityLabel: string;
    glReversalNote?: boolean;
    isPending?: boolean;
}

export function CancelConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    entityLabel,
    glReversalNote = true,
    isPending = false,
}: CancelConfirmDialogProps) {
    const [reason, setReason] = useState("");

    const handleConfirm = () => {
        if (!reason.trim()) return;
        onConfirm(reason);
        setReason("");
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setReason("");
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="max-w-md sm:max-w-lg"
                dir="rtl"
                style={{ textAlign: "right" }}
            >
                <DialogHeader>
                    <DialogTitle className="text-red-600">{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                        هل أنت متأكد من إلغاء {entityLabel}؟ هذا الإجراء لا يمكن
                        التراجع عنه.
                    </p>
                    {glReversalNote && (
                        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            سيتم إنشاء قيد عكسي محاسبي.
                        </p>
                    )}
                    <div>
                        <label className="text-sm font-medium block mb-2">
                            سبب الإلغاء *
                        </label>
                        <Input
                            placeholder="أدخل سبب الإلغاء..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>
                    <div
                        className="flex gap-2 justify-end"
                        style={{ flexDirection: "row-reverse" }}
                    >
                        <Button
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            className="flex-1"
                            disabled={isPending}
                        >
                            تراجع
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirm}
                            className="flex-1"
                            disabled={!reason.trim() || isPending}
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                            ) : null}
                            تأكيد الإلغاء
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
