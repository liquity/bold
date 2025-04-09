"use client";

import type { Dnum } from "@/src/types";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { dnum18, dnum8, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  InputField,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { AccountButton } from "@/src/comps/AppLayout/AccountButton";
import { useTransactionFlow } from "@/src/services/TransactionFlow";


export function WrapScreen() {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const wbtcBalance = useBalance(account.address, "WBTC");
  const btcbBalance = useBalance(account.address, "BTCB");

  const collBalance = wbtcBalance;
  if (!collBalance) {
    throw new Error(`Unknown collateral symbol: WBTC`);
  }
  const maxAmount = collBalance.data

  const [buyAmount, setBuyAmount] = useState<Dnum | null>(null);
  const sellAmount = useInputFieldValue(fmtnum, {
    validate: (parsed, _) => {
      parsed = parsed ?? dnum8(0);
      const amount = maxAmount && dn.gt(parsed, maxAmount) ? maxAmount : parsed;
      setBuyAmount(amount);
      return {
        parsed: amount,
        value: dn.toString(amount),
      };
    },
  });

  return (
    <Screen
      heading={{
        title: "Wrap WBTC for usage in Troves",
        subtitle: "",
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
                  icon={<TokenIcon symbol="BTCB" />}
                  label="WBTC"
                />
              }
              label="Wrap Amount"
              placeholder="0.00"
              secondary={{
                start: `${sellAmount.parsed
                  ? fmtnum(sellAmount.parsed, "2z") + " WBTC"
                  : "0.00 WBTC"
                  }`,
                end: maxAmount && dn.gt(maxAmount, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} WBTC`}
                    onClick={() => {
                      sellAmount.setValue(dn.toString(maxAmount));
                      setBuyAmount(maxAmount);
                    }}
                  />
                ),
              }}
              {...sellAmount.inputFieldProps}
            />
          }
        />

        <Field
          // “You buy
          field={
            <InputField
              id="input-buy"
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="BTCB" />}
                  label="BTCB"
                />
              }
              label="Wrapped Amount"
              placeholder="0.00"
              secondary={{
                start: `${buyAmount
                  ? fmtnum(buyAmount) + " BTCB"
                  : "0.00 BTCB"
                  }`,
                end: `${btcbBalance
                  ? fmtnum(btcbBalance.data) + " BTCB"
                  : "0.00 BTCB"
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
          {account.isConnected ?
            <Button
              label="Next: Summary"
              mode="primary"
              size="medium"
              shape="rectangular"
              wide
              onClick={() => {
                if (
                  sellAmount.parsed && account.address
                ) {
                  txFlow.start({
                    flowId: "wrapToken",
                    backLink: [
                      `/wrap`,
                      "Back to wrapping",
                    ],
                    successLink: ["/", "Go to the Dashboard"],
                    successMessage: "The position has been created successfully.",
                    amount: [sellAmount.parsed[0] / BigInt(10 ** 10), 8],
                    token: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
                  });
                }
              }}
            />
            : <AccountButton />
          }
        </div>
      </div>
    </Screen>
  );
}
