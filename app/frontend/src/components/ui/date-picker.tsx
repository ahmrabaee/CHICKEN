import * as React from "react";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    /** Current value as YYYY-MM-DD string */
    value?: string;
    /** Callback when date changes, returns YYYY-MM-DD string */
    onChange?: (value: string) => void;
    /** Placeholder text when no date is selected */
    placeholder?: string;
    /** Additional classes for the trigger button */
    className?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
}

export function DatePicker({
    value,
    onChange,
    placeholder = "اختر التاريخ",
    className,
    disabled = false,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    // Parse YYYY-MM-DD string to Date object
    const selectedDate = React.useMemo(() => {
        if (!value) return undefined;
        try {
            return parse(value, "yyyy-MM-dd", new Date());
        } catch {
            return undefined;
        }
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            onChange?.(format(date, "yyyy-MM-dd"));
        } else {
            onChange?.("");
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-right font-normal h-10",
                        !selectedDate && "text-muted-foreground",
                        className,
                    )}
                >
                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                    {selectedDate ? (
                        <span className="truncate">
                            {format(selectedDate, "yyyy/MM/dd")}
                        </span>
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                    initialFocus
                    className="pointer-events-auto"
                />
            </PopoverContent>
        </Popover>
    );
}
