"use client";

import { Positions } from "@/src/comps/Positions/Positions";
import content from "@/src/content";
import { BORROW_STATS, EARN_POOLS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import { useFindAvailableTroveIndex } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  AnchorButton,
  Button,
  COLLATERALS,
  HFlex,
  IconBorrow,
  IconEarn,
  InfoTooltip,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { match } from "ts-pattern";

export function HomeScreen() {
  const { address: accountAddress } = useAccount();
  const {
    currentStepIndex,
    discard,
    signAndSend,
    start,
    flow,
  } = useTransactionFlow();

  const availableTroveIndex = useFindAvailableTroveIndex(accountAddress);
  const openedTroveIndex = (availableTroveIndex.data ?? 0) - 1;

  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 64,
        width: "100%",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 16,
        })}
      >
        <div>
          <div>
            next available trove: {match(availableTroveIndex)
              .with({ status: "idle" }, () => "−")
              .with({ status: "loading" }, () => "fetching")
              .with({ status: "error" }, () => "error")
              .with({ status: "success" }, ({ data }) => `#${data}`)
              .exhaustive()}
          </div>
          <div>flow: {flow?.request.flowId}</div>
          <div>
            flow steps:{" "}
            {flow?.steps && <>[{flow?.steps.map(({ id, txHash }) => txHash ? `${id} (ok)` : id).join(", ")}]</>}
          </div>
          <div>
            current flow step: {currentStepIndex} ({flow?.steps && flow?.steps[currentStepIndex]?.id})
          </div>
          <div>
            flow step error: <pre>{flow?.steps?.[currentStepIndex]?.error}</pre>
          </div>
        </div>
        {accountAddress && availableTroveIndex.status === "success" && (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 16,
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 16,
              })}
            >
              <Button
                size="mini"
                label={`openLoanPosition (#${availableTroveIndex.data})`}
                onClick={() => {
                  start({
                    flowId: "openLoanPosition",
                    owner: accountAddress,
                    ownerIndex: availableTroveIndex.data,
                    collAmount: dn.from(25, 18),
                    boldAmount: dn.from(2800, 18),
                    upperHint: dn.from(0, 18),
                    lowerHint: dn.from(0, 18),
                    annualInterestRate: dn.from(0.05, 18),
                    maxUpfrontFee: dn.from(100, 18),
                  });
                }}
              />
              <Button
                disabled={openedTroveIndex < 0}
                label={`updateLoanPosition (#${availableTroveIndex.data - 1})`}
                onClick={() => {
                  start({
                    flowId: "updateLoanPosition",
                    owner: accountAddress,
                    ownerIndex: availableTroveIndex.data - 1,
                    collChange: dn.from(1, 18),
                    boldChange: dn.from(0, 18),
                    maxUpfrontFee: dn.from(100, 18),
                  });
                }}
                size="mini"
              />
              <Button
                disabled={openedTroveIndex < 0}
                label={`repayAndCloseLoanPosition (#${availableTroveIndex.data - 1})`}
                onClick={() => {
                  start({
                    flowId: "repayAndCloseLoanPosition",
                    owner: accountAddress,
                    ownerIndex: availableTroveIndex.data - 1,
                  });
                }}
                size="mini"
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 16,
              })}
            >
              <Button
                size="mini"
                label="discard"
                onClick={discard}
                disabled={!flow}
              />
              <Button
                size="mini"
                label="sign & send"
                onClick={() => {
                  if (currentStepIndex >= 0) {
                    signAndSend();
                  }
                }}
                disabled={!flow || currentStepIndex < 0}
              />
            </div>
          </div>
        )}
      </div>
      <Positions />
      <div
        className={css({
          padding: "24px 0 2px",
          border: "1px solid token(colors.tableBorder)",
          borderRadius: 8,
        })}
      >
        <table
          className={css({
            width: "100%",
            fontSize: 14,
            "& th": {
              fontWeight: "inherit",
              whiteSpace: "nowrap",
              textAlign: "left",
            },
            "& th:first-of-type, & td:first-of-type": {
              paddingLeft: 24,
            },
            "& thead tr:first-of-type th": {
              paddingBottom: 28,
              fontSize: 20,
            },
            "& thead tr + tr th": {
              paddingBottom: 8,
              color: "contentAlt2",
            },
            "& tbody td": {
              padding: "12px 0",
              borderTop: "1px solid token(colors.tableBorder)",
            },
          })}
        >
          <thead>
            <tr>
              <th>
                <HFlex gap={12} justifyContent="flex-start">
                  <TokenIcon symbol="LQTY" />
                  <div>Markets</div>
                </HFlex>
              </th>
              <th colSpan={3}>
                <HFlex gap={12} justifyContent="flex-start">
                  <IconBorrow />
                  <div>Borrow BOLD</div>
                </HFlex>
              </th>
              <th colSpan={3}>
                <HFlex gap={12} justifyContent="flex-start">
                  <IconEarn />
                  <div>
                    Earn pools
                  </div>
                </HFlex>
              </th>
            </tr>
            <tr>
              <th>Token</th>
              <th
                className={css({
                  width: 0,
                  paddingRight: 48,
                })}
              >
                <HFlex gap={6}>
                  <div>Borrow rate</div>
                  <InfoTooltip {...infoTooltipProps(content.home.infoTooltips.avgInterestRate)} />
                </HFlex>
              </th>
              <th
                className={css({
                  width: 0,
                  paddingRight: 48,
                })}
              >
                <HFlex gap={6}>
                  <div>TVL</div>
                  <InfoTooltip {...infoTooltipProps(content.home.infoTooltips.borrowTvl)} />
                </HFlex>
              </th>
              <th />
              <th
                className={css({
                  width: 0,
                  paddingRight: 48,
                })}
              >
                <HFlex gap={6}>
                  <div>Earn APR</div>
                  <InfoTooltip {...infoTooltipProps(content.home.infoTooltips.spApr)} />
                </HFlex>
              </th>
              <th
                className={css({
                  width: 0,
                  paddingRight: 48,
                })}
              >
                <HFlex gap={6}>
                  <div>TVL</div>
                  <InfoTooltip {...infoTooltipProps(content.home.infoTooltips.spTvl)} />
                </HFlex>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {DEMO_MODE && COLLATERALS.map(({ symbol, name }) => {
              const borrowStats = BORROW_STATS[symbol];
              const earnPool = EARN_POOLS[symbol];
              return (
                <tr key={symbol}>
                  <td>
                    <HFlex gap={12} justifyContent="flex-start">
                      <TokenIcon symbol={symbol} />
                      <div>{name}</div>
                    </HFlex>
                  </td>
                  <td>
                    {dn.format(
                      dn.mul(borrowStats.borrowRate, 100),
                      { digits: 2, trailingZeros: true },
                    )}%
                  </td>
                  <td>
                    ${dn.format(borrowStats.tvl, { compact: true })}
                  </td>
                  <td>
                    <Link
                      href={`/borrow/${symbol.toLowerCase()}`}
                      legacyBehavior
                      passHref
                    >
                      <AnchorButton
                        label="Borrow"
                        size="mini"
                        title={`Borrow ${name}`}
                      />
                    </Link>
                  </td>
                  <td>
                    {dn.format(
                      dn.mul(earnPool.apr, 100),
                      { digits: 2, trailingZeros: true },
                    )}%
                  </td>
                  <td>
                    ${dn.format(earnPool.boldQty, { compact: true })}
                  </td>
                  <td>
                    <Link
                      href={`/earn/${symbol.toLowerCase()}`}
                      legacyBehavior
                      passHref
                    >
                      <AnchorButton
                        title="Earn with bold"
                        label="Earn"
                        size="mini"
                      />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        className={css({
          paddingTop: 16,
        })}
      >
        <ProtocolStats />
      </div>
    </div>
  );
}

function ProtocolStats() {
  const prices = [
    ["LQTY", usePrice("LQTY")],
    ["BOLD", usePrice("BOLD")],
    ["ETH", usePrice("ETH")],
  ] as const;

  const totalTvl = Object.values(BORROW_STATS).reduce(
    (acc, { tvl }) => dn.add(acc, tvl),
    dn.from(0, 18),
  );

  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 0 20px",
        fontSize: 12,
        borderTop: "1px solid token(colors.tableBorder)",
      })}
    >
      <div>{content.home.statsBar.label}</div>
      <HFlex gap={32}>
        <HFlex gap={8}>
          <span>TVL</span>{" "}
          <span>
            ${dn.format(totalTvl, { compact: true })}
          </span>
        </HFlex>
        {prices.map(([symbol, price]) => {
          return price && (
            <HFlex
              key={symbol}
              gap={16}
            >
              <TokenIcon
                size={16}
                symbol={symbol}
              />
              <HFlex gap={8}>
                <span>{symbol}</span>
                <span>
                  ${dn.format(price, {
                    digits: 2,
                    trailingZeros: true,
                  })}
                </span>
              </HFlex>
            </HFlex>
          );
        })}
      </HFlex>
    </div>
  );
}
