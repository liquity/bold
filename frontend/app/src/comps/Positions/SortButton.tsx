import { css } from "@/styled-system/css";
import { IconChevronDown, IconChevronUp, Tooltip } from "@liquity2/uikit";

export type SortField = 
  | "default"
  | "apr-asc" | "apr-desc"
  | "apr7d-asc" | "apr7d-desc" 
  | "poolSize-asc" | "poolSize-desc"
  | "avgRate-asc" | "avgRate-desc"
  | "deposited-asc" | "deposited-desc"
  | "debt-asc" | "debt-desc";

export function SortButton({ 
  label, 
  field, 
  sortBy, 
  isActive,
  disabled = false,
  disabledTooltip,
  onClick 
}: { 
  label: string;
  field?: string;
  sortBy?: SortField;
  isActive?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  onClick: () => void;
}) {
  const currentField = sortBy?.replace("-asc", "").replace("-desc", "");
  const isFieldActive = field && currentField === field;
  const isAsc = sortBy?.endsWith("-asc");
  
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        fontSize: 14,
        fontWeight: isActive || isFieldActive ? 600 : 400,
        color: disabled ? "contentDisabled" : (isActive || isFieldActive ? "content" : "contentAlt"),
        background: isActive || isFieldActive ? "fieldSurface" : "transparent",
        border: "1px solid",
        borderColor: disabled ? "borderDisabled" : (isActive || isFieldActive ? "border" : "transparent"),
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        "&:hover:not(:disabled)": {
          background: "fieldSurface",
          borderColor: "border",
        },
      })}
    >
      {label}
      {isFieldActive && !disabled && (
        <span className={css({ display: "flex", alignItems: "center" })}>
          {isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </span>
      )}
    </button>
  );

  return disabled && disabledTooltip ? (
    <Tooltip
      opener={({ buttonProps, setReference }) => (
        <span ref={setReference} {...buttonProps}>
          {button}
        </span>
      )}
    >
      <div style={{ padding: "8px", fontSize: 14 }}>
        {disabledTooltip}
      </div>
    </Tooltip>
  ) : button;
}