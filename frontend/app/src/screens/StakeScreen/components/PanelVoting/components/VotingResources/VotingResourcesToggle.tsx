import { css } from "@/styled-system/css";
import { IconChevronSmallUp } from "@liquity2/uikit";
import { useState } from "react";
import type { FC } from "react";
import { VotingResources } from "./VotingResources";

export const VotingResourcesToggle: FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={css({
          fontSize: 14,
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          _hover: {
            opacity: 0.8,
          },
          _focusVisible: {
            borderRadius: 2,
            outline: "2px solid token(colors.focused)",
            outlineOffset: 1,
          },
          paddingBottom: 10,
        })}
      >
        <span
          className={css({
            fontWeight: 500,
            color: isExpanded ? "contentAlt" : "accent",
          })}
        >
          {isExpanded ? "Hide" : "Learn more"}
        </span>
        <span
          className={css({
            color: "contentAlt",
            transition: "transform 0.15s ease",
            transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)",
            display: "flex",
            alignItems: "center",
          })}
        >
          <IconChevronSmallUp size={12} />
        </span>
      </button>

      {isExpanded && <VotingResources />}
    </div>
  );
};
