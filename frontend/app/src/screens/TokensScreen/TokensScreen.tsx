"use client";

import type { Address, TokenSymbol } from "@/src/types";

import { Screen } from "@/src/comps/Screen/Screen";
import { getBranchContract, getProtocolContract } from "@/src/contracts";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { useCoinGeckoPrices } from "@/src/hooks/useCoinGeckoPrices";
import { useIndicator } from "@/src/services/IndicatorManager";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { css } from "@/styled-system/css";
import {
  HFlex,
  IconExternal,
  isCollateralSymbol,
  shortenAddress,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import { useState } from "react";
import { erc20Abi, isAddressEqual, parseAbi, parseUnits, zeroAddress } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { dnum18 } from "@/src/dnum-utils";

export function TokensScreen() {
  const account = useAccount();
  const accountAddress = account.address;

  const mainToken = WHITE_LABEL_CONFIG.tokens.mainToken;
  const collaterals = WHITE_LABEL_CONFIG.tokens.collaterals;
  const allTokens = [
    { symbol: mainToken.symbol, name: mainToken.name },
    ...collaterals.map(c => ({ symbol: c.symbol, name: c.name }))
  ];

  const prices = useCoinGeckoPrices(allTokens.map(t => t.symbol));

  return (
    <>
      <div
        className={css({
          position: "relative",
          width: "100%",
          marginTop: -96,
          paddingTop: 96,
          marginBottom: -180,
        })}
      >
        <div
          className={`borrow-heading-background ${css({
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100vw",
            height: "100%",
            zIndex: -1,
            backgroundPosition: "center top",
            _after: {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              background: "linear-gradient(to bottom, transparent, black)",
            },
          })}`}
        />
        
        <div
          className={css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0 80px",
            minHeight: "420px",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
          })}
        >
          <h1
            className={`font-audiowide ${css({
              color: "white",
              fontSize: { base: '28px', medium: '37px' },
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 0,
              lineHeight: 1.2,
            })}`}
          >
            Manage Your{" "}
            <span
              className={css({
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                gap: 2,
              })}
            >
              Tokens
            </span>
          </h1>
          <p
            className={css({
              color: "#FFF",
              fontSize: "17px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "16px auto 0",
              lineHeight: "120%",
              fontWeight: 400,
              padding: '0 28px'
            })}
          >
            View your token balances, send tokens to others, and add tokens to your wallet.
          </p>
        </div>
      </div>

      <Screen
        width="100%"
        heading={null}
      >
        {!accountAddress ? (
          <div className={css({ 
            padding: "0 24px 24px", 
            textAlign: "center", 
            color: "contentAlt",
            fontSize: 18,
          })}>
            Please connect your wallet to view your tokens
          </div>
        ) : (
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 16,
              paddingTop: 0,
              width: '100%',
              maxWidth: "536px",
              margin: "0 auto",
            })}
          >
            {allTokens.map((token) => (
              <TokenCard
                key={token.symbol}
                address={accountAddress}
                tokenSymbol={token.symbol}
                tokenName={token.name}
                price={token.symbol === "MUST" ? 1 : prices.data?.[token.symbol]}
              />
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}

function TokenCard({
  address,
  tokenSymbol,
  tokenName,
  price,
}: {
  address: Address;
  tokenSymbol: TokenSymbol;
  tokenName: string;
  price?: number;
}) {
  const balance = useBalance(address, tokenSymbol);
  const [showSendModal, setShowSendModal] = useState(false);

  const isCollateral = isCollateralSymbol(tokenSymbol);

  const tokenContract = isCollateral
    ? getBranchContract(tokenSymbol, "CollToken")
    : tokenSymbol === WHITE_LABEL_CONFIG.tokens.mainToken.symbol
    ? getProtocolContract("BoldToken")
    : null;

  const contractAddress = tokenContract?.address || "0x0000000000000000000000000000000000000000";

  const LeverageWrappedTokenZapper = isCollateral ? getBranchContract(tokenSymbol, "LeverageWrappedTokenZapper") : null;

  const { data: wrappedTokenAddress } = useReadContract({
    ...LeverageWrappedTokenZapper,
    functionName: "wrappedToken",
    query: {
      enabled: Boolean(LeverageWrappedTokenZapper && !isAddressEqual(LeverageWrappedTokenZapper.address, zeroAddress)),
    }
  });

  const wrappedBalance = useReadContract({
    address: wrappedTokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: Boolean(wrappedTokenAddress && address),
    }
  });

  const explorerUrl = CHAIN_BLOCK_EXPLORER
    ? `${CHAIN_BLOCK_EXPLORER.url}address/${contractAddress}`
    : null;

  return (
    <>
      <div
        className={css({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "token(colors.fieldBorder)",
          width: "100%",
          background: "rgba(0, 0, 0, 0.95)",
          color: "token(colors.positionContent)",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.fieldBorder)",
          })}
        >
          <TokenIcon symbol={tokenSymbol} size={34} />
          
          <div
            className={css({
              flexGrow: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            })}
          >
            <div className={css({ flex: 1 })}>
              <div className={css({ fontSize: 16, fontWeight: 500 })}>
                {tokenName}
              </div>
              <div className={css({ fontSize: 14, color: "positionContentAlt" })}>
                {tokenSymbol}
                {price && (
                  <span className={css({ marginLeft: 8 })}>
                    ${price.toFixed(price >= 1 ? 2 : 4)}
                  </span>
                )}
              </div>
            </div>

            <div className={css({ textAlign: "right" })}>
              <div className={css({ fontSize: 14, color: "positionContentAlt" })}>
                Balance
              </div>
              <div
                title={balance.data ? `${fmtnum(balance.data, "full")} ${tokenSymbol}` : "0"}
                className={css({ fontSize: 18, fontWeight: 600 })}
              >
                {balance.data ? fmtnum(balance.data, 5) : "0"}
                <p className={css({ fontSize: 13, color: "positionContentAlt", marginTop: 2 })}>{LeverageWrappedTokenZapper && !isAddressEqual(LeverageWrappedTokenZapper.address, zeroAddress) && wrappedBalance.data && wrappedBalance.data > 0n ? ` (${fmtnum(dnum18(wrappedBalance.data), 5)} wrapped)` : ""}</p>
              </div>
              {balance.data && price && balance.data[0] > 0n && (
                <div className={css({ fontSize: 13, color: "positionContentAlt", marginTop: 2 })}>
                  ${((Number(balance.data[0]) / Math.pow(10, balance.data[1])) * price).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            gap: 12,
            paddingTop: 16,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          })}
        >
          <div className={css({ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" })}>
            <button
              onClick={() => setShowSendModal(true)}
              disabled={!balance.data || balance.data[0] === 0n}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                background: "#A189AB",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover:not(:disabled)": {
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(161, 137, 171, 0.4)",
                  background: "#B199BB",
                },
                "&:active:not(:disabled)": {
                  transform: "translateY(0)",
                },
                "&:disabled": {
                  opacity: 0.4,
                  cursor: "not-allowed",
                },
              })}
            >
              Send
            </button>
            {(!balance.data || balance.data[0] === 0n) && (
              <AddToWalletButton
              tokenAddress={contractAddress}
              tokenSymbol={tokenSymbol}
              tokenDecimals={isCollateralSymbol(tokenSymbol) ? WHITE_LABEL_CONFIG.tokens.collaterals.find(c => c.symbol === tokenSymbol)?.decimals ?? 18 : 18}
              />
            )}
          </div>

          <div className={css({ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" })}>
            {LeverageWrappedTokenZapper !== null && !isAddressEqual(LeverageWrappedTokenZapper.address, zeroAddress) && wrappedBalance.data !== undefined && (
              <UnwrapTokenButton
                account={address}
                wrappedToken={wrappedTokenAddress as Address}
                tokenSymbol={tokenSymbol}
                amount={wrappedBalance.data}
              />
            )}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.7)",
                  textDecoration: "none",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.03)",
                  transition: "all 0.2s",
                  "&:hover": {
                    color: "white",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    background: "rgba(255, 255, 255, 0.08)",
                    transform: "translateY(-1px)",
                  },
                })}
              >
                <span>{shortenAddress(contractAddress, 4)}</span>
                <IconExternal size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {showSendModal && (
        <SendTokenModal
          tokenSymbol={tokenSymbol}
          tokenAddress={contractAddress}
          balance={balance.data}
          decimals={isCollateralSymbol(tokenSymbol) ? WHITE_LABEL_CONFIG.tokens.collaterals.find(c => c.symbol === tokenSymbol)?.decimals ?? 18 : 18}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </>
  );
}

function UnwrapTokenButton({
  account,
  wrappedToken,
  tokenSymbol,
  amount,
}: {
  account: Address;
  wrappedToken: Address;
  tokenSymbol: string;
  amount: bigint;
}) {
  const { writeContract } = useWriteContract();
  const { showSuccess, setError } = useIndicator();

  const handleUnwrap = () => {
    try {
      writeContract({
        address: wrappedToken,
        abi: parseAbi([
          "function withdrawTo(address account, uint256 amount) public returns (bool)"
        ]),
        functionName: "withdrawTo",
        args: [account, amount],
      }, {
        onSuccess: () => {
          showSuccess(`Transaction submitted! Unwrapping ${amount} ${tokenSymbol}`);
        },
        onError: (error) => {
          setError("unwrap-token", `Transaction failed: ${error.message}`);
        },
      });
    } catch (error) {
      setError("unwrap-token", `Invalid amount: ${error}`);
    }
  };

  return (
    <button
      onClick={handleUnwrap}
      disabled={amount === 0n}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: "white",
        background: "#A189AB",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover:not(:disabled)": {
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(161, 137, 171, 0.4)",
          background: "#B199BB",
        },
        "&:active:not(:disabled)": {
          transform: "translateY(0)",
        },
        "&:disabled": {
          opacity: 0.4,
          cursor: "not-allowed",
        },
      })}
    >
      Unwrap
    </button>
  )
}

function AddToWalletButton({
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
}: {
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
}) {
  const handleAddToWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask or compatible wallet not found");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
          },
        },
      });
    } catch (error) {
      console.error("Failed to add token to wallet:", error);
    }
  };

  return (
    <button
      onClick={handleAddToWallet}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: "rgba(255, 255, 255, 0.9)",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover": {
          color: "white",
          background: "rgba(255, 255, 255, 0.1)",
          borderColor: "rgba(255, 255, 255, 0.25)",
          transform: "translateY(-1px)",
        },
        "&:active": {
          transform: "translateY(0)",
        },
      })}
    >
      Add to Wallet
    </button>
  );
}

function SendTokenModal({
  tokenSymbol,
  tokenAddress,
  balance,
  decimals,
  onClose,
}: {
  tokenSymbol: string;
  tokenAddress: Address;
  balance: [bigint, number] | null | undefined;
  decimals: number;
  onClose: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const { writeContract } = useWriteContract();
  const { showSuccess, setError } = useIndicator();

  const handleSend = () => {
    if (!recipient || !amount) {
      setError("send-token", "Please enter recipient and amount");
      return;
    }

    try {
      const parsedAmount = parseUnits(amount, decimals);
      
      writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as Address, parsedAmount],
      }, {
        onSuccess: () => {
          showSuccess(`Transaction submitted! Sending ${amount} ${tokenSymbol}`);
          onClose();
        },
        onError: (error) => {
          setError("send-token", `Transaction failed: ${error.message}`);
        },
      });
    } catch (error) {
      setError("send-token", `Invalid amount: ${error}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      })}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className={css({
          background: "rgba(0, 0, 0, 0.95)",
          border: "1px solid token(colors.fieldBorder)",
          padding: "32px",
          borderRadius: 8,
          minWidth: "400px",
          maxWidth: "90vw",
          color: "positionContent",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <VFlex gap={24}>
          <h2 className={css({ fontSize: 24, color: "white" })}>
            Send {tokenSymbol}
          </h2>

          <VFlex gap={8}>
            <div className={css({ fontSize: 14, color: "positionContentAlt" })}>
              Recipient Address
            </div>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className={css({
                padding: "12px",
                borderRadius: 4,
                border: "1px solid token(colors.fieldBorder)",
                background: "rgba(0, 0, 0, 0.5)",
                color: "white",
                fontSize: 14,
                fontFamily: "monospace",
                "&:focus": {
                  outline: "2px solid token(colors.focused)",
                },
              })}
            />
          </VFlex>

          <VFlex gap={8}>
            <HFlex justifyContent="space-between">
              <div className={css({ fontSize: 14, color: "positionContentAlt" })}>
                Amount
              </div>
              <button
                type="button"
                onClick={() => {
                  if (balance) {
                    const [value, decimals] = balance;
                    setAmount((Number(value) / Math.pow(10, decimals)).toString());
                  }
                }}
                className={css({
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#667eea",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    color: "#764ba2",
                  },
                })}
              >
                Max: {balance ? fmtnum(balance, 5) : "0"}
              </button>
            </HFlex>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className={css({
                padding: "12px",
                borderRadius: 4,
                border: "1px solid token(colors.fieldBorder)",
                background: "rgba(0, 0, 0, 0.5)",
                color: "white",
                fontSize: 14,
                "&:focus": {
                  outline: "2px solid token(colors.focused)",
                },
              })}
            />
          </VFlex>

          <HFlex gap={12} justifyContent="flex-end">
            <button
              onClick={onClose}
              className={css({
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.7)",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  color: "white",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderColor: "rgba(255, 255, 255, 0.25)",
                },
              })}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className={css({
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                background: "#A189AB",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(161, 137, 171, 0.4)",
                  background: "#B199BB",
                },
                "&:active": {
                  transform: "translateY(0)",
                },
              })}
            >
              Send
            </button>
          </HFlex>
        </VFlex>
      </div>
    </div>
  );
}
