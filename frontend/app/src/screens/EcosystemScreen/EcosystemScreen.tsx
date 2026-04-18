"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";
import { BREAKPOINTS, useBreakpointName } from "@/src/breakpoints";
import { 
  EcosystemPartnerSummary, 
  type EcosystemPartnerId 
} from "@/src/comps/EcosystemPartnerSummary/EcosystemPartnerSummary";

export function EcosystemScreen() {
  const bpName = useBreakpointName();

  const partners: EcosystemPartnerId[] = [
    "wsteth",
    "reth",
    "tbtc",
    "weeth",
    "arb",
    "comp",
    "liquity",
    "summerstone",
    "octane",
    "sherlock",
    "pooltogether",
    "flowstate",
    "paladin",
    "balancer",
    "aura",
    "spectra",
    "privacypools",
  ];

  const partnersTransition = useTransition(
    partners,
    {
      from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
      enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
      leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
      trail: 80,
      config: {
        mass: 1,
        tension: 1800,
        friction: 140,
      },
    }
  );

  return (
    <Screen
      heading={{
        title: 'Ecosystem',
        subtitle: content.ecosystemScreen.subheading,
      }}
      width={BREAKPOINTS[bpName]}
      gap={16}
    >
      <div className={css({
        display: "grid",
        gridTemplateColumns: bpName === "large" ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
        gap: 16,
        justifyItems: "center",
        marginBottom: 32,
      })}>
        {partnersTransition((style, partnerId) => (
          <a.div style={style}>
            <EcosystemPartnerSummary partnerId={partnerId} />
          </a.div>
        ))}
      </div>
      <div className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "content",
        gap: 8,
      })}>
        <p>
          Want to partner with us? Reach out in our #partnerships channel on <LinkTextButton href="https://discord.gg/5h3avBYxcn" target="_blank" rel="noopener noreferrer" label="Discord" />.
        </p>
      </div>
    </Screen>
  );
}
