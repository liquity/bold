import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { IconExternal } from "@liquity2/uikit";

import type { FC } from "react";

const ResourceSection: FC<{
  linkUrl: string;
  linkText: string;
  description: string;
  showTopBorder?: boolean;
}> = ({ linkUrl, linkText, description, showTopBorder = false }) => (
  <div
    className={css({
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...(showTopBorder && {
        borderTop: "1px solid token(colors.border)",
        paddingTop: 16,
      }),
    })}
  >
    <LinkTextButton
      external
      href={linkUrl}
      label={
        <span className={css({ display: "flex", alignItems: "center", gap: 4, color: "accent", fontSize: 14 })}>
          <span>{linkText}</span>
          <IconExternal size={14} />
        </span>
      }
    />
    <p className={css({ fontSize: 14, color: "contentAlt", lineHeight: 1.4 })}>
      {description}
    </p>
  </div>
);

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
      <ResourceSection {...resources.overview} />
      <ResourceSection {...resources.discuss} showTopBorder />
      <ResourceSection {...resources.dashboard} showTopBorder />
      <ResourceSection {...resources.bribes} showTopBorder />
    </div>
  );
};
