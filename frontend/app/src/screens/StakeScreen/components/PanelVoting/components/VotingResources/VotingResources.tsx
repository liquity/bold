import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { IconExternal } from "@liquity2/uikit";

import type { FC } from "react";

export const VotingResources: FC = () => {
  const { resources } = content.stakeScreen.votingPanel;

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        padding: 16,
        color: "content",
        background: "fieldSurface",
        border: "1px solid token(colors.border)",
        borderRadius: 8,
        marginBottom: 16,
        marginTop: -16,
        gap: 16,
      })}
    >
      {/* Section 1: Overview */}
      <div className={css({ display: "flex", flexDirection: "column", gap: 8 })}>
        <LinkTextButton
          external
          href={resources.overview.linkUrl}
          label={
            <span className={css({ display: "flex", alignItems: "center", gap: 4, color: "accent", fontSize: 14 })}>
              <span>{resources.overview.linkText}</span>
              <IconExternal size={14} />
            </span>
          }
        />
        <p className={css({ fontSize: 14, color: "contentAlt", lineHeight: 1.4 })}>
          {resources.overview.description}
        </p>
      </div>

      {/* Section 2: Dashboard */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: "1px solid token(colors.border)",
          paddingTop: 16,
        })}
      >
        <LinkTextButton
          external
          href={resources.dashboard.linkUrl}
          label={
            <span className={css({ display: "flex", alignItems: "center", gap: 4, color: "accent", fontSize: 14 })}>
              <span>{resources.dashboard.linkText}</span>
              <IconExternal size={14} />
            </span>
          }
        />
        <p className={css({ fontSize: 14, color: "contentAlt", lineHeight: 1.4 })}>
          {resources.dashboard.description}
        </p>
      </div>

      {/* Section 3: Bribes */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: "1px solid token(colors.border)",
          paddingTop: 16,
        })}
      >
        <LinkTextButton
          external
          href={resources.bribes.linkUrl}
          label={
            <span className={css({ display: "flex", alignItems: "center", gap: 4, color: "accent", fontSize: 14 })}>
              <span>{resources.bribes.linkText}</span>
              <IconExternal size={14} />
            </span>
          }
        />
        <p className={css({ fontSize: 14, color: "contentAlt", lineHeight: 1.4 })}>
          {resources.bribes.description}
        </p>
      </div>
    </div>
  );
};
