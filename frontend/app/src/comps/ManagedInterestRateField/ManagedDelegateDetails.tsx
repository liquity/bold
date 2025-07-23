import { css } from "@/styled-system/css";
import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import type { Address } from "@/src/types";
import type { Dnum } from "dnum";
import type { Manager, RecommendedDelegate } from "./types";
import { InfoTooltip, StatusDot } from "@liquity2/uikit";
import { infoTooltipProps } from "@/src/uikit-utils";
import { formatDuration } from "./utils";

interface ManagedDelegateDetailsProps {
  delegate: RecommendedDelegate;
  manager: Manager;
  onChange: (interestRate: Dnum) => void;
  onDelegateChange: (delegate: Address | null) => void;
}

export function ManagedDelegateDetails({
  delegate,
  manager,
  onChange,
  onDelegateChange,
}: ManagedDelegateDetailsProps) {
  // Extract the "Managed by" content to avoid duplication
  const managedByContent = (
    <div className={css({
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "contentAlt",
      fontSize: "0.7em",
    })}>
      Managed by
      <a href={manager.link} target="_blank" rel="noopener">
        <img
          alt={manager.name}
          src={manager.logo}
          className={css({
            display: "block",
            height: "24px",
            width: "24px",
          })}
        />
      </a>
    </div>
  );

  return (
    <>
      <div className={css({
        display: "grid",
        gridTemplateColumns: { base: "1fr", medium: "1fr auto" },
        gridTemplateRows: { base: "auto auto auto", medium: "auto auto" },
        gap: { base: 16, medium: 0 },
        width: "100%",
      })}>
        {/* Main delegate content */}
        <div className={css({
          display: "flex",
          alignItems: "center",
          gap: 12,
          gridColumn: { base: "1", medium: "1" },
          gridRow: { base: "1", medium: "1" },
        })}>
          <div className={css({
            display: "flex",
            flexDirection: "column",
            gap: 2,
          })}>
            <div className={css({
              display: "flex", 
              alignItems: "center",
              gap: 8,
              fontSize: "large",
              fontWeight: 600,
              color: "content",
              lineHeight: "1.2",
            })}
            onClick={() => {
              onChange(delegate.delegate.interestRate);
              onDelegateChange(delegate.delegate.address as Address);
            }}>
              {delegate.status.metadata.name}

              <div className={css({
                        marginLeft: -4,
                        display: 'flex',
                      })}>
                        <InfoTooltip {...infoTooltipProps([
                          // delegate.status.metadata.name, 
                          <>
                            <div className={css({
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                              padding: "8px 0",
                              background: "backgroundAlt",
                              borderRadius: 8,
                            })}>
                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Status</div>
                                <div className={css({
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                })}>
                                  <StatusDot 
                                    mode={"positive"}
                                  />
                                  <div>Active Management</div>
                                </div>
                              </div>

                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>USND Managed</div>
                                <div><Amount value={delegate.delegate.boldAmount} format="compact" prefix="$" /></div>
                              </div>
                              
                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Next Predicted Rate</div>
                                <div>{delegate && fmtnum(delegate.status.targetInterestRate / 1e18, "pct2")}%</div>
                              </div>

                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Current Rate</div>
                                <div>{delegate && fmtnum(delegate.status.currentInterestRate / 1e18, "pct2")}%</div>
                              </div>

                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Annual Fee</div>
                                <div>{delegate.delegate.fee ? fmtnum(delegate.delegate.fee, { digits: 4, scale: 100 }) : '0'}%</div>
                              </div>

                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Time Since Last Adjustment</div>
                                <div>{delegate && (() => {
                                  return formatDuration(delegate.status.timeSinceLastAdjustment);
                                })()}</div>
                              </div>

                              <div className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}>
                                <div className={css({
                                  fontSize: "small",
                                  color: "contentAlt",
                                })}>Next Predicted Rate Change</div>
                                <div>{delegate && (() => {
                                  if (delegate.status.daysToAdjustment === null) return 'N/A';
                                  return delegate.status.daysToAdjustment === 0 ? 'Today' : `${delegate.status.daysToAdjustment} days`;
                                })()}</div>
                              </div>
                            </div>
                          </>
                        ])} />
                      </div>
            </div>
            <div className={css({ 
              fontSize: "small",
              color: "contentAlt" 
            })}>
                {delegate.delegate.boldAmount && <span>USND Managed:&nbsp;
                  <Amount
                    format="compact"
                    prefix="$"
                    value={delegate.delegate.boldAmount}
                  /></span>
                }
                {delegate.delegate.fee && <span>, Annual Fee: {fmtnum(delegate.delegate.fee, { digits: 4, scale: 100 })}%</span>}
            </div>
          </div>
        </div>

        {/* "Managed by" positioned in top-right on medium+ screens */}
        <div className={css({
          display: { base: "none", medium: "flex" },
          alignItems: "flex-start",
          justifyContent: "flex-end",
          gridColumn: { medium: "2" },
          gridRow: { medium: "1" },
          position: "relative",
          top: 0,
          right: -4,
        })}>
          {managedByContent}
        </div>
      </div>

      <div className={css({
        display: "flex",
        flexDirection: "column",
        gap: { base: 16, medium: 12 },
        paddingTop: { base: 0, medium: 16 },
        paddingBottom: { base: 8, medium: 0 },
      })}>
        <div className={css({
          fontSize: "sm",
          color: "content",
          lineHeight: "1.5",
        })}>
          {delegate.status.metadata.description}
        </div>

        {/* "Managed by" positioned below description on small screens */}
        <div className={css({
          display: { base: "flex", medium: "none" },
          justifyContent: "flex-start",
          width: "100%",
        })}>
          {managedByContent}
        </div>
      </div>
    </>
  );
} 