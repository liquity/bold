import { css } from "@/styled-system/css";
import { IconChevronDown, IconChevronUp } from "@liquity2/uikit";

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
  onClick 
}: { 
  label: string;
  field?: string;
  sortBy?: SortField;
  isActive?: boolean;
  onClick: () => void;
}) {
  const currentField = sortBy?.replace("-asc", "").replace("-desc", "");
  const isFieldActive = field && currentField === field;
  const isAsc = sortBy?.endsWith("-asc");
  
  return (
    <button
      onClick={onClick}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        fontSize: 14,
        fontWeight: isActive || isFieldActive ? 600 : 400,
        color: isActive || isFieldActive ? "content" : "contentAlt",
        background: isActive || isFieldActive ? "fieldSurface" : "transparent",
        border: "1px solid",
        borderColor: isActive || isFieldActive ? "border" : "transparent",
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover": {
          background: "fieldSurface",
          borderColor: "border",
        },
      })}
    >
      {label}
      {isFieldActive && (
        <span className={css({ display: "flex", alignItems: "center" })}>
          {isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </span>
      )}
    </button>
  );
}