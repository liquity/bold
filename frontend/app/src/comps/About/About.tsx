"use client";

import type { Entries } from "@/src/types";
import type { ReactNode } from "react";

import { Logo } from "@/src/comps/Logo/Logo";
import * as env from "@/src/env";
import { css } from "@/styled-system/css";
import { AnchorTextButton, Button, Modal } from "@liquity2/uikit";
import { a, useSpring, useTransition } from "@react-spring/web";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ENV_EXCLUDE: (keyof typeof env)[] = [
  "CollateralSymbolSchema",
  "EnvSchema",
  "WALLET_CONNECT_PROJECT_ID",
  "VERCEL_ANALYTICS",
  "COINGECKO_API_KEY",
  "DEMO_MODE",
];

// split the env vars into 3 groups:
// - config: base config vars (excluding ENV_EXCLUDE)
// - contracts: main contracts (CONTRACT_*)
// - branches: branches contracts (in COLLATERAL_CONTRACTS)
function getEnvGroups() {
  const config = { ...env };

  const contracts: Record<string, string> = {};

  for (const [key, value] of Object.entries(env) as Entries<typeof env>) {
    if (key.startsWith("CONTRACT_")) {
      contracts[key.replace("CONTRACT_", "")] = String(value);
      delete config[key];
      continue;
    }
  }

  const branches: {
    collIndex: number;
    symbol: string;
    contracts: [string, string][];
  }[] = [];

  for (const { collIndex, symbol, contracts } of config.COLLATERAL_CONTRACTS) {
    branches.push({
      collIndex,
      symbol,
      contracts: Object
        .entries(contracts)
        .map(([name, address]) => [name, String(address)]),
    });
  }
  delete config["COLLATERAL_CONTRACTS" as keyof typeof config];

  const configFinal = Object.fromEntries(
    Object.entries(config)
      .filter(([key]) => !ENV_EXCLUDE.includes(key as keyof typeof env))
      .map(([key, value]) => {
        if (key === "CHAIN_BLOCK_EXPLORER") {
          const { name, url } = value as { name: string; url: string };
          return [key, `${name}|${url}`];
        }
        if (key === "CHAIN_CURRENCY") {
          const { name, symbol, decimals } = value as { name: string; symbol: string; decimals: number };
          return [key, `${name}|${symbol}|${decimals}`];
        }
        return [key, String(value)];
      }),
  );

  return { config: configFinal, contracts, branches };
}

function useContractsHash(envGroups: ReturnType<typeof getEnvGroups>) {
  return useQuery({
    queryKey: ["contractsHash"],
    queryFn: async () => {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(JSON.stringify([
          envGroups.contracts,
          envGroups.branches,
        ])),
      );
      return Array.from(new Uint8Array(hashBuffer))
        .slice(0, 4)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    },
    staleTime: Infinity,
  });
}

const AboutContext = createContext<{
  contractsHash?: string;
  fullVersion: string;
  openModal: () => void;
}>({
  contractsHash: "",
  fullVersion: "",
  openModal: () => {},
});

export function useAbout() {
  return useContext(AboutContext);
}

const envGroups = getEnvGroups();

export function About({ children }: { children: ReactNode }) {
  const contractsHash = useContractsHash(envGroups);
  const [visible, setVisible] = useState(false);
  const notifyCopy = useNotifyCopy();
  return (
    <AboutContext.Provider
      value={{
        openModal: () => setVisible(true),
        fullVersion: `v${env.APP_VERSION}-${env.COMMIT_HASH}`,
        contractsHash: contractsHash.data,
      }}
    >
      {children}
      <Modal
        onClose={() => setVisible(false)}
        visible={visible}
        title={<ModalTitle />}
        maxWidth={800}
      >
        <div
          className={css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            width: "100%",
            paddingTop: 32,
            "& section": {
              display: "flex",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            },
          })}
        >
          <section>
            <h2
              className={css({
                fontSize: 20,
              })}
            >
              About this version
            </h2>
            <AboutTable
              entries={{
                "Release": (
                  <AnchorTextButton
                    external
                    href={`https://github.com/liquity/bold/releases/tag/%40liquity2%2Fapp-v${env.APP_VERSION}`}
                    label={`v${env.APP_VERSION}`}
                  />
                ),
                "Commit": (
                  <AnchorTextButton
                    external
                    href={`https://github.com/liquity/bold/tree/${env.COMMIT_HASH}`}
                    label={env.COMMIT_HASH}
                  />
                ),
                "Contracts hash": contractsHash.data ?? "",
              }}
            />
          </section>
          <section>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              })}
            >
              <h2
                className={css({
                  fontSize: 20,
                })}
              >
                Build environment
              </h2>
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                })}
              >
                {notifyCopy.transition((style, item) => (
                  item && (
                    <a.div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                      })}
                      style={style}
                    >
                      <div
                        className={css({
                          fontSize: 12,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          color: "contentAlt",
                        })}
                      >
                        Copied
                      </div>
                    </a.div>
                  )
                ))}
                <Button
                  mode="secondary"
                  size="mini"
                  label="Copy to clipboard"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(envGroups, null, 2));
                    notifyCopy.notify();
                  }}
                />
              </div>
            </div>
            <AboutTable title="Config" entries={envGroups.config} />
            <AboutTable
              title={`Liquity V2 contracts (${contractsHash.data})`}
              entries={envGroups.contracts}
            />
            {envGroups.branches.map(({ collIndex, symbol, contracts }) => (
              <AboutTable
                key={collIndex}
                title={`Branch contracts: ${symbol}`}
                entries={Object.fromEntries(contracts)}
              />
            ))}
          </section>
        </div>
      </Modal>
    </AboutContext.Provider>
  );
}

function ModalTitle() {
  const logoSpring = useSpring({
    from: {
      containerProgress: 0,
      transform: `
        translateX(-64px)
        rotate(-240deg)
      `,
    },
    to: {
      containerProgress: 1,
      transform: `
        translateX(0px)
        rotate(0deg)
      `,
    },
    delay: 300,
    config: {
      mass: 1,
      tension: 800,
      friction: 80,
      precision: 0.001,
    },
  });
  return (
    <div
      className={css({
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginLeft: -24,
        paddingLeft: 24,
      })}
    >
      <a.div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          height: 40,
        })}
        style={{
          width: logoSpring.containerProgress.to([0, 0.5, 1], [0, 0, 56]),
        }}
      >
        <a.div
          style={{
            transform: logoSpring.transform,
          }}
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 40,
            transformOrigin: "50% 50%",
          })}
        >
          <Logo size={40} />
        </a.div>
      </a.div>
      <div>Liquity V2 App</div>
    </div>
  );
}

function AboutTable({
  entries,
  title,
}: {
  entries: Record<string, ReactNode>;
  title?: string;
}) {
  return (
    <div
      className={css({
        padding: "0 16px",
        background: "surface",
        border: "1px solid token(colors.tableBorder)",
        borderRadius: 8,
        "& h3": {
          borderBottom: "1px solid token(colors.tableBorder)",
        },
        "& table": {
          width: "100%",
        },
        "& td": {
          padding: "12px 0",
          borderTop: "1px solid token(colors.tableBorder)",
          fontSize: 14,
        },
        "& tr:first-child td": {
          borderTop: 0,
        },
        "& td + td": {
          paddingLeft: 16,
          textAlign: "right",
          fontFamily: "monospace",
        },
      })}
    >
      {title && (
        <h3
          className={css({
            fontSize: 14,
            padding: "8px 0",
            color: "contentAlt2",
          })}
        >
          {title}
        </h3>
      )}
      <table>
        <tbody>
          {Object.entries(entries).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>
                <div
                  className={css({
                    overflowWrap: "anywhere",
                  })}
                >
                  {value}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useNotifyCopy() {
  const [notifyCopy, setNotifyCopy] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setNotifyCopy(true);
    timeoutRef.current = setTimeout(() => {
      setNotifyCopy(false);
    }, 500);
  }, []);

  const transition = useTransition(notifyCopy, {
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, transform: "scale(1)" },
    config: {
      mass: 1,
      tension: 2000,
      friction: 80,
    },
  });

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return { notify, transition };
}
