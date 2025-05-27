"use client";

import type { Dnum } from "@/src/types";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { usePrice } from "@/src/services/Prices";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  InputField,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { useTransactionFlow } from "@/src/services/TransactionFlow";

export function BuyScreen() {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collPrice = usePrice("WBTC");
  const collBalance = useBalance(account.address, "WBTC")

  const maxAmount = collBalance.data && dnumMax(
    dn.sub(collBalance.data, 0), // Only keep a reserve for ETH, not LSTs
    dnum18(0),
  );
  const [buyAmount, setBuyAmount] = useState<Dnum | null>(null);
  const sellAmount = useInputFieldValue(fmtnum, {
    validate: (parsed, _) => {
      parsed = parsed ?? dnum18(0);
      const amount = maxAmount && dn.gt(parsed, maxAmount) ? maxAmount : parsed;
      setBuyAmount(dn.mul(collPrice.data ?? dnum18(0), amount));
      return {
        parsed: amount,
        value: dn.toString(amount),
      };
    },
  });

  return collPrice.data && (
    <Screen
      heading={{
        title: "Buy bvUSD with any token",
        subtitle: "You can adjust your loans, including your interest rate at any time",
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
          // “You sell
          field={
            <InputField
              id="input-sell"
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="WBTC" />}
                  label="WBTC"
                />
              }
              label="Sell Amount"
              placeholder="0.00"
              secondary={{
                start: `$${sellAmount.parsed && collPrice.data
                  ? fmtnum(dn.mul(collPrice.data, sellAmount.parsed), "2z")
                  : "0.00"
                  }`,
                end: maxAmount && dn.gt(maxAmount, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} WBTC`}
                    onClick={() => {
                      sellAmount.setValue(dn.toString(maxAmount));
                      setBuyAmount(dn.mul(collPrice.data ?? dnum18(0), maxAmount));
                    }}
                  />
                ),
              }}
              {...sellAmount.inputFieldProps}
            />
          }
          footer={{
            start: collPrice.data && (
              <Field.FooterInfoCollPrice
                collPriceUsd={collPrice.data}
                collName="WBTC"
              />
            ),
          }}
        />

        <Field
          // “You buy
          field={
            <InputField
              id="input-buy"
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="bvUSD" />}
                  label="bvUSD"
                />
              }
              label="Buy Amount"
              placeholder="0.00"
              secondary={{
                start: `$${buyAmount
                  ? fmtnum(buyAmount)
                  : "0.00"
                  }`,
              }}
              value={buyAmount ? fmtnum(buyAmount) : ""}
              disabled
            />
          }
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          }}
        >
            <Button
              disabled={true}
              label={"Coming Soon"}
              mode="primary"
              size="medium"
              shape="rectangular"
              wide
              onClick={() => {
                if (
                  sellAmount.parsed && account.address
                ) {
                  txFlow.start({
                    flowId: "buyStable",
                    backLink: [
                      `/buy`,
                      "Back to buying",
                    ],
                    successLink: ["/", "Go to the Dashboard"],
                    successMessage: "Bought bvUSD successfully.",
                    amount: [sellAmount.parsed[0] / BigInt(10 ** 10), 8],
                    token: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", // WBTC
                  });
                }
              }}
            />
        </div>
      </div>
    </Screen>
  );
}
