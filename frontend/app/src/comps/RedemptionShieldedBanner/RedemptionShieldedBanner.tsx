"use client";

import type { CollateralSymbol } from "@/src/types";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { INTEREST_RATE_START } from "@/src/constants";
import content from "@/src/content";
import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { IconShieldCheck } from "@liquity2/uikit";
import * as dn from "dnum";

export function RedemptionShieldedBanner({
  compact,
  shieldedBranches,
}: {
  compact: boolean;
  shieldedBranches: Array<{
    symbol: CollateralSymbol;
    branchDebt: dn.Dnum;
    spDeposits: dn.Dnum;
  }>;
}) {
  const symbols = shieldedBranches.map((b) => b.symbol);
  const headline = content.home.redemptionShieldBanner.headline(symbols);

  const first = shieldedBranches[0]!;
  const detail = compact
    ? content.home.redemptionShieldBanner.detailCompact
    : shieldedBranches.length === 1
      ? content.home.redemptionShieldBanner.detailSingle(fmtnum(first.spDeposits, "compact"), fmtnum(first.branchDebt, "compact"))
      : content.home.redemptionShieldBanner.detailMultiple;

  return (
    <div
      className={css({
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid token(colors.positive)",
        background: "color-mix(in srgb, token(colors.positive) 15%, transparent)",
      })}
    >
      <div
        className={css({
          flexShrink: 0,
          paddingTop: 2,
          color: "positive",
        })}
      >
        <IconShieldCheck />
      </div>
      <div
        className={css({
          fontSize: 14,
          lineHeight: 1.5,
          "& strong, & a": {
            color: "positive",
          },
        })}
      >
        <strong>
          {headline}
        </strong>
        {detail}
        <strong>{INTEREST_RATE_START * 100}% minimum rate</strong>.{" "}
        {!compact && (
          <LinkTextButton
            external
            href={content.home.redemptionShieldBanner.learnMore.href}
            label={content.home.redemptionShieldBanner.learnMore.text}
          >
            {content.home.redemptionShieldBanner.learnMore.text}
          </LinkTextButton>
        )}
      </div>
    </div>
  );
}
