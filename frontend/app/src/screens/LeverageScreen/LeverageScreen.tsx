"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address, Dnum, PositionLoanUncommitted } from "@/src/types";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import {
  LeverageField,
  useLeverageField,
} from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import {
  DATA_REFRESH_INTERVAL,
  ETH_MAX_RESERVE,
  INTEREST_RATE_DEFAULT,
  LEVERAGE_MAX_SLIPPAGE,
  MAX_COLLATERAL_DEPOSITS,
  MIN_DEBT,
} from "@/src/constants";
import content from "@/src/content";
import { getContracts, getProtocolContract } from "@/src/contracts";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getOpenLeveragedTroveParams } from "@/src/liquity-leverage";
import { getRedemptionRisk } from "@/src/liquity-math";
import { getCollIndexFromSymbol } from "@/src/liquity-utils";
import { useDebouncedQueryKey } from "@/src/react-utils";
import {
  useAccount,
  useBalance,
  useWagmiConfig,
} from "@/src/services/Arbitrum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useTrovesCount } from "@/src/subgraph-hooks";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  ADDRESS_ZERO,
  Button,
  COLLATERALS as COLL_TOKENS,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  isCollateralSymbol,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";

export function LeverageScreen() {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const contracts = getContracts();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = String(
    useParams().collateral ?? contracts.collaterals[0].symbol
  ).toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const collIndex = getCollIndexFromSymbol(collSymbol);
  if (collIndex === null) {
    throw new Error(`Unknown collateral symbol: ${collSymbol}`);
  }

  const collateralTokens = contracts.collaterals.map(({ symbol }) => {
    const collateral = COLL_TOKENS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  });

  const collToken = collateralTokens[collIndex];

  const balances = Object.fromEntries(
    collateralTokens.map(
      ({ symbol }) => [symbol, useBalance(account.address, symbol)] as const
    )
  );

  const troveCount = useTrovesCount(account.address ?? null, collIndex);
  const collPrice = usePrice(collToken.symbol);

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol] ?? null;
  const depositPreLeverage = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax =
        maxCollDeposit && parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const [interestRate, setInterestRate] = useState(
    dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100)
  );
  const [interestRateMode, setInterestRateMode] =
    useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] =
    useState<Address | null>(null);

  const leverageField = useLeverageField({
    depositPreLeverage: depositPreLeverage.parsed,
    collPrice: collPrice ?? dn.from(0, 18),
    collToken,
  });

  useEffect(() => {
    // reset leverage when collateral changes
    leverageField.updateLeverageFactor(
      leverageField.leverageFactorSuggestions[0]
    );
  }, [collToken.symbol, leverageField.leverageFactorSuggestions]);

  const redemptionRisk = getRedemptionRisk(interestRate);
  const depositUsd =
    depositPreLeverage.parsed &&
    collPrice &&
    dn.mul(depositPreLeverage.parsed, collPrice);

  const collBalance = balances[collToken.symbol].data;

  const maxAmount =
    collBalance &&
    dnumMax(
      dn.sub(collBalance, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0), // Only keep a reserve for ETH, not LSTs
      dnum18(0)
    );

  const newLoan: PositionLoanUncommitted = {
    type: "leverage",
    status: "active",
    batchManager: interestRateDelegate,
    borrowed: leverageField.debt ?? dn.from(0, 18),
    borrower: account.address ?? ADDRESS_ZERO,
    collIndex,
    deposit: depositPreLeverage.parsed
      ? dn.mul(depositPreLeverage.parsed, leverageField.leverageFactor)
      : dn.from(0, 18),
    interestRate,
    troveId: null,
  };

  const hasDeposit = Boolean(
    depositPreLeverage.parsed && dn.gt(depositPreLeverage.parsed, 0)
  );

  const leverageSlippage = useCheckLeverageSlippage({
    initialDeposit: depositPreLeverage.parsed,
    leverageFactor: leverageField.leverageFactor,
    ownerIndex: troveCount.data ?? null,
    loan: newLoan,
  });

  const leverageSlippageElements = useSlippageElements(
    leverageSlippage,
    hasDeposit && account.isConnected
  );

  const hasAllowedSlippage =
    leverageSlippage.data &&
    dn.lte(leverageSlippage.data, LEVERAGE_MAX_SLIPPAGE);

  const leverageFieldDrawer =
    hasDeposit && newLoan.borrowed && dn.lt(newLoan.borrowed, MIN_DEBT)
      ? {
          mode: "error" as const,
          message: `You must borrow at least ${fmtnum(MIN_DEBT, 2)} USDN.`,
        }
      : leverageSlippageElements.drawer;

  const allowSubmit =
    account.isConnected &&
    hasDeposit &&
    interestRate &&
    dn.gt(interestRate, 0) &&
    leverageField.debt &&
    dn.gt(leverageField.debt, 0) &&
    hasAllowedSlippage;

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.leverageScreen.headline(
              <TokenIcon.Group>
                {contracts.collaterals.map(({ symbol }) => (
                  <TokenIcon key={symbol} symbol={symbol} />
                ))}
              </TokenIcon.Group>
            )}
          </HFlex>
        ),
      }}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <Field
          field={
            <InputField
              id='input-deposit'
              contextual={
                <Dropdown
                  items={collateralTokens.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol].data ?? 0)
                      : "−",
                  }))}
                  menuPlacement='end'
                  menuWidth={300}
                  onSelect={(index) => {
                    setTimeout(() => {
                      depositPreLeverage.setValue("");
                      depositPreLeverage.focus();
                    }, 0);
                    const { symbol } = collateralTokens[index];
                    router.push(`/leverage/${symbol.toLowerCase()}`, {
                      scroll: false,
                    });
                  }}
                  selected={collIndex}
                />
              }
              label={content.leverageScreen.depositField.label}
              placeholder='0.00'
              secondary={{
                start: depositUsd && `$${fmtnum(depositUsd, "2z")}`,
                end: maxAmount ? (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} ${collToken.name}`}
                    onClick={() => {
                      depositPreLeverage.setValue(dn.toString(maxAmount));
                    }}
                  />
                ) : (
                  "Fetching balance…"
                ),
              }}
              {...depositPreLeverage.inputFieldProps}
            />
          }
          footer={{
            start: collPrice && (
              <Field.FooterInfoCollPrice
                collName={collToken.name}
                collPriceUsd={collPrice}
              />
            ),
            end: (
              <Field.FooterInfoMaxLtv
                maxLtv={dn.div(dn.from(1, 18), collToken.collateralRatio)}
              />
            ),
          }}
        />

        <Field
          field={
            <LeverageField
              drawer={leverageFieldDrawer}
              inputId='input-liquidation-price'
              onDrawerClose={leverageSlippageElements.onClose}
              {...leverageField}
            />
          }
          footer={{
            start: (
              <>
                <Field.FooterInfoLiquidationRisk
                  riskLevel={leverageField.liquidationRisk}
                />
                <Field.FooterInfoLoanToValue
                  ltvRatio={leverageField.ltv}
                  maxLtvRatio={leverageField.maxLtv}
                />
              </>
            ),
            end: (
              <Field.FooterInfo
                label='Exposure'
                value={
                  <HFlex gap={8}>
                    <div
                      className={css({
                        flexShrink: 1,
                        display: "flex",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      <Amount
                        value={
                          leverageField.deposit &&
                          dn.gt(leverageField.deposit, 0)
                            ? leverageField.deposit
                            : null
                        }
                        format='2z'
                        fallback='−'
                        suffix={` ${collToken.name}`}
                      />
                    </div>
                    <InfoTooltip
                      {...infoTooltipProps(
                        content.leverageScreen.infoTooltips.exposure
                      )}
                    />
                  </HFlex>
                }
              />
            ),
          }}
        />

        <Field
          field={
            <InterestRateField
              collIndex={collIndex}
              debt={leverageField.debt}
              delegate={interestRateDelegate}
              inputId='input-interest-rate'
              interestRate={interestRate}
              mode={interestRateMode}
              onChange={setInterestRate}
              onDelegateChange={setInterestRateDelegate}
              onModeChange={setInterestRateMode}
            />
          }
          footer={{
            start: (
              <Field.FooterInfoRedemptionRisk riskLevel={redemptionRisk} />
            ),
            end: (
              <span
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "contentAlt",
                })}
              >
                <IconSuggestion size={16} />
                <span>You can adjust interest rate later</span>
              </span>
            ),
          }}
        />

        <RedemptionInfo />

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          })}
        >
          <ConnectWarningBox />
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
            })}
          >
            <Button
              disabled={!allowSubmit}
              label={content.leverageScreen.action}
              mode='primary'
              size='large'
              wide
              onClick={() => {
                if (
                  depositPreLeverage.parsed &&
                  leverageField.debt &&
                  account.address
                ) {
                  txFlow.start({
                    flowId: "openLeveragePosition",
                    backLink: ["/leverage", "Back to editing"],
                    successLink: ["/", "Go to the Dashboard"],
                    successMessage:
                      "The leveraged position has been created successfully.",

                    ownerIndex: troveCount.data ?? 0,
                    leverageFactor: leverageField.leverageFactor,
                    loan: newLoan,
                  });
                }
              }}
            />

            {leverageSlippageElements.mode === "error" ? (
              <div
                className={css({
                  color: "negative",
                })}
              >
                {leverageSlippageElements.message}
              </div>
            ) : (
              <div>{leverageSlippageElements.message}</div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}

export function useCheckLeverageSlippage({
  initialDeposit,
  leverageFactor,
  loan,
  ownerIndex,
}: {
  initialDeposit: Dnum | null;
  leverageFactor: number;
  loan: PositionLoanUncommitted;
  ownerIndex: number | null;
}) {
  const { collIndex } = loan;
  const wagmiConfig = useWagmiConfig();
  const WethContract = getProtocolContract("WETH");
  const ExchangeHelpersContract = getProtocolContract("ExchangeHelpers");

  const debouncedQueryKey = useDebouncedQueryKey(
    [
      "openLeveragedTroveParams",
      collIndex,
      String(!initialDeposit || initialDeposit[0]),
      leverageFactor,
      ownerIndex,
    ],
    100
  );

  const openLeveragedTroveParams = useQuery({
    queryKey: debouncedQueryKey,
    queryFn: () =>
      initialDeposit &&
      getOpenLeveragedTroveParams(
        collIndex,
        initialDeposit[0],
        leverageFactor,
        wagmiConfig
      ),
    enabled: Boolean(
      initialDeposit && dn.gt(initialDeposit, 0) && ownerIndex !== null
    ),
    refetchInterval: DATA_REFRESH_INTERVAL,
  });

  const boldAmount = openLeveragedTroveParams.data?.expectedBoldAmount ?? 0n;
  const flashLoanAmount = openLeveragedTroveParams.data?.flashLoanAmount ?? 0n;

  return useReadContract({
    abi: ExchangeHelpersContract.abi,
    address: ExchangeHelpersContract.address,
    functionName: "getCollFromBold",
    args: [boldAmount, WethContract.address, flashLoanAmount],
    query: {
      enabled: Boolean(openLeveragedTroveParams.data),
      select: (result) => dnum18(result[1]),
    },
  });
}

function useSlippageElements(
  leverageSlippage: ReturnType<typeof useCheckLeverageSlippage>,
  ready: boolean
): {
  mode: "error" | "loading" | "success";
  drawer: ComponentPropsWithoutRef<typeof LeverageField>["drawer"];
  message?: ReactNode;
  onClose: () => void;
} {
  const [forceDrawerClosed, setForceDrawerClosed] = useState(false);

  useEffect(() => {
    setForceDrawerClosed(false);
  }, [leverageSlippage.status]);

  const onClose = () => {
    setForceDrawerClosed(true);
  };

  if (forceDrawerClosed || !ready) {
    return {
      drawer: null,
      mode: "success",
      onClose,
    };
  }

  if (leverageSlippage.status === "error") {
    const retry = (
      <TextButton
        size='small'
        label='retry'
        onClick={() => {
          leverageSlippage.refetch();
        }}
      />
    );
    return {
      drawer: {
        mode: "error",
        message: (
          <HFlex gap={4}>
            <div>Slippage calculation failed.</div>
            {retry}
          </HFlex>
        ),
      },
      message: (
        <VFlex gap={4}>
          <div>
            Slippage calculation failed. ({leverageSlippage.error.message})
          </div>
          {retry}
        </VFlex>
      ),
      mode: "error",
      onClose,
    };
  }

  if (
    leverageSlippage.status === "pending" ||
    leverageSlippage.fetchStatus === "fetching"
  ) {
    const message = "Calculating slippage…";
    return {
      drawer: null,
      // drawer: { mode: "loading", message },
      message,
      mode: "loading",
      onClose,
    };
  }

  if (
    leverageSlippage.data &&
    dn.gt(leverageSlippage.data, LEVERAGE_MAX_SLIPPAGE)
  ) {
    const message = (
      <>
        Slippage too high: {fmtnum(leverageSlippage.data, 2, 100)}% (max{" "}
        {fmtnum(LEVERAGE_MAX_SLIPPAGE, 2, 100)}%)
      </>
    );
    return {
      drawer: { mode: "error", message },
      message,
      mode: "error",
      onClose,
    };
  }

  return {
    drawer: null,
    // drawer: {
    //   mode: "success",
    //   message: `Slippage below threshold (${fmtnum(LEVERAGE_MAX_SLIPPAGE, 2, 100)}%)`,
    //   autoClose: 700,
    // },
    onClose,
    mode: "success",
  };
}
