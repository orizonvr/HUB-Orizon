import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  formatDigitsToBR,
  formatNumberBR,
  parseNumberBR,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | null | undefined;
  onChangeValue?: (val: number | null) => void;
  prefix?: string;
  suffix?: string;
  allowDecimals?: boolean;
  maxDecimals?: number;
}

export const FormattedNumberInput = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps
>(
  (
    {
      value,
      onChangeValue,
      prefix,
      suffix,
      allowDecimals = true,
      maxDecimals = 2,
      className,
      placeholder,
      disabled,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [display, setDisplay] = useState<string>(() =>
      formatNumberBR(value, { decimals: allowDecimals ? maxDecimals : 0 }),
    );

    // Sincroniza quando o valor externo mudar
    useEffect(() => {
      const currentParsed = parseNumberBR(display);
      if (value !== currentParsed) {
        setDisplay(
          formatNumberBR(value, { decimals: allowDecimals ? maxDecimals : 0 }),
        );
      }
    }, [value, allowDecimals, maxDecimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatDigitsToBR(raw, allowDecimals, maxDecimals);
      setDisplay(formatted);
      const parsed = parseNumberBR(formatted);
      onChangeValue?.(parsed);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // No blur, garante a formatação consistente
      const parsed = parseNumberBR(display);
      setDisplay(
        formatNumberBR(parsed, { decimals: allowDecimals ? maxDecimals : 0 }),
      );
      onBlur?.(e);
    };

    if (prefix || suffix) {
      return (
        <div className={cn("relative flex items-center w-full", className)}>
          {prefix && (
            <span className="absolute left-3 text-xs font-medium text-muted-foreground select-none pointer-events-none">
              {prefix}
            </span>
          )}
          <Input
            ref={ref}
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            value={display}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              prefix && "pl-9",
              suffix && "pr-16",
              "w-full font-mono text-sm",
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-xs font-medium text-muted-foreground select-none pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
      );
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={cn("w-full font-mono text-sm", className)}
        {...props}
      />
    );
  },
);

FormattedNumberInput.displayName = "FormattedNumberInput";
