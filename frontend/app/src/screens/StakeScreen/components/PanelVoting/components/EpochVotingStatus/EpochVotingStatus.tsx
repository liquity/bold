import { useMemo } from "react";
import { css } from "@/styled-system/css";
import { formatDate } from "@/src/formatting";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useIsPeriodCutoff } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";

import type { FC } from "react";

export const EpochVotingStatus: FC = () => {
  const { governanceStateData } = useVotingStateContext();
  const isPeriodCutoff = useIsPeriodCutoff();

  const remaining = useMemo(() => {
    if(!governanceStateData?.daysLeft) return "";
    const { daysLeft } = governanceStateData;

    const rtf = new Intl.RelativeTimeFormat("en", { style: "long" });

    if (daysLeft > 1) return rtf.format(Math.ceil(daysLeft), "day");
    if (daysLeft > 1 / 24) return rtf.format(Math.ceil(daysLeft * 24), "hour");

    return rtf.format(Math.ceil(daysLeft * 24 * 60), "minute");
  }, [governanceStateData]);

  if (!governanceStateData) return null;

  const { epochEnd, cutoffStart } = governanceStateData;

  const cutoffStartDate = new Date(Number(cutoffStart) * 1000);
  const epochEndDate = new Date(Number(epochEnd) * 1000);

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 32,
        medium: {
          gap: 16,
        },
      })}
    >
      <div
        className={css({
          paddingTop: 12,
        })}
      >
        <div
          className={css({
            position: "relative",
            display: "flex",
            width: 16,
            height: 16,
            color: "strongSurfaceContent",
            background: "strongSurface",
            borderRadius: "50%",
            medium: {
              width: 20,
              height: 20,
            },
          })}
        >
          <svg
            fill="none"
            viewBox="0 0 20 20"
            className={css({
              position: "absolute",
              inset: 0,
            })}
          >
            <path
              clipRule="evenodd"
              fill="currentColor"
              fillRule="evenodd"
              d="m15.41 5.563-6.886 10.1-4.183-3.66 1.317-1.505 2.485 2.173 5.614-8.234 1.652 1.126Z"
            />
          </svg>
        </div>
      </div>
      <div
        className={css({
          fontSize: 14,
          medium: {
            fontSize: 16,
          },
        })}
      >
        <div>
          {isPeriodCutoff ? "Upvotes ended on " : "Upvotes accepted until "}
          <time
            dateTime={formatDate(cutoffStartDate, "iso")}
            title={formatDate(cutoffStartDate, "iso")}
          >
            {formatDate(cutoffStartDate)}
          </time>
          .{" Downvotes accepted until "}
          <time
            dateTime={formatDate(epochEndDate, "iso")}
            title={formatDate(epochEndDate, "iso")}
          >
            {formatDate(epochEndDate)}
          </time>
          .
        </div>
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          Votes for epoch #{String(governanceStateData.epoch)} will be
          snapshotted {remaining}.
        </div>
      </div>
    </div>
  );
};
