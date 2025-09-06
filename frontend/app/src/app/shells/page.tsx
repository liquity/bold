'use client';

import { useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@/src/shellpoints/leaderboard';
import { getSnailIcon } from '@/src/comps/SnailIcons/snail-icons';
import { css, cx } from '@/styled-system/css';
import { useQuery } from '@tanstack/react-query';
import { LinkTextButton } from '@/src/comps/LinkTextButton/LinkTextButton';

const LOCAL_STORAGE_LEADERBOARD_DATA = 'leaderboard_data';
const LOCAL_STORAGE_LEADERBOARD_DATA_EXPIRY = 'leaderboard_data_expiry';

function getExpiryTime() {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  // 18:00 UTC today
  const refreshTime = (new Date(Date.UTC(utcYear, utcMonth, utcDate, 18, 5, 0, 0))).getTime(); // 5 minutes after 18:00 UTC today
  if (refreshTime < now.getTime()) {
    return refreshTime + 1000 * 60 * 60 * 24;
  }
  return refreshTime;
};

async function getLeaderboardData() {
  if (typeof localStorage !== 'undefined') {
    const leaderboardDataLS = localStorage.getItem(LOCAL_STORAGE_LEADERBOARD_DATA);
    const leaderboardDataExpiry = localStorage.getItem(LOCAL_STORAGE_LEADERBOARD_DATA_EXPIRY);
    if (leaderboardDataLS && leaderboardDataExpiry && Number(leaderboardDataExpiry) > Date.now()) {
      return JSON.parse(leaderboardDataLS) as LeaderboardResponse;
    }
  }
  const leaderboardData = await fetch('/api/leaderboard').then(res => res.json()) as LeaderboardResponse
  if (leaderboardData.success) {
    localStorage.setItem(LOCAL_STORAGE_LEADERBOARD_DATA, JSON.stringify(leaderboardData));
    localStorage.setItem(LOCAL_STORAGE_LEADERBOARD_DATA_EXPIRY, getExpiryTime().toString());
  }
  return leaderboardData;
}

function useLeaderboardData() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboardData,
    refetchInterval: 10000, // 10 seconds
  })
}

export default function ShellsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: leaderboardData, isLoading: loading, error, refetch } = useLeaderboardData();

  useEffect(() => {
    refetch();
  }, [refetch]);

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

  // Filter leaderboard data based on search query
  const filteredLeaderboardData = leaderboardData ? {
    ...leaderboardData,
    data: {
      entries: leaderboardData.data.entries.filter(entry => 
        entry.address.toLowerCase().includes(searchQuery.toLowerCase())
        || entry.ensName?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
      lastMintBlock: leaderboardData.data.lastMintBlock
    }
  } : null;

  if (loading) {
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
            position: 'relative',
            marginTop: 24,
            maxWidth: '28rem'
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
        </div>

        {/* Leaderboard Table */}
        {filteredLeaderboardData && (
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
                  {filteredLeaderboardData.data.entries.length === 0 
                    ? `No addresses found matching "${searchQuery}"`
                    : `Found ${filteredLeaderboardData.data.entries.length} address${filteredLeaderboardData.data.entries.length === 1 ? '' : 'es'} matching "${searchQuery}"`
                  }
                  {filteredLeaderboardData.data.entries.length > 0 && (
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
                  {filteredLeaderboardData.data.entries.map((entry) => (
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
                          {entry.shellpoints.mostRecent && entry.shellpoints.mostRecent.blockNumber === filteredLeaderboardData.data.lastMintBlock.blockNumber && (
                            <div className={css({
                              display: 'inline-flex',
                              alignItems: 'center',
                              paddingX: 8,
                              paddingY: 4,
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 'medium',
                              background: '#e3efd8',
                              color: '#2f4225',
                              border: '1px solid #c9e1b5'
                            })}>
                              <span className={css({
                                color: '#4f7b35',
                                fontWeight: 'semibold'
                              })}>
                                +{formatNumber(entry.shellpoints.mostRecent.amount)}
                              </span>
                              {/* <span className="mx-1 text-gray-400">•</span>
                              <span className="text-gray-600">
                                {formatTimeAgo(entry.shellpoints.mostRecent.blockNumber)}
                              </span> */}
                            </div>
                          )}
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

        {/* Stats Cards
        {filteredLeaderboardData && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Filtered Users' : 'Total Users'}
              </h3>
              <p className="text-3xl font-bold text-blue-600">
                {filteredLeaderboardData.data.length}
                {searchQuery && leaderboardData && (
                  <span className="text-sm text-gray-500 ml-2">
                    of {leaderboardData.data.length}
                  </span>
                )}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Filtered Total' : 'Total Shellpoints'}
              </h3>
              <p className="text-3xl font-bold text-green-600">
                {formatNumber(
                  filteredLeaderboardData.data.reduce((sum, entry) => sum + entry.shellpoints.total, 0)
                )}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Top in Results' : 'Top Score'}
              </h3>
              <p className="text-3xl font-bold text-purple-600">
                {filteredLeaderboardData.data.length > 0 
                  ? formatNumber(filteredLeaderboardData.data[0].shellpoints.total)
                  : '0'
                }
              </p>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
}
