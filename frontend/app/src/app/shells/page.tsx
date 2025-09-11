'use client';

import { useMemo, useState } from 'react';
import { getSnailIcon } from '@/src/comps/SnailIcons/snail-icons';
import { css, cx } from '@/styled-system/css';
import { LinkTextButton } from '@/src/comps/LinkTextButton/LinkTextButton';
import { useShellActivitiesOfHolders, useShellBalances } from '@/src/shell-hooks';
import { Address, formatUnits, getAddress, isAddressEqual } from 'viem';
import { CONTRACT_ADDRESSES } from '@/src/contracts';
import { useQuery } from '@tanstack/react-query';
import { CollIndex } from '@/src/types';
import { useLoansByAccounts } from '@/src/subgraph-hooks';
import { getEnsName } from 'viem/ens';
import { getMainnetPublicClient } from '@/src/shellpoints/utils/client';

const LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA = 'yusnd_stability_pool_depositors_data';
const LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA_EXPIRY = 'yusnd_stability_pool_depositors_data_expiry';

function getExpiryTime() {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  // 18:00 UTC today
  const refreshTime = Date.UTC(utcYear, utcMonth, utcDate, 18, 5, 0, 0); // 5 minutes after 18:00 UTC today
  if (refreshTime < now.getTime()) {
    return refreshTime + 1000 * 60 * 60 * 24;
  }
  return refreshTime;
};

function useStabilityPoolDepositors(addresses?: Address[]) {
  return useQuery({
    queryKey: ['stability-pool-depositors', addresses],
    queryFn: async () => {
      if (typeof localStorage !== 'undefined') {
        const stabilityPoolDepositorsLS = localStorage.getItem(LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA);
        const stabilityPoolDepositorsExpiry = localStorage.getItem(LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA_EXPIRY);
        if (stabilityPoolDepositorsLS && stabilityPoolDepositorsExpiry && Number(stabilityPoolDepositorsExpiry) >= Date.now()) {
          return JSON.parse(stabilityPoolDepositorsLS) as { stabilityPool: Record<`0x${string}`, { branch: CollIndex, amount: string, blockNumber: string, decimals: number }[]>, yusnd: Address[] };
        }
      }
      const response = await fetch('/api/stability-pool', {
        method: 'POST',
        body: JSON.stringify({ addresses }),
      });
      const data = await response.json() as {
        success: boolean;
        result: {
          stabilityPool: Record<`0x${string}`, {
            branch: CollIndex;
            amount: string;
            blockNumber: string;
            decimals: number;
          }[]>, 
          yusnd: Address[]
        } | undefined;
        error: string | undefined;
      };
      if (!data.success) {
        throw new Error(data.error);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA, JSON.stringify(data.result));
        localStorage.setItem(LOCAL_STORAGE_STABILITY_POOL_DEPOSITORS_DATA_EXPIRY, getExpiryTime().toString());
      }
      return data.result;
    },
    enabled: addresses && addresses.length > 0,
  })
}

function useEnsNames(addresses?: Address[]) {
  return useQuery({
    queryKey: ['ens-names', addresses],
    queryFn: async () => {
      const client = getMainnetPublicClient();
      if (!addresses) return [];
      return (await Promise.all(addresses.map(address => getEnsName(client, { address })))).map((result, index) => ({ address: addresses[index]!, ensName: result }));
    },
    enabled: addresses && addresses.length > 0,
  })
}

type LeaderboardActivityLabel = 
  | "yUSND"
  | "Balancer"
  | "Bunni"
  | "Camelot"
  | "Spectra"
  | "GoSlow NFT"
  | "Borrowing"
  | "Stability Pool";

function getLeaderboardActivityName(activity: Address): LeaderboardActivityLabel {
  switch (activity.toLowerCase()) {
    case CONTRACT_ADDRESSES.YUSND.toLowerCase():
      return "yUSND";
    case CONTRACT_ADDRESSES.strategies.Balancer.toLowerCase():
      return "Balancer";
    case CONTRACT_ADDRESSES.strategies.Bunni.toLowerCase():
      return "Bunni";
    case CONTRACT_ADDRESSES.strategies.Camelot.toLowerCase():
      return "Camelot";
    case CONTRACT_ADDRESSES.strategies.Spectra.toLowerCase():
      return "Spectra";
    case CONTRACT_ADDRESSES.GoSlowNft.toLowerCase():
      return "GoSlow NFT";
    // case "trove":
    //   return "Borrowing";
    // case "stabilityPool":
    //   return "Stability Pool";
    default:
      throw new Error(`Unknown leaderboard activity: ${activity}`);
  }
}

export default function ShellsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: shellBalances,
    isLoading: isLoadingShellBalances,
    refetch,
    error: errorShellBalances
  } = useShellBalances();
  const shellHolders = shellBalances?.map((balance) => getAddress(balance.holder));
  const {
    data: shellActivitiesOfHolders, 
    isLoading: isLoadingShellActivitiesOfHolders, 
    error: errorShellActivitiesOfHolders
  } = useShellActivitiesOfHolders(shellHolders);
  const {
    data: stabilityPoolDepositors, 
    isLoading: isLoadingStabilityPoolDepositors, 
    error: errorStabilityPoolDepositors
  } = useStabilityPoolDepositors(shellHolders);
  const {
    data: loansByAccounts,
    isLoading: isLoadingLoansByAccounts,
    error: errorLoansByAccounts
  } = useLoansByAccounts(shellHolders);
  const { data: ensNames } = useEnsNames(shellHolders);

  const users = useMemo(() => {
    return shellBalances?.map((balance, index) => {
      const address = getAddress(balance.holder);
      const activities = [
        ...(loansByAccounts && loansByAccounts.some(loan => isAddressEqual(getAddress(loan.borrower), address)) ? ['Borrowing'] : []),
        ...(stabilityPoolDepositors && Object.keys(stabilityPoolDepositors.stabilityPool).some(depositor => isAddressEqual(getAddress(depositor), address)) ? ['Stability Pool'] : []),
        ...(stabilityPoolDepositors && stabilityPoolDepositors.yusnd.some(depositor => isAddressEqual(getAddress(depositor), address)) ? ['yUSND'] : []),
        ...(shellActivitiesOfHolders?.filter(
            (activity) => isAddressEqual(getAddress(activity.holder), address)
          )
          .map((activity) => getLeaderboardActivityName(getAddress(activity.token))) ?? []),
      ] as LeaderboardActivityLabel[];
      return {
        address,
        ensName: ensNames?.find(ensName => isAddressEqual(ensName.address, address))?.ensName ?? null,
        shellpoints: {
          total: parseInt(formatUnits(balance.balance, 18)),
          mostRecent: null,
        },
        activities: activities.length > 0 ? activities : ['Stability Pool'],
        rank: index + 1,
      }
    }) ?? [];
  }, [shellBalances, shellActivitiesOfHolders, stabilityPoolDepositors, loansByAccounts, ensNames]);

  const filteredUsers = useMemo(() => {
    return users?.filter(user => 
      user.address.toLowerCase().includes(searchQuery.toLowerCase())
      || user.ensName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [];
  }, [users, searchQuery]);

  // useEffect(() => {
  //   console.log("shellBalances", shellBalances);
  //   console.log("shellActivitiesOfHolders", shellActivitiesOfHolders);
  //   console.log("stabilityPoolDepositors", Object.keys(stabilityPoolDepositors ?? {}));
  //   console.log("loansByAccounts", loansByAccounts);
  // }, [shellBalances, shellActivitiesOfHolders, stabilityPoolDepositors, loansByAccounts]);

  const isLoading = isLoadingShellBalances || isLoadingShellActivitiesOfHolders || isLoadingStabilityPoolDepositors || isLoadingLoansByAccounts;
  const error = errorShellBalances || errorShellActivitiesOfHolders || errorStabilityPoolDepositors || errorLoansByAccounts;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return css({ background: 'token(colors.yellow:100)', color: 'token(colors.gray:800)', borderColor: 'token(colors.yellow:200)' });
    if (rank === 2) return css({ background: 'token(colors.gray:100)', color: 'token(colors.gray:800)', borderColor: 'token(colors.gray:200)' });
    if (rank === 3) return css({ background: '#fed7aa', color: 'token(colors.gray:800)', borderColor: '#fdba74' }); // orange colors
    return css({ background: 'token(colors.gray:100)', color: 'token(colors.gray:800)', borderColor: 'token(colors.gray:200)' });
  };

  if (isLoading) {
    return (
      <div className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      })}>
        <div className={css({
          textAlign: 'center'
        })}>
          <div className={css({
            animation: 'spin 1s linear infinite',
            borderRadius: '50%',
            height: 48,
            width: 48,
            borderBottom: '2px solid token(colors.blue:600)',
            marginX: 'auto',
            marginBottom: 16
          })}></div>
          <p className={css({
            color: 'token(colors.gray:600)'
          })}>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={css({
        minHeight: '100vh',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      })}>
        <div className={css({
          textAlign: 'center'
        })}>
          <p className={css({
            color: 'token(colors.red:600)',
            marginBottom: 16
          })}>Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            className={css({
              paddingX: 16,
              paddingY: 8,
              background: 'token(colors.blue:600)',
              color: 'white',
              borderRadius: 8,
              transition: 'background-color 0.2s',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                background: 'token(colors.blue:700)'
              }
            })}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css({
      minHeight: '100vh',
      background: 'white'
    })}>
      <div className={css({
        maxWidth: '80rem',
        marginX: 'auto',
        paddingY: 32,
      })}>
        {/* Header */}
        <div className={css({
          marginBottom: 32
        })}>
          <h1 className={css({
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: 'token(colors.gray:900)',
            marginBottom: 8
          })}>
            Shell Points Leaderboard
          </h1>
          <p className={css({
            color: 'token(colors.gray:600)',
            marginY: 16
          })}>
            Shells are Nerite's loyalty reward system. Your shells are already in your wallet. <LinkTextButton label="Read all the details here" href="https://www.nerite.org/writing/shells" target="_blank" rel="noopener noreferrer" /> on how to earn more Shells. 
          </p>
          
          {/* Search Bar */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 24,
            maxWidth: '32rem'
          })}>
            <div className={css({
              position: 'relative',
              flex: 1
            })}>
              <div className={css({
                pointerEvents: 'none',
                position: 'absolute',
                insetY: 0,
                left: 0,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12
              })}>
                <svg className={css({
                  height: 20,
                  width: 20,
                  color: 'token(colors.gray:400)'
                })} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by address or ENS"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={css({
                  display: 'block',
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid token(colors.gray:300)',
                  background: 'white',
                  paddingLeft: 40,
                  paddingRight: 40,
                  paddingY: 8,
                  fontSize: '0.875rem',
                  lineHeight: '1.25',
                  outline: 'none',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  _placeholder: {
                    color: 'token(colors.gray:500)'
                  },
                  _focus: {
                    borderColor: 'token(colors.blue:500)',
                    outline: 'none',
                    ringWidth: 1,
                    ringColor: 'token(colors.blue:500)'
                  }
                })}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={css({
                    position: 'absolute',
                    insetY: 0,
                    right: 0,
                    paddingRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  })}
                  aria-label="Clear search"
                >
                  <svg className={css({
                    height: 20,
                    width: 20,
                    color: 'token(colors.gray:400)',
                    _hover: {
                      color: 'token(colors.gray:600)'
                    }
                  })} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={() => {
                // setLoading(true);
                refetch();
              }}
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                borderRadius: 8,
                border: '1px solid token(colors.gray:300)',
                background: 'white',
                cursor: 'pointer',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s',
                _hover: {
                  background: 'token(colors.gray:50)',
                  borderColor: 'token(colors.gray:400)'
                },
                _active: {
                  transform: 'scale(0.95)'
                }
              })}
              aria-label="Refresh leaderboard"
              disabled={isLoading}
            >
              <svg 
                className={css({
                  height: 20,
                  width: 20,
                  color: isLoading ? 'token(colors.gray:400)' : 'token(colors.gray:600)',
                  animation: isLoading ? 'spin 1s linear infinite' : undefined
                })}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        {filteredUsers && (
          <div className={css({
            background: 'white',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRadius: 8,
            overflow: 'hidden'
          })}>
            {/* Search Results Info */}
            {searchQuery && (
              <div className={css({
                paddingX: 24,
                paddingY: 12,
                background: 'token(colors.blue:50)',
                borderBottom: '1px solid token(colors.blue:200)'
              })}>
                <p className={css({
                  fontSize: '0.875rem',
                  color: 'token(colors.blue:700)'
                })}>
                  {filteredUsers.length === 0 
                    ? `No addresses found matching "${searchQuery}"`
                    : `Found ${filteredUsers.length} address${filteredUsers.length === 1 ? '' : 'es'} matching "${searchQuery}"`
                  }
                  {filteredUsers.length > 0 && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={css({
                        marginLeft: 8,
                        color: 'token(colors.blue:600)',
                        textDecoration: 'underline',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: {
                          color: 'token(colors.blue:800)'
                        }
                      })}
                    >
                      Clear search
                    </button>
                  )}
                </p>
              </div>
            )}
            
            <div className={css({
              overflowX: 'auto'
            })}>
              <table className={css({
                minWidth: '100%'
              })}>
                <thead className={css({
                  background: '#f3eee2'
                })}>
                  <tr>
                    <th className={css({
                      paddingX: 24,
                      paddingY: 12,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 'medium',
                      color: 'token(colors.gray:500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    })}>
                      Rank
                    </th>
                    <th className={css({
                      paddingX: 24,
                      paddingY: 12,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 'medium',
                      color: 'token(colors.gray:500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    })}>
                      Address
                    </th>
                    <th className={css({
                      paddingX: 24,
                      paddingY: 12,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 'medium',
                      color: 'token(colors.gray:500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    })}>
                      Shellpoints
                    </th>
                    <th className={css({
                      paddingX: 24,
                      paddingY: 12,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 'medium',
                      color: 'token(colors.gray:500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    })}>
                      Activities
                    </th>
                  </tr>
                </thead>
                <tbody className={css({
                  background: 'white'
                })}>
                  {filteredUsers?.map((entry) => (
                    <tr
                      key={entry.address}
                      className={css({
                        borderTop: '1px solid #f3eee2',
                        transition: 'background-color 0.2s',
                        _hover: {
                          background: 'token(colors.gray:50)'
                        }
                      })}
                    >
                      <td className={css({
                        paddingX: 24,
                        paddingY: 16,
                        whiteSpace: 'nowrap'
                      })}>
                        <div className={css({
                          display: 'flex',
                          alignItems: 'center'
                        })}>
                          <span
                            className={cx(
                              css({
                                display: 'inline-flex',
                                alignItems: 'center',
                                paddingX: 12,
                                paddingY: 4,
                                borderRadius: '9999px',
                                fontSize: '0.875rem',
                                fontWeight: 'medium',
                                border: '1px solid'
                              }),
                              entry.rank < 6 ? css({ minWidth: 72 }) : '',
                              getRankBadgeColor(entry.rank)
                            )}
                          >
                            {getSnailIcon({ type: entry.rank })} {entry.rank < 6 && <div className={css({ width: 8 })} />} #{entry.rank}
                          </span>
                        </div>
                      </td>
                      <td className={css({
                        paddingX: 24,
                        paddingY: 16,
                        whiteSpace: 'nowrap'
                      })}>
                        <div className={css({
                          color: 'token(colors.gray:900)'
                        })}>
                          {entry.ensName ?? formatAddress(entry.address)}
                        </div>
                      </td>
                      <td className={css({
                        paddingX: 24,
                        paddingY: 16,
                        whiteSpace: 'nowrap'
                      })}>
                        <div className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        })}>
                          <div className={css({
                            fontSize: '1.125rem',
                            fontWeight: 'semibold',
                            color: 'token(colors.gray:900)',
                            textAlign: 'right',
                            minWidth: 80
                          })}>
                            {formatNumber(entry.shellpoints.total)}
                          </div>
                          
                        </div>
                      </td>
                      <td className={css({
                        paddingX: 24,
                        paddingY: 16
                      })}>
                        <div className={css({
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4
                        })}>
                          {entry.activities.map((activity, index) => (
                            <span
                              key={index}
                              className={css({
                                display: 'inline-flex',
                                alignItems: 'center',
                                paddingX: 8,
                                paddingY: 4,
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                fontWeight: 'medium',
                                background: '#cfcfdb',
                                color: '#54515e'
                              })}
                            >
                              {activity}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
