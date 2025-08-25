import type { FC } from "react";
import { css } from "@/styled-system/css";
import { useIsPeriodCutoff } from '@/src/screens/StakeScreen/components/PanelVoting/hooks';

export const CutoffWarning: FC = () => {
  const isPeriodCutoff = useIsPeriodCutoff();

  if(!isPeriodCutoff) {
    return null
  }

  return (
    <div
      className={css({
        paddingTop: 16,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          paddingLeft: 12,
          fontSize: 14,
          background: "yellow:50",
          border: "1px solid token(colors.yellow:200)",
          borderRadius: 8,
        })}
      >
        <div>
          <svg width="16" height="17" fill="none">
            <path
              fill="#E1B111"
              d="M.668 14.333h14.667L8 1.666.668 14.333Zm8-2H7.335v-1.334h1.333v1.334Zm0-2.667H7.335V6.999h1.333v2.667Z"
            />
          </svg>
        </div>
        <div>Only downvotes are accepted today.</div>
      </div>
    </div>
  );
};
