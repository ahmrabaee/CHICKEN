import React, { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { normalizeToEnglishNumberString } from "@/lib/numbers";

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onValueChange?: (value: number | string) => void;
    suffix?: React.ReactNode;
    prefixNode?: React.ReactNode;
    allowNegative?: boolean;
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
    ({ className, value, onChange, onValueChange, suffix, prefixNode, allowNegative = false, ...props }, ref) => {
        const [internalValue, setInternalValue] = useState<string>("");

        useEffect(() => {
            // Sync from external value
            if (value !== undefined && value !== null) {
                const strVal = value.toString();
                // Prevent clearing trailing dot if user is typing a decimal (e.g. "5.")
                if (internalValue && parseFloat(internalValue) === parseFloat(strVal)) {
                    // Both evaluate to same number (or both NaN), stick to internal to preserve cursor & trail 
                } else {
                    setInternalValue(strVal);
                }
            } else {
                setInternalValue("");
            }
        }, [value]); // intentionally not depending on internalValue to avoid infinite loops

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let rawVal = e.target.value;
            let normalized = normalizeToEnglishNumberString(rawVal);

            if (!allowNegative) {
                normalized = normalized.replace("-", "");
            }

            setInternalValue(normalized);

            // Create a modified synthetic event to pass to react-hook-form or other handlers
            const modifiedEvent = {
                ...e,
                target: {
                    ...e.target,
                    value: normalized,
                    name: props.name,
                }
            } as React.ChangeEvent<HTMLInputElement>;

            if (onChange) {
                onChange(modifiedEvent);
            }

            if (onValueChange) {
                const numWrap = normalized === "-" || normalized === "" ? "" : Number(normalized);
                onValueChange(numWrap);
            }
        };

        const hasAdornment = !!suffix || !!prefixNode;

        const inputClasses = cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            hasAdornment ? "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-full outline-none flex-1 px-3" : className
        );

        const inputElement = (
            <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                className={inputClasses}
                value={internalValue}
                onChange={handleChange}
                ref={ref}
                {...props}
            />
        );

        if (hasAdornment) {
            return (
                <div className={cn(
                    "flex items-center h-10 w-full rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    className
                )}>
                    {prefixNode && (
                        <div className="flex items-center justify-center px-3 bg-muted text-muted-foreground border-l border-input h-full">
                            {prefixNode}
                        </div>
                    )}
                    {inputElement}
                    {suffix && (
                        <div className="flex items-center justify-center px-3 bg-muted text-muted-foreground border-r border-input h-full">
                            {suffix}
                        </div>
                    )}
                </div>
            );
        }

        return inputElement;
    }
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
