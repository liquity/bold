"use client";

import { useAbout } from "@/src/comps/About/About";
import { css } from "@/styled-system/css";
import { TextButton, HFlex } from "@liquity2/uikit";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";

export function AboutButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  const about = useAbout();

  const versionStyle = css({
    color: "dimmed",
    fontSize: 9,
    lineHeight: "1",
    whiteSpace: "nowrap",
    _hover: { color: "content" },
  });

  const creditStyle = css({
    color: "dimmed",
    fontSize: 11,
    lineHeight: "1",
    whiteSpace: "nowrap",
    _hover: { color: "content" },
  });

  return (
    <HFlex alignItems="center" gap={8}>
      <LinkTextButton
        external
        href="https://twitter.com/estebansuarez"
        label="Frontend operated by @estebansuarez -"
        className={creditStyle}
      />

      {/* versión estándar */}
      <TextButton
        label={about.fullVersion}
        title={`About Liquity V2 App ${about.fullVersion}`}
        onClick={() => {
          about.openModal();
          onClick?.();
        }}
        className={versionStyle}
      />
    </HFlex>
  );
}

