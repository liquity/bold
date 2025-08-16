import { useAbout } from "@/src/comps/About/About";
import { css } from "@/styled-system/css";
import { TextButton } from "@liquity2/uikit";
import Link from "next/link";

export function AboutButton({ onClick }: { onClick?: () => void }) {
  const about = useAbout();
  return (
    <div className={css({ display: "flex", alignItems: "center", gap: 8 })}>
      <Link
        href="https://twitter.com/estebansuarez"
        target="_blank"
        rel="noopener noreferrer"
        className={css({
          fontSize: 12,
          color: "accent",
          _hover: { textDecoration: "underline" },
        })}
        title="@estebansuarez"
      >
        Frontend operated by @estebansuarez
      </Link>

      <TextButton
        label={about.fullVersion}
        title={`About Liquity V2 App ${about.fullVersion}`}
        onClick={() => {
          about.openModal();
          onClick?.();
        }}
        className={css({ color: "dimmed" })}
        style={{ fontSize: 12 }}
      />
    </div>
  );
}
