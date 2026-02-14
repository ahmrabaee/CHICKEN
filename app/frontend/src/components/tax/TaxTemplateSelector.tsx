import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTaxTemplates } from "@/hooks/use-tax";
import { Loader2 } from "lucide-react";

interface TaxTemplateSelectorProps {
    value: number | null;
    onChange: (id: number | null) => void;
    type: "sales" | "purchases";
    allowClear?: boolean;
    placeholder?: string;
}

export function TaxTemplateSelector({
    value,
    onChange,
    type,
    allowClear = true,
    placeholder = "اختر قالب الضريبة",
}: TaxTemplateSelectorProps) {
    const { data: templates, isLoading } = useTaxTemplates(type);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التحميل...
            </div>
        );
    }

    const list = templates ?? [];

    return (
        <Select
            value={value ? String(value) : allowClear ? "none" : undefined}
            onValueChange={(v) => onChange(v === "none" ? null : Number(v))}
        >
            <SelectTrigger>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {allowClear && (
                    <SelectItem value="none">
                        بدون ضريبة
                    </SelectItem>
                )}
                {list.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.type === "sales" ? "مبيعات" : "مشتريات"})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
