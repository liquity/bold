"use client";

import { useAbout } from "@/src/comps/About/About";
import { css } from "@/styled-system/css";
import { TextButton } from "@liquity2/uikit";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { HFlex } from "@liquity2/uikit";

export function AboutButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  const about = useAbout();

  return (
    <HFlex
      alignItems="center"
      gap={8}
      className={css({ color: "dimmed", fontSize: 12 })}
    >
      {/* version / “About” button */}
      <TextButton
        label={about.fullVersion}
        title={`About Liquity V2 App ${about.fullVersion}`}
        onClick={() => {
          about.openModal();
          onClick?.();
        }}
      />

      {/* your “frontend run by…” link */}
      <LinkTextButton
        external
        href="https://twitter.com/estebansuarez"
        label="Frontend operated by @estebansuarez"
      />
    </HFlex>
  );
}
