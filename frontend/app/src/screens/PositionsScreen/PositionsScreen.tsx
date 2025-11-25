"use client";

import type { BranchId, Dnum, RiskLevel } from "@/src/types";
import type { OpenPosition } from "@/src/subgraph";

import * as dn from "dnum";
import { Screen } from "@/src/comps/Screen/Screen";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken, useAllOpenPositions, useLiquidatedPositions } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import {
  HFlex,
  IconExternal,
  shortenAddress,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import { useState, useMemo } from "react";

type SortField = "debt" | "deposit" | "ltv" | "interestRate" | "liquidationPrice" | "health";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 15;

export function PositionsScreen() {
  const openPositions = useAllOpenPositions();
  const liquidatedPositions = useLiquidatedPositions();
  const [activeTab, setActiveTab] = useState<"active" | "liquidated">("active");
  const [sortField, setSortField] = useState<SortField>("ltv");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [branchFilter, setBranchFilter] = useState<BranchId | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const positions = activeTab === "active" ? openPositions.data : liquidatedPositions.data;
  const isLoading = activeTab === "active" ? openPositions.isLoading : liquidatedPositions.isLoading;

  // Get unique branches from positions
  const availableBranches = useMemo(() => {
    if (!positions) return [];
    const branches = new Set(positions.map(p => p.branchId));
    return Array.from(branches).sort();
  }, [positions]);

  // Filter by branch
  const filteredPositions = useMemo(() => {
    if (!positions) return [];
    if (branchFilter === "all") return positions;
    return positions.filter(p => p.branchId === branchFilter);
  }, [positions, branchFilter]);

  // Enrich positions with calculated data for sorting
  const enrichedPositions = useMemo(() => {
    return filteredPositions.map(position => {
      const collToken = getCollToken(position.branchId);
      return {
        ...position,
        collToken,
      };
    });
  }, [filteredPositions]);

  // Sort positions
  const sortedPositions = useMemo(() => {
    if (!enrichedPositions.length) return [];

    return [...enrichedPositions].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "debt":
          comparison = dn.cmp(a.debt, b.debt);
          break;
        case "deposit":
          comparison = dn.cmp(a.deposit, b.deposit);
          break;
        case "interestRate":
          comparison = dn.cmp(a.interestRate, b.interestRate);
          break;
        case "ltv":
        case "liquidationPrice":
        case "health":
          // For these fields, we sort by debt as proxy (higher debt = higher risk typically)
          // The actual LTV calculation happens per-row with real-time prices
          comparison = dn.cmp(a.debt, b.debt);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [enrichedPositions, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedPositions.length / ITEMS_PER_PAGE);
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedPositions.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedPositions, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  const handleFilterChange = (value: BranchId | "all") => {
    setBranchFilter(value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  return (
    <>
      {/* Hero Section */}
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
            All Positions
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
              padding: "0 28px",
            })}
          >
            View all open positions across the protocol and monitor liquidation risk.
          </p>
        </div>
      </div>

      <Screen
        width="100%"
        heading={null}
      >
        {/* Main Content */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 24,
            paddingTop: 100,
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto",
          })}
        >
          {/* Controls Row */}
          <div
            className={css({
              display: "flex",
              flexDirection: { base: "column", medium: "row" },
              gap: 16,
              alignItems: { base: "stretch", medium: "center" },
              justifyContent: "space-between",
            })}
          >
            {/* Left: Tabs + Stats */}
            <div
              className={css({
                display: "flex",
                flexDirection: { base: "column", medium: "row" },
                gap: 16,
                alignItems: { base: "stretch", medium: "center" },
              })}
            >
              {/* Tabs */}
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                })}
              >
                <TabButton
                  active={activeTab === "active"}
                  onClick={() => { setActiveTab("active"); setCurrentPage(1); }}
                  count={openPositions.data?.length}
                >
                  Active
                </TabButton>
                <TabButton
                  active={activeTab === "liquidated"}
                  onClick={() => { setActiveTab("liquidated"); setCurrentPage(1); }}
                  count={liquidatedPositions.data?.length}
                >
                  Liquidated
                </TabButton>
              </div>

              {/* Stats */}
              {openPositions.data && (
                <div
                  className={css({
                    display: "flex",
                    gap: 12,
                  })}
                >
                  <StatCard
                    label="Total Positions"
                    value={openPositions.data.length.toString()}
                  />
                  <StatCard
                    label="Total Debt"
                    value={`${fmtnum(
                      openPositions.data.reduce(
                        (sum, p) => dn.add(sum, p.debt),
                        [0n, 18] as Dnum
                      ),
                      0
                    )} MUST`}
                  />
                </div>
              )}
            </div>

            {/* Right: Filter */}
            <div className={css({ display: "flex", alignItems: "center", gap: 8 })}>
              <span className={css({ color: "positionContentAlt", fontSize: 14, whiteSpace: "nowrap" })}>
                Filter:
              </span>
              <select
                value={branchFilter}
                onChange={(e) => handleFilterChange(e.target.value === "all" ? "all" : Number(e.target.value) as BranchId)}
                className={css({
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(0, 0, 0, 0.5)",
                  color: "white",
                  fontSize: 14,
                  cursor: "pointer",
                  "&:focus": {
                    outline: "2px solid token(colors.focused)",
                  },
                })}
              >
                <option value="all">All Collaterals</option>
                {availableBranches.map((branchId) => {
                  const token = getCollToken(branchId);
                  return (
                    <option key={branchId} value={branchId}>
                      {token?.symbol || `Branch ${branchId}`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Table Card */}
          <div
            className={css({
              background: "rgba(0, 0, 0, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              overflow: "hidden",
            })}
          >
            {isLoading ? (
              <div className={css({ textAlign: "center", padding: 48, color: "contentAlt" })}>
                Loading positions...
              </div>
            ) : !sortedPositions || sortedPositions.length === 0 ? (
              <div className={css({ textAlign: "center", padding: 48, color: "contentAlt" })}>
                No {activeTab} positions found
              </div>
            ) : (
              <>
                <div
                  className={css({
                    width: "100%",
                    overflowX: "auto",
                  })}
                >
                  <table
                    className={css({
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    })}
                  >
                    <thead>
                      <tr
                        className={css({
                          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          "& th": {
                            padding: "16px 20px",
                            textAlign: "left",
                            fontWeight: 500,
                            color: "positionContentAlt",
                            whiteSpace: "nowrap",
                          },
                        })}
                      >
                        <th>Owner</th>
                        <th>Collateral</th>
                        <SortableHeader field="deposit" current={sortField} direction={sortDirection} onSort={handleSort}>
                          Deposit
                        </SortableHeader>
                        <SortableHeader field="debt" current={sortField} direction={sortDirection} onSort={handleSort}>
                          Debt
                        </SortableHeader>
                        <SortableHeader field="ltv" current={sortField} direction={sortDirection} onSort={handleSort}>
                          LTV
                        </SortableHeader>
                        <SortableHeader field="interestRate" current={sortField} direction={sortDirection} onSort={handleSort}>
                          Interest
                        </SortableHeader>
                        <th>Liq. Price</th>
                        <th>Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPositions.map((position) => (
                        <PositionRow
                          key={position.id}
                          position={position}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    })}
                  >
                    <div className={css({ color: "positionContentAlt", fontSize: 13 })}>
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedPositions.length)} of {sortedPositions.length}
                    </div>
                    <div className={css({ display: "flex", gap: 8 })}>
                      <PaginationButton
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </PaginationButton>
                      <div className={css({ display: "flex", alignItems: "center", gap: 4 })}>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={css({
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: "1px solid",
                                borderColor: currentPage === pageNum ? "rgba(161, 137, 171, 0.5)" : "rgba(255, 255, 255, 0.15)",
                                background: currentPage === pageNum ? "rgba(161, 137, 171, 0.2)" : "transparent",
                                color: currentPage === pageNum ? "white" : "rgba(255, 255, 255, 0.7)",
                                fontSize: 13,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                "&:hover": {
                                  borderColor: "rgba(255, 255, 255, 0.3)",
                                  background: "rgba(255, 255, 255, 0.05)",
                                },
                              })}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <PaginationButton
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </PaginationButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Screen>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={css({
        padding: "10px 16px",
        borderRadius: 8,
        background: "rgba(0, 0, 0, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        minWidth: 100,
      })}
    >
      <div className={css({ fontSize: 10, color: "positionContentAlt", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" })}>
        {label}
      </div>
      <div className={css({ fontSize: 16, fontWeight: 600, color: "white" })}>
        {value}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={css({
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 500,
        borderRadius: 8,
        border: "1px solid",
        borderColor: active ? "rgba(161, 137, 171, 0.5)" : "rgba(255, 255, 255, 0.15)",
        background: active ? "rgba(161, 137, 171, 0.2)" : "rgba(0, 0, 0, 0.5)",
        color: active ? "white" : "rgba(255, 255, 255, 0.7)",
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover": {
          borderColor: active ? "rgba(161, 137, 171, 0.7)" : "rgba(255, 255, 255, 0.25)",
          background: active ? "rgba(161, 137, 171, 0.3)" : "rgba(255, 255, 255, 0.08)",
        },
      })}
    >
      {children}
      {count !== undefined && (
        <span
          className={css({
            marginLeft: 8,
            padding: "2px 8px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.1)",
            fontSize: 12,
          })}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={css({
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        border: "1px solid rgba(255, 255, 255, 0.15)",
        background: "transparent",
        color: "rgba(255, 255, 255, 0.7)",
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover:not(:disabled)": {
          borderColor: "rgba(255, 255, 255, 0.3)",
          background: "rgba(255, 255, 255, 0.05)",
          color: "white",
        },
        "&:disabled": {
          opacity: 0.4,
          cursor: "not-allowed",
        },
      })}
    >
      {children}
    </button>
  );
}

function SortableHeader({
  field,
  current,
  direction,
  onSort,
  children,
}: {
  field: SortField;
  current: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <th
      onClick={() => onSort(field)}
      className={css({
        cursor: "pointer",
        userSelect: "none",
        "&:hover": {
          color: "white",
        },
      })}
    >
      <HFlex gap={4} alignItems="center">
        {children}
        <span className={css({ fontSize: 10, opacity: isActive ? 1 : 0.3 })}>
          {isActive ? (direction === "asc" ? "▲" : "▼") : "▼"}
        </span>
      </HFlex>
    </th>
  );
}

function PositionRow({ position }: { position: OpenPosition & { collToken: ReturnType<typeof getCollToken> } }) {
  const collToken = position.collToken;
  const collPrice = usePrice(collToken?.symbol ?? null);

  // Calculate loan details
  const loanDetails = useMemo(() => {
    if (!collToken || !collPrice.data) return null;
    return getLoanDetails(
      position.deposit,
      position.debt,
      position.interestRate,
      collToken.collateralRatio,
      collPrice.data
    );
  }, [position, collToken, collPrice.data]);

  const explorerUrl = CHAIN_BLOCK_EXPLORER
    ? `${CHAIN_BLOCK_EXPLORER.url}address/${position.borrower}`
    : null;

  // Determine risk level color
  const getRiskColor = (risk: RiskLevel | null) => {
    switch (risk) {
      case "low": return "#4ade80"; // green
      case "medium": return "#fbbf24"; // yellow
      case "high": return "#ef4444"; // red
      default: return "rgba(255, 255, 255, 0.5)";
    }
  };

  return (
    <tr
      className={css({
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        transition: "background 0.2s",
        "&:hover": {
          background: "rgba(255, 255, 255, 0.02)",
        },
        "& td": {
          padding: "16px 20px",
          verticalAlign: "middle",
        },
      })}
    >
      {/* Owner */}
      <td>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "rgba(255, 255, 255, 0.8)",
              fontFamily: "monospace",
              fontSize: 13,
              textDecoration: "none",
              "&:hover": {
                color: "white",
              },
            })}
          >
            {shortenAddress(position.borrower, 4)}
            <IconExternal size={12} />
          </a>
        ) : (
          <span className={css({ fontFamily: "monospace", fontSize: 13 })}>
            {shortenAddress(position.borrower, 4)}
          </span>
        )}
      </td>

      {/* Collateral */}
      <td>
        <HFlex gap={8} alignItems="center">
          {collToken && <TokenIcon symbol={collToken.symbol} size={24} />}
          <span>{collToken?.symbol || `Branch ${position.branchId}`}</span>
        </HFlex>
      </td>

      {/* Deposit */}
      <td>
        <VFlex gap={2}>
          <span>{fmtnum(position.deposit, 4)}</span>
          {loanDetails?.depositUsd && (
            <span className={css({ fontSize: 12, color: "positionContentAlt" })}>
              ${fmtnum(loanDetails.depositUsd, 2)}
            </span>
          )}
        </VFlex>
      </td>

      {/* Debt */}
      <td>
        <span>{fmtnum(position.debt, 2)} MUST</span>
      </td>

      {/* LTV */}
      <td>
        <span
          style={{
            color: getRiskColor(loanDetails?.liquidationRisk ?? null),
          }}
        >
          {loanDetails?.ltv ? `${fmtnum(dn.mul(loanDetails.ltv, 100), 1)}%` : "-"}
        </span>
      </td>

      {/* Interest Rate */}
      <td>
        {fmtnum(dn.mul(position.interestRate, 100), 2)}%
      </td>

      {/* Liquidation Price */}
      <td>
        {loanDetails?.liquidationPrice ? (
          <span>${fmtnum(loanDetails.liquidationPrice, 2)}</span>
        ) : (
          "-"
        )}
      </td>

      {/* Health */}
      <td>
        <HealthBadge risk={loanDetails?.liquidationRisk ?? null} />
      </td>
    </tr>
  );
}

function HealthBadge({ risk }: { risk: RiskLevel | null }) {
  const config = {
    low: { color: "#4ade80", bg: "rgba(74, 222, 128, 0.1)", label: "Healthy" },
    medium: { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", label: "At Risk" },
    high: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", label: "Critical" },
  };

  const current = risk ? config[risk] : null;

  if (!current) {
    return <span className={css({ color: "positionContentAlt" })}>-</span>;
  }

  return (
    <span
      className={css({
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
      })}
      style={{
        color: current.color,
        background: current.bg,
      }}
    >
      {current.label}
    </span>
  );
}
