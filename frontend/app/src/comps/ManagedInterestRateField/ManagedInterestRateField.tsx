import { memo, useId, useState, useMemo, useEffect, useCallback, useRef } from "react";
import { match } from "ts-pattern";
import { a, useSpring, useTransition } from "@react-spring/web";
import { css } from "@/styled-system/css";
import { useAppear } from "@/src/anim-utils";
import { INTEREST_RATE_MIN, REDEMPTION_RISK } from "@/src/constants";
import { findClosestRateIndex, useAverageInterestRate, useInterestRateChartData } from "@/src/liquity-utils";
import { useInterestBatchDelegate } from "@/src/subgraph-hooks";
import content from "@/src/content";
import { DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";

import { infoTooltipProps } from "@/src/uikit-utils";
import { noop } from "@/src/utils";

import {
  Dropdown,
  HFlex,
  InfoTooltip,
  InputField,
  Slider,
  StatusDot,
  TextButton,
  IconSuggestion,
} from "@liquity2/uikit";

import * as dn from "dnum";
import Image from "next/image";
import { useBatchManagers } from "@/src/summerstone-hooks";
import { isAddress, shortenAddress } from "@liquity2/uikit";
import { blo } from "blo";
import { mapAndSortDelegates } from "./utils";

import { DELEGATE_MODES, type InterestRateFieldProps, type DelegateMode } from "./types";
export type { DelegateMode } from "./types";

import { ManagedDelegateDetails } from "./ManagedDelegateDetails";
import type { Address, CollIndex, Delegate } from "@/src/types";

import { MiniChart } from "./MiniChart";
import { PublicStatus } from "@/src/summerstone-graphql/graphql";
import { DelegateModal } from "./DelegateModal";

export const InterestRateField = memo(
  function InterestRateField({
    branchId,
    debt,
    delegate,
    inputId: inputIdFromProps,
    interestRate,
    mode,
    onAverageInterestRateLoad: rawOnAverageInterestRateLoad = noop,
    onChange: rawOnChange,
    onDelegateChange: rawOnDelegateChange,
    onModeChange: rawOnModeChange = noop,
  }: InterestRateFieldProps) {
    // Create logging wrappers for callbacks (optional debug statements).
    const onChange = useCallback((value: dn.Dnum) => {
      // console.log("InterestRateField onChange called with:", value);
      rawOnChange(value);
    }, [rawOnChange]);

    const onDelegateChange = useCallback((value: Address | null) => {
      // console.log("InterestRateField onDelegateChange called with:", value);
      rawOnDelegateChange(value);
    }, [rawOnDelegateChange]);

    const onModeChange = useCallback((value: DelegateMode) => {
      // console.log("InterestRateField onModeChange called with:", value);
      rawOnModeChange(value);
    }, [rawOnModeChange]);

    const onAverageInterestRateLoad = useCallback((value: dn.Dnum) => {
      // console.log("InterestRateField onAverageInterestRateLoad called with:", value);
      rawOnAverageInterestRateLoad(value);
    }, [rawOnAverageInterestRateLoad]);

    const [delegatePicker, setDelegatePicker] = useState<DelegateMode | null>(null);

    const autoInputId = useId();
    const inputId = inputIdFromProps ?? autoInputId;

    // ▼ NEW: We fetch the average interest rate for this branch
    const validBranchId = useMemo(() => {
      return (typeof branchId === 'number' && branchId >= 0 && branchId <= 9) ? branchId : 0;
    }, [branchId]);

    const averageInterestRate = useAverageInterestRate(validBranchId as CollIndex);

    /**
     * Keep track of whether the user has "touched" the interest rate for the current branch.
     * If they haven't touched it yet, we auto-set to the average. (Upstream patch logic)
     */
    const rateTouchedForBranch = useRef<CollIndex | null>(null);

    // ▼ MINIMAL REFACTOR: Moved side effect to useEffect
    // If the branch changes, reset so we can set the average again.
    useEffect(() => {
      // Don't reset rateTouchedForBranch if we're in managed mode
      if (rateTouchedForBranch.current !== branchId && mode !== "managed") {
        rateTouchedForBranch.current = null;
      }
    }, [branchId, mode]); // Also depend on mode

    // If not touched yet and we do have an average, set it once
    useEffect(() => {
      // Only apply average rate if we're in manual mode
      if (rateTouchedForBranch.current === null && averageInterestRate.data && mode === "manual") {
        // Mark as touched to avoid re-setting if the user changes anything
        rateTouchedForBranch.current = branchId;
        // Defer the actual onChange call so it doesn't happen mid-render
        setTimeout(() => {
          if (averageInterestRate.data) {
            onAverageInterestRateLoad(averageInterestRate.data);
          }
        }, 0);
      }
    }, [branchId, averageInterestRate.data, onAverageInterestRateLoad, mode]); // Added mode dependency

    // ▼ REPLACE old fieldValue default approach with new onFocusChange approach
    const fieldValue = useInputFieldValue((value) => `${fmtnum(value)}%`, {
      onFocusChange: ({ parsed, focused }) => {
        // If user *unfocuses* the field, revert to INTEREST_RATE_MIN if value is zero
        if (!focused && parsed) {
          if (dn.eq(parsed, dn.from(0))) {
            fieldValue.setValue(String(INTEREST_RATE_MIN * 100));
          }
          // Otherwise, preserve the original precision - no rounding
        }
      },
      onChange: ({ parsed }) => {
        if (parsed) {
          // Mark the rate as touched, so we don't re-apply the average for this branch
          rateTouchedForBranch.current = branchId;
          onChange(dn.div(parsed, 100));
        }
      },
    });

    // ▼ NEW: Track focus state and sync fieldValue when interestRate changes externally
    const [isInputFocused, setIsInputFocused] = useState(false);
    const prevInterestRateRef = useRef<dn.Dnum | null>(null);
    const prevModeRef = useRef<DelegateMode>(mode);
    
    useEffect(() => {
      // Only sync in manual mode and when not currently focused (to avoid overriding user input)
      if (mode === "manual" && interestRate) {
        const expectedValue = dn.toString(dn.mul(interestRate, 100));
        const rateChanged = !prevInterestRateRef.current || !dn.eq(interestRate, prevInterestRateRef.current);
        const modeChanged = prevModeRef.current !== mode;
        
        // Sync if rate changed externally or we switched to manual mode
        if ((rateChanged || modeChanged) && fieldValue.value !== expectedValue && !isInputFocused) {
          fieldValue.setValue(expectedValue);
        }
      }
      
      prevInterestRateRef.current = interestRate;
      prevModeRef.current = mode;
    }, [interestRate, mode, isInputFocused]);

    // Bold interest per year
    const boldInterestPerYear = useMemo(() => {
      if (!interestRate || !debt) return null;
      return dn.mul(interestRate, debt);
    }, [interestRate, debt]);

    const interestChartData = useInterestRateChartData(validBranchId as CollIndex);

    const interestRateRounded = useMemo(() => {
      if (!interestRate) return null;
      return dn.div(dn.round(dn.mul(interestRate, 1000)), 1000);
    }, [interestRate]);

    const bracket = useMemo(() => {
      if (!interestRateRounded || 
          !interestChartData.data || 
          interestChartData.isLoading ||
          interestChartData.isError) {
        return null;
      }
      return interestChartData.data.find(
        ({ rate }) => dn.eq(dn.from(rate / 100, 18), interestRateRounded),
      );
    }, [interestRateRounded, interestChartData.data, interestChartData.isLoading, interestChartData.isError]);

    // This sets up a spring-based fade/slide for "Redeemable before you:"
    const redeemableTransition = useAppear(bracket?.debtInFront !== undefined);

    // Delegates, batch managers, etc.
    const { data: batchManagers, status: batchManagerQueryStatus } = useBatchManagers(
      undefined,
      undefined
    );

    // Group batch managers by branch ID
    const batchManagersByBranchId = useMemo(() => {
      const groupedManagers = new Map<CollIndex, Address[]>();
      
      batchManagers
        ?.filter(s => !s.metadata.supersededBy && isAddress(s.batchManagerId))
        .forEach(s => {
          const managerBranchId = Number(s.collateralBranchId) as CollIndex;
          const batchManagerIdAddr = s.batchManagerId.toLowerCase() as Address;
          
          if (!groupedManagers.has(managerBranchId)) {
            groupedManagers.set(managerBranchId, []);
          }
          
          groupedManagers.get(managerBranchId)?.push(batchManagerIdAddr);
        });
        
      return groupedManagers;
    }, [batchManagers]);

    // 1. Get addresses for the current component's branchId
    const currentBranchManagerAddresses = useMemo(() => {
      if (!batchManagersByBranchId || typeof branchId === 'undefined' || branchId === null) {
        return []; // Ensure an empty array is returned if no managers or branchId is invalid
      }
      return batchManagersByBranchId.get(branchId) || [];
    }, [batchManagersByBranchId, branchId]);

    // 2. Call useInterestBatchDelegate a fixed number of times to avoid Rules of Hooks violation
    // Support up to 5 delegates per branch (should cover most cases)
    const delegate1Query = useInterestBatchDelegate(validBranchId as CollIndex, currentBranchManagerAddresses[0] || null);
    const delegate2Query = useInterestBatchDelegate(validBranchId as CollIndex, currentBranchManagerAddresses[1] || null);
    const delegate3Query = useInterestBatchDelegate(validBranchId as CollIndex, currentBranchManagerAddresses[2] || null);
    const delegate4Query = useInterestBatchDelegate(validBranchId as CollIndex, currentBranchManagerAddresses[3] || null);
    const delegate5Query = useInterestBatchDelegate(validBranchId as CollIndex, currentBranchManagerAddresses[4] || null);
    
    const allDelegateQueries = [delegate1Query, delegate2Query, delegate3Query, delegate4Query, delegate5Query];
    
    // 3. Combine results from all delegate queries
    const delegatesForCurrentBranch = useMemo(() => {
      return allDelegateQueries
        .map(query => query.data)
        .filter(Boolean);
    }, [delegate1Query.data, delegate2Query.data, delegate3Query.data, delegate4Query.data, delegate5Query.data]);
    
    const delegatesAreLoading = allDelegateQueries.some(query => query.isLoading);
    const delegatesHaveError = allDelegateQueries.some(query => query.isError);
    
    // 4. Reconstruct batchData based on delegatesForCurrentBranch.
    const batchData = useMemo(() => {
      if (!delegatesForCurrentBranch || delegatesForCurrentBranch.length === 0) {
        return [];
      }
      return delegatesForCurrentBranch.map((delegateData: any) => { 
        const address = (delegateData.address as string).toLowerCase(); 
        const key = `${validBranchId}:${address}`; 
        
        return { 
          ...delegateData,
          key 
        };
      });
    }, [delegatesForCurrentBranch, validBranchId]);

    // 5. Update isLoadingDelegates and hasErrorDelegates
    const isLoadingDelegates = batchManagerQueryStatus === "pending" || 
                              (currentBranchManagerAddresses.length > 0 && delegatesAreLoading);
    const hasErrorDelegates = batchManagerQueryStatus === "error" || delegatesHaveError;

    const recommendedDelegates = useMemo(() => {
      if (!batchData || !batchManagers) return []; 
      return mapAndSortDelegates(batchData, batchManagers, validBranchId);
    }, [validBranchId, batchData, batchManagers]);

    const lowestManagedRateForBranch = useMemo(() => {
      if (!recommendedDelegates || recommendedDelegates.length === 0) {
        return null;
      }
      const validRates = recommendedDelegates
        .map(d => d.delegate.interestRate)
        .filter(rate => rate && dn.isDnum(rate)) as dn.Dnum[];

      if (validRates.length === 0) {
        return null;
      }
      return validRates.reduce((minRate, currentRate) =>
        dn.lt(currentRate, minRate) ? currentRate : minRate
      );
    }, [recommendedDelegates]);

    const lowestRateDelegate = useMemo(() => {
      if (!recommendedDelegates || recommendedDelegates.length === 0) {
        return null;
      }
      
      return recommendedDelegates.reduce((lowestDelegate, currentDelegate) => 
        lowestDelegate && currentDelegate.delegate.interestRate && 
        dn.lt(currentDelegate.delegate.interestRate, lowestDelegate.delegate.interestRate) 
          ? currentDelegate 
          : lowestDelegate, 
        recommendedDelegates[0]
      );
    }, [recommendedDelegates]);

    const lowestDelegateFee = useMemo(() => {
      if (!lowestRateDelegate) return dn.from(0);
      return lowestRateDelegate.delegate.fee || dn.from(0);
    }, [lowestRateDelegate]);

    const showLowerManagedRateNotice = useMemo(() => { // This boolean is simplified and used directly
      return (
        mode === "manual" &&
        debt && dn.gt(debt, dn.from(0)) &&
        interestRate &&
        lowestManagedRateForBranch &&
        dn.lt(dn.add(lowestManagedRateForBranch, lowestDelegateFee), interestRate)
      );
    }, [mode, debt, interestRate, lowestManagedRateForBranch, lowestDelegateFee]);

    const savingsAmount = useMemo(() => {
      if (!showLowerManagedRateNotice || !interestRate || !lowestManagedRateForBranch || !debt) {
        return null;
      }
      const rateDifference = dn.sub(interestRate, dn.add(lowestManagedRateForBranch, lowestDelegateFee));
      return dn.mul(debt, rateDifference);
    }, [showLowerManagedRateNotice, interestRate, lowestManagedRateForBranch, lowestDelegateFee, debt]);

    const [selectedManagedIndex, setSelectedManagedIndex] = useState(0);
    const selectedManagedDelegate = recommendedDelegates[selectedManagedIndex];

    const isDataReady = useMemo(() => {
      return !interestChartData.isLoading && 
             !isLoadingDelegates && 
             !hasErrorDelegates &&
             interestChartData.data;
    }, [interestChartData.isLoading, interestChartData.data, isLoadingDelegates, hasErrorDelegates]);

    const previousState = useRef<{
      delegate: Address | null;
      recommendedDelegatesLoaded: boolean;
      branchId: CollIndex | null;
    }>({
      delegate: null,
      recommendedDelegatesLoaded: false,
      branchId: null,
    });
    
    // MODIFIED: Moved height states here to be co-located with handleModeChange which resets them
    const [measuredNoticeHeight, setMeasuredNoticeHeight] = useState(0);
    const [measuredBeforeContentHeight, setMeasuredBeforeContentHeight] = useState(0);
    const [measuredManagedHeight, setMeasuredManagedHeight] = useState(0);

    const handleModeChange = useCallback((newMode: DelegateMode) => {
      setMeasuredNoticeHeight(0); // Reset height for potential remeasurement
      setMeasuredBeforeContentHeight(0);
      setMeasuredManagedHeight(0);
      
      onModeChange(newMode);
      switch (newMode) {
        case "managed":
          const currentSelected = recommendedDelegates[selectedManagedIndex] || (recommendedDelegates.length > 0 ? recommendedDelegates[0] : undefined);
          if (currentSelected) {
            onChange(currentSelected.delegate.interestRate);
            onDelegateChange(currentSelected.delegate.address as Address);
          }
          break;
        case "manual":
          onDelegateChange(null);
          break;
        case "delegate":
          if (
            mode === "managed" &&
            delegate &&
            recommendedDelegates.some(
              d => d.delegate.address.toLowerCase() === delegate.toLowerCase(),
            )
          ) {
            onDelegateChange(null);
          }
          break;
        case "strategy":
          break;
      }
    }, [
      onModeChange,
      recommendedDelegates,    
      selectedManagedIndex,
      onChange,
      onDelegateChange,
      mode,
      delegate,
      // setMeasuredNoticeHeight, setMeasuredBeforeContentHeight, setMeasuredManagedHeight are stable setters
    ]);

    useEffect(() => {
      // Don't proceed until all data is ready
      if (!isDataReady) return;
      
      const isInitialLoad = !previousState.current.recommendedDelegatesLoaded && recommendedDelegates.length > 0;
      const delegateChanged = previousState.current.delegate !== delegate;
      const branchIdChanged = previousState.current.branchId !== branchId;

      previousState.current.delegate = delegate;
      previousState.current.recommendedDelegatesLoaded = recommendedDelegates.length > 0;
      previousState.current.branchId = branchId;

      if (branchIdChanged) {
        onDelegateChange(null);
      }

      if (recommendedDelegates.length > 0) {
        if (
          selectedManagedIndex >= recommendedDelegates.length ||
          (branchIdChanged && mode === "managed")
        ) {
          setSelectedManagedIndex(0);
          if (mode === "managed" && recommendedDelegates[0]) {
            rateTouchedForBranch.current = branchId;
            onChange(recommendedDelegates[0]!.delegate.interestRate);
            onDelegateChange(recommendedDelegates[0]!.delegate.address as Address);
          }
        }

        if (delegate) {
          const managedDelegateIndex = recommendedDelegates.findIndex(
            d => d.delegate.address.toLowerCase() === delegate.toLowerCase(),
          );
          if (managedDelegateIndex !== -1) {
            if (selectedManagedIndex !== managedDelegateIndex) {
              setSelectedManagedIndex(managedDelegateIndex);
            }
            if (mode !== "managed") {
              onModeChange("managed");
            }
          } else if (isInitialLoad || delegateChanged) {
            if (mode !== "delegate") {
              handleModeChange("delegate");
            }
          }
        } else if (mode === "managed") {
          const activeManagedDelegate = recommendedDelegates[selectedManagedIndex] || recommendedDelegates[0];
          if (activeManagedDelegate) {
            if (delegate !== activeManagedDelegate.delegate.address) {
              onChange(activeManagedDelegate.delegate.interestRate);
              onDelegateChange(activeManagedDelegate.delegate.address as Address);
            }
          } else {
            handleModeChange("manual");
          }
        }
      } else {
        if (mode === "managed") {
          // Cannot be in "managed" mode without recommended delegates.
        }
      }
    }, [
      delegate,
      recommendedDelegates,
      mode,
      selectedManagedIndex,
      handleModeChange,
      onModeChange,
      onChange,
      onDelegateChange,
      branchId,
      isDataReady
    ]);

    const handleDelegateSelect = useCallback((delegateData: Delegate) => { 
      setDelegatePicker(null);
      rateTouchedForBranch.current = branchId; 
      onChange(delegateData.interestRate);
      onDelegateChange(delegateData.address ?? null);
    }, [onChange, onDelegateChange, branchId]); 

    const beforeContentRef = useRef<HTMLDivElement>(null);
    // const [measuredBeforeContentHeight, setMeasuredBeforeContentHeight] = useState(0); // Moved up
    const shouldShowBeforeContent = mode === "managed";

    useEffect(() => {
      if (shouldShowBeforeContent && beforeContentRef.current) {
        const newHeight = beforeContentRef.current.scrollHeight;
        if (measuredBeforeContentHeight !== newHeight) { // Only update if changed
            setMeasuredBeforeContentHeight(newHeight);
        }
      } else if (!shouldShowBeforeContent) {
        if (measuredBeforeContentHeight !== 0) { // Reset if not already 0
            setMeasuredBeforeContentHeight(0);
        }
      }
    }, [shouldShowBeforeContent, isLoadingDelegates, hasErrorDelegates, recommendedDelegates, selectedManagedDelegate, measuredBeforeContentHeight]);


    const sharedSpringConfig = { tension: 280, friction: 24, mass: 1, clamp: false, bounce: 0.25 };
    const hiddenYTransformValue = -20; // px

    const beforeContentAnimationStyles = useSpring({
      to: {
        opacity: shouldShowBeforeContent ? 1 : 0,
        transform: shouldShowBeforeContent ? "translateY(0px)" : `translateY(${hiddenYTransformValue}px)`,
        height: shouldShowBeforeContent ? measuredBeforeContentHeight : 0,
      },
      config: sharedSpringConfig,
    });

    const noticeContentRef = useRef<HTMLDivElement>(null);
    // const [measuredNoticeHeight, setMeasuredNoticeHeight] = useState(0); // Moved up

    // MODIFIED: useEffect for notice height measurement, ensuring it updates and resets correctly.
    useEffect(() => {
      if (showLowerManagedRateNotice && noticeContentRef.current) {
        const newHeight = noticeContentRef.current.scrollHeight;
        // Only update if the height actually changed to avoid potential loops
        // and ensure `useTransition`'s `update` function gets the correct new height.
        if (measuredNoticeHeight !== newHeight) { 
            setMeasuredNoticeHeight(newHeight);
        }
      } else if (!showLowerManagedRateNotice) {
        // If notice is hidden, ensure measured height is reset (for next time it shows)
        if (measuredNoticeHeight !== 0) {
            setMeasuredNoticeHeight(0);
        }
      }
    // Dependencies:
    // - showLowerManagedRateNotice: Main trigger for measurement or reset.
    // - savingsAmount: Content of notice changes, so height might change.
    // - measuredNoticeHeight: Part of the condition to prevent unnecessary re-sets if height hasn't actually changed.
    }, [showLowerManagedRateNotice, savingsAmount, measuredNoticeHeight]);


    const managedContentRef = useRef<HTMLDivElement>(null);
    // const [measuredManagedHeight, setMeasuredManagedHeight] = useState(0); // Moved up
    const shouldShowManagedContent = mode === "managed" && !!selectedManagedDelegate;
    
    useEffect(() => {
      if (shouldShowManagedContent && managedContentRef.current) {
        const newHeight = managedContentRef.current.scrollHeight;
        if (measuredManagedHeight !== newHeight) { // Only update if changed
            setMeasuredManagedHeight(newHeight);
        }
      } else if (!shouldShowManagedContent) {
        if (measuredManagedHeight !== 0) { // Reset if not already 0
            setMeasuredManagedHeight(0);
        }
      }
    }, [shouldShowManagedContent, selectedManagedDelegate, measuredManagedHeight]);

    // MODIFIED: useTransition for the notice, using item array and update function.
    const noticeItems = useMemo(() => {
        return showLowerManagedRateNotice
            ? [{ id: 'lowerManagedRateNoticeItem', currentHeight: measuredNoticeHeight }]
            : [];
    }, [showLowerManagedRateNotice, measuredNoticeHeight]);

    const noticeTransition = useTransition(noticeItems, {
        keys: item => item.id,
        from: { opacity: 0, height: 0, transform: `translateY(${hiddenYTransformValue}px)` },
        enter: item => ({ opacity: 1, height: item.currentHeight, transform: "translateY(0px)" }),
        leave: { opacity: 0, height: 0, transform: `translateY(${hiddenYTransformValue}px)` },
        update: item => ({ height: item.currentHeight }), // Crucial for dynamic height updates
        config: sharedSpringConfig,
    });

    const managedContentAnimationStyles = useSpring({
      height: shouldShowManagedContent ? measuredManagedHeight : 0,
      opacity: shouldShowManagedContent ? 1 : 0,
      transform: shouldShowManagedContent ? "translateY(0px)" : `translateY(${hiddenYTransformValue}px)`,
      config: sharedSpringConfig
    });
 
    return (
      <>
        <InputField
          id={inputId}
          labelHeight={32}
          labelSpacing={24}
          disabled={mode !== "manual"}
          label={{
            start: (
              <div className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}>
                <div>
                  {
                    match(mode)
                      .with("manual", () => "Set Interest Rate")
                      .with("managed", () => "Managed Rate")
                      .with("delegate", () => "Select Custom Delegate")
                      .with("strategy", () => "Interest rate")
                      .exhaustive()
                  }
                </div>
                {averageInterestRate.data && mode === "manual" && (
                  <TextButton
                    size="small"
                    title={`Set average interest rate (${fmtnum(averageInterestRate.data, { preset: "pct1z", suffix: "%" })})`}
                    label={`(avg. ${fmtnum(averageInterestRate.data, { preset: "pct1z", suffix: "%" })})`}
                    onClick={(event) => {
                      event.preventDefault();
                      rateTouchedForBranch.current = branchId;
                      if (averageInterestRate.data) {
                        // Round to 1 decimal place (0.1%)
                        const rounded = dn.div(dn.round(dn.mul(averageInterestRate.data, 1000)), 1000);
                        onChange(rounded);
                      }
                    }}
                  />
                )}
              </div>
            ),
            end: (
              <div>
                <Dropdown
                  items={DELEGATE_MODES.map((modeItem) => ({ 
                    label: match(modeItem)
                      .with("manual", () => "Manual")
                      .with("managed", () => "Managed ✨")
                      .with("delegate", () => "Custom Delegate")
                      .with("strategy", () => "Strategy")
                      .exhaustive(),
                    secondary: match(modeItem)
                      .with("manual", () => "Set and manage your own interest rate")
                      .with("managed", () => "Automatic optimized rate management")
                      .with("delegate", () => "Specify your own custom delegate")
                      .with("strategy", () => "")
                      .exhaustive(),
                  }))}
                  menuWidth={300}
                  menuPlacement="end"
                  onSelect={(index) => {
                    const newMode = DELEGATE_MODES[index];
                    if (newMode) {
                      handleModeChange(newMode);
                    }
                  }}
                  selected={DELEGATE_MODES.findIndex((m) => m === mode)}
                  size="small"
                />
              </div>
            ),
          }}
          contextual={
            match(mode)
              .with("manual", () => (
                <ManualInterestRateSlider
                  fieldValue={fieldValue}
                  interestChartData={interestChartData}
                  interestRate={interestRate}
                />
              ))
              .with("strategy", () => (<></>))
              .with("delegate", () => (
                <TextButton
                  size="large"
                  title={delegate ?? undefined}
                  label={delegate ? (
                    <div
                      title={delegate}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      })}
                    >
                      <Image
                        alt=""
                        width={24}
                        height={24}
                        src={blo(delegate)}
                        className={css({
                          display: "block",
                          borderRadius: 4,
                        })}
                      />
                      {isLoadingDelegates && !recommendedDelegates.find(d => d.delegate.address.toLowerCase() === delegate.toLowerCase()) ? ( 
                        <div className={css({
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: "0", 
                          color: "contentAlt",
                        })}>
                          Loading...
                        </div>
                      ) : (
                        shortenAddress(delegate, 4).toLowerCase()
                      )}
                    </div>
                  ) : "Choose delegate"}
                  onClick={() => setDelegatePicker("delegate")}
                />
              ))
              .with("managed", () => null)
              .exhaustive()
          }
          placeholder="0.00"
          secondary={{
            start: (
              <HFlex gap={4} className={css({ minWidth: 120 })}>
                <div>
                  {boldInterestPerYear && (mode === "manual" || delegate !== null)
                    ? fmtnum(boldInterestPerYear)
                    : "−"} USND / year
                </div>
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateBoldPerYear)} />
              </HFlex>
            ),
            end: redeemableTransition((style, show) =>
              show && (
                <a.div
                  className={css({
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  })}
                  style={style}
                >
                  <span>
                    Redeemable before you:{" "}
                    <span className={css({ fontVariantNumeric: "tabular-nums" })}>
                      {(mode === "manual" || delegate !== null)
                        ? fmtnum(bracket?.debtInFront, "compact")
                        : "−"}
                    </span>
                    <span> USND</span>
                  </span>
                </a.div>
              )
            ),
          }}
          beforeContent={
            mode === "managed" ? (
              <a.div style={{...beforeContentAnimationStyles, overflow: "hidden"}} ref={beforeContentRef}>
                {isLoadingDelegates ? (
                  <div className={css({
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "40px 0",
                    color: "contentAlt",
                  })}>
                    Loading managed strategies...
                  </div>
                ) : hasErrorDelegates ? (
                  <div className={css({
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "40px 0",
                    color: "error",
                  })}>
                    Error loading strategies. Please try again later.
                  </div>
                ) : recommendedDelegates.length === 0 ? (
                  <div className={css({
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "40px 0",
                    color: "contentAlt",
                  })}>
                    No managed strategies available
                  </div>
                ) : recommendedDelegates.length === 1 && recommendedDelegates[0] ? (
                  <div className={css({
                    display: "flex",
                    flexDirection: "column",
                    padding: "0 4px",
                    width: "100%",
                  })}>
                    <ManagedDelegateDetails
                      delegate={recommendedDelegates[0]!}
                      manager={recommendedDelegates[0]!.manager}
                      onChange={onChange}
                      onDelegateChange={onDelegateChange}
                    />
                  </div>
                ) : (
                  <div className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                  })}>
                    <div className={css({
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 40px",
                    })}>
                      <div className={css({
                        width: "100%",
                        position: "relative",
                      })}>
                        <Slider
                          gradient={[1/3, 2/3]}
                          gradientMode="low-to-high"
                          onChange={(value) => {
                            if (recommendedDelegates.length > 0) { 
                                const targetIndex = Math.round(value * (recommendedDelegates.length - 1));
                                const newSelectedDelegate = recommendedDelegates[targetIndex]; 
                                if (newSelectedDelegate) {
                                setSelectedManagedIndex(targetIndex);
                                onChange(newSelectedDelegate.delegate.interestRate);
                                onDelegateChange(newSelectedDelegate.delegate.address as Address);
                                }
                            }
                          }}
                          value={
                            selectedManagedDelegate && recommendedDelegates.length > 1 
                              ? selectedManagedIndex / (recommendedDelegates.length - 1)
                              : 0 
                          }
                        />
                      </div>
                      <div className={css({
                        display: "flex",
                        position: "relative",
                        width: "100%",
                        marginTop: -16,
                        height: 32,
                        padding: "4px 13px",
                      })}>
                        {recommendedDelegates.map((delegateObj, index) => {
                          const position = recommendedDelegates.length > 1 ? index / (recommendedDelegates.length - 1) : 0.5;
                          const isSelected = (index === selectedManagedIndex);
                          return (
                            <div
                              key={delegateObj.delegate.address}
                              style={{ left: `${position * 100}%` }}
                              className={css({
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 2,
                                position: "absolute",
                                transform: "translateX(-50%)",
                                transition: "color 0.2s ease",
                                color: isSelected ? "content" : "contentAlt",
                              })}
                            >
                              <div
                                className={css({
                                  width: 2,
                                  height: 8,
                                  background: isSelected ? "accent" : "controlBorder",
                                  borderRadius: 1,
                                  transition: "background 0.2s ease",
                                })}
                              />
                              <div
                                className={css({
                                  fontSize: "small",
                                  fontWeight: isSelected ? 500 : 400,
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                  _hover: { color: "accent" },
                                })}
                                onClick={() => {
                                  setSelectedManagedIndex(index);
                                  onChange(delegateObj.delegate.interestRate);
                                  onDelegateChange(delegateObj.delegate.address as Address);
                                }}
                              >
                                {delegateObj.status.metadata.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <hr className={css({
                      width: "100%",
                      borderColor: "borderSoft",
                    })} />
                    <div className={css({
                      display: "flex",
                      flexDirection: "column",
                      padding: "0 4px",
                      width: "100%",
                    })}>
                      {selectedManagedDelegate ? (
                        <ManagedDelegateDetails
                          delegate={selectedManagedDelegate}
                          manager={selectedManagedDelegate.manager}
                          onChange={onChange}
                          onDelegateChange={onDelegateChange}
                        />
                      ) : (
                        <div>No managed strategies available</div>
                      )}
                    </div>
                  </div>
                )}
                <hr className={css({
                  width: "100%",
                  borderColor: "borderSoft",
                  margin: "16px 0",
                })} />
              </a.div>
            ) : undefined
          }
          afterContent={
            <>
              {noticeTransition((style, item) => // item is from noticeItems array
                item ? ( 
                  <a.div style={{ ...style, overflow: "hidden" }} key={item.id}> {/* Added key */}
                    <div 
                      ref={noticeContentRef}
                      className={css({
                        padding: '16px 0 0 0', 
                      })}
                    >
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 4,
                          color: "contentAlt",
                          fontSize: 14,
                          padding: 8,
                          border: '1px solid var(--colors-border)',
                          backgroundColor: 'var(--colors-field-border)',
                          borderRadius: 4,
                        })}
                      >
                        <span className={css({ display: "flex", alignItems: "center", gap: 4 })}>
                          <IconSuggestion size={16} />
                          <span>
                            {savingsAmount 
                              ? `Save up to ${fmtnum(savingsAmount, 'compact')} USND per year with a managed rate!`
                              : "You could save with a managed rate!"}
                          </span>
                        </span>
                        <TextButton
                          size="small"
                          onClick={() => handleModeChange("managed")}
                          label="Switch"
                          className={css({
                            color: "accent",
                            fontWeight: 500,
                            display: 'inline-block',
                            marginLeft: 'auto'
                          })}
                        />
                      </div>
                    </div>
                  </a.div>
                ) : null
              )}
              {!showLowerManagedRateNotice && mode === "managed" && selectedManagedDelegate ? (
                <a.div style={{ ...managedContentAnimationStyles, overflow: "hidden" }}>
                  <div ref={managedContentRef}>
                    <div className={css({
                      display: "flex",
                      padding: "12px 0 8px 0",
                      alignItems: "center",
                      gap: 8,
                    })}>
                      <StatusDot mode="positive" />
                      <div>
                        {
                          match(selectedManagedDelegate.status.status)
                            .with(PublicStatus.InRange, () =>
                              "Interest rate within target range for risk level"
                            )
                            .with(PublicStatus.ChangePlanned, () => {
                              const rawRate = selectedManagedDelegate.status.targetInterestRate;
                              const ir = fmtnum(rawRate / 1e18, "pct2");
                              
                              return (
                                <>
                                  Interest rate adjustment to <b>{ir}%</b> predicted{' '}
                                  {selectedManagedDelegate.status.daysToAdjustment === 0
                                    ? 'today'
                                    : `in ${selectedManagedDelegate.status.daysToAdjustment} days`}
                                  .
                                </>
                              );
                            })
                            .with(PublicStatus.Deprecated, PublicStatus.Inactive, () => {
                              return <>This strategy is not active.</>;
                            })
                            .exhaustive()
                        }
                      </div>
                    </div>
                  </div>
                </a.div>
              ) : null}
            </>
          }
          {...fieldValue.inputFieldProps}
          onFocus={() => {
            setIsInputFocused(true);
            fieldValue.inputFieldProps.onFocus?.();
          }}
          onBlur={() => {
            setIsInputFocused(false);
            fieldValue.inputFieldProps.onBlur?.();
          }}
          value={
            // no delegate selected yet
            (mode !== "manual" && delegate === null)
              ? ""
              : fieldValue.value
          }
          valueUnfocused={
            (mode !== "manual" && delegate === null)
              ? null
              : interestRate
                ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {delegate !== null && <MiniChart size="medium" />}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmtnum(interestRate, "pct1z")}
                    </span>
                    <span style={{ color: "#878AA4", fontSize: 24 }}>
                      % per year
                    </span>
                  </span>
                )
                : null
          }
        />

        <DelegateModal
          branchId={branchId}
          onClose={() => setDelegatePicker(null)}
          onSelectDelegate={handleDelegateSelect}
          visible={delegatePicker === "delegate"}
        />
      </>
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

function ManualInterestRateSlider({
  fieldValue,
  interestChartData,
  interestRate,
}: {
  fieldValue: ReturnType<typeof useInputFieldValue>;
  interestChartData: ReturnType<typeof useInterestRateChartData>;
  interestRate: dn.Dnum | null;
}) {
  const rateToSliderPosition = useCallback((rate: bigint, chartRates: bigint[]) => {
    if (rate == null || !chartRates || chartRates.length === 0) return 0;

    const firstRate = chartRates.at(0) ?? 0n;
    if (rate <= firstRate) return 0;

    const lastRate = chartRates.at(-1) ?? 0n;
    if (rate >= lastRate) return 1;

    return findClosestRateIndex(chartRates, rate) / chartRates.length;
  }, []);

  const value = useMemo(() => {
    const rate = interestRate?.[0] ?? 0n;
    const chartRates = interestChartData.data?.map(({ rate }) => dn.from(rate / 100, 18)[0]);
    if (!chartRates) return 0;

    return rateToSliderPosition(rate, chartRates);
  }, [
    jsonStringifyWithDnum(interestChartData.data),
    jsonStringifyWithDnum(interestRate),
    rateToSliderPosition,
  ]);

  const gradientStops = useMemo((): [
    medium: number,
    low: number,
  ] => {
    if (!interestChartData.data || interestChartData.data.length === 0) {
      return [0, 0];
    }

    const totalDebt = interestChartData.data.reduce(
      (sum, item) => dn.add(sum, item.debt),
      DNUM_0,
    );

    if (dn.eq(totalDebt, 0)) {
      return [0, 0];
    }

    // find exact rates where debt positioning crosses thresholds
    let mediumThresholdRate = null;
    let lowThresholdRate = null;

    for (const [index, item] of interestChartData.data.entries()) {
      const prevItem = index > 0 ? interestChartData.data[index - 1] : null;
      const prevRate = prevItem?.rate ?? null;

      const debtInFrontRatio = dn.div(item.debtInFront, totalDebt);

      // place boundary at the rate before crossing threshold (so slider changes at the right position)
      if (dn.gt(debtInFrontRatio, REDEMPTION_RISK.medium) && !mediumThresholdRate) {
        mediumThresholdRate = prevRate;
      }

      if (dn.gt(debtInFrontRatio, REDEMPTION_RISK.low) && !lowThresholdRate) {
        lowThresholdRate = prevRate;
        // low threshold found: no need to continue
        break;
      }
    }

    const chartRates = interestChartData.data.map(({ rate }) => dn.from(rate / 100, 18)[0]);
    return [
      mediumThresholdRate !== null ? rateToSliderPosition(dn.from(mediumThresholdRate / 100, 18)[0], chartRates) : 0,
      lowThresholdRate !== null ? rateToSliderPosition(dn.from(lowThresholdRate / 100, 18)[0], chartRates) : 0,
    ];
  }, [interestChartData.data, rateToSliderPosition]);

  const transition = useAppear(value !== -1);

  return transition((style, show) =>
    show && (
      <a.div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 260,
          paddingTop: 16,
          ...style,
        }}
      >
        <Slider
          gradient={gradientStops}
          gradientMode="high-to-low"
          chart={
            interestChartData.data?.map(({ size }) =>
              Math.max(0.1, size)
            ) ?? []
          }
          onChange={(value) => {
            if (interestChartData.data) {
              const index = Math.min(
                interestChartData.data.length - 1,
                Math.round(value * (interestChartData.data.length - 1)),
              );
              fieldValue.setValue(String(
                interestChartData.data[index]?.rate ?? 0
              ));
            }
          }}
          value={value}
        />
      </a.div>
    )
  );
}