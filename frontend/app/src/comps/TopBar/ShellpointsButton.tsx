import { css } from "@/styled-system/css";
import { HFlex, ShellpointIcon } from "@liquity2/uikit";
import { LinkTextButton } from "../LinkTextButton/LinkTextButton";
import { useAccount } from "@/src/services/Arbitrum";
import { Address, parseEther } from "viem";
// import { useBalance } from "@/src/wagmi-utils";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { subtract, add, gt, format, multiply, eq } from "dnum";
import { Dnum } from "@/src/types";
import { a, useSpring } from "@react-spring/web";

export function ShellpointsButton() {
  const {address} = useAccount();
  
  if (!address) return null;
  
  return (
    <ShellpointsAnimatedBalance address={address} />
  )
}

function getShellpointsBalance(address: Address) {
  const localostorageKey = `shellpoints-balance-${address.toLowerCase()}`;
  const balance = localStorage.getItem(localostorageKey);
  if (!balance || balance === "0") return DNUM_0;
  return dnum18(balance);
}

function ShellpointsBalanceLinkButton({balance}: {balance: Dnum}) {
  return (
    <LinkTextButton
      href='/shellpoints'
      label={(
        <HFlex>
          <span className={css({
            fontSize: 16,
            fontWeight: 500,
          })}>{format(balance, 0)}</span>
          <ShellpointIcon size='medium' />
        </HFlex>
      )}
    />
  )
}

function ShellpointsAnimatedBalance({address}: {address: Address}) {
  const animationRef = useRef<NodeJS.Timeout>();
  const lastProcessedBalance = useRef<Dnum | null>(null);
  const [animatedBalance, setAnimatedBalance] = useState<Dnum>(DNUM_0);
  const [animatedDiff, setAnimatedDiff] = useState<Dnum>(DNUM_0);

  // Badge spring animation - must be before early returns to follow hooks rules
  const badgeSpring = useSpring({
    opacity: gt(animatedDiff, DNUM_0) ? 1 : 0,
    scale: gt(animatedDiff, DNUM_0) ? 1 : 0.8,
    config: { tension: 300, friction: 30 },
  });

  const localBalance = useMemo(() => {
    return getShellpointsBalance(address);
  }, [address]);

  // const { data: newBalance } = useBalance(address, "SHELL");
  const newBalance: Dnum = [parseEther("1369"), 18]; // TODO: Remove this and replace with useBalance (line above)

  const animateValues = useCallback((startBalance: Dnum, totalDiff: Dnum) => {
    const animationDuration = 2000; // 2 seconds
    const steps = 60; // 60 steps for smooth animation
    const stepDuration = animationDuration / steps;
    let currentStep = 0;

    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    animationRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      if (progress >= 1) {
        // Animation complete
        setAnimatedBalance(add(startBalance, totalDiff));
        setAnimatedDiff(DNUM_0);
        if (animationRef.current) {
          clearInterval(animationRef.current);
        }
        return;
      }

      // Calculate current animated values using proper Dnum operations
      const diffToAdd = multiply(totalDiff, progress);
      const remainingDiff = subtract(totalDiff, diffToAdd);

      setAnimatedBalance(add(startBalance, diffToAdd));
      setAnimatedDiff(remainingDiff);
    }, stepDuration);
  }, []);

  // Initialize animated values
  useEffect(() => {
    if (localBalance) {
      setAnimatedBalance(localBalance);
    }
  }, [localBalance]);

  useEffect(() => {
    if (newBalance && localBalance) {
      // Check if we've already processed this balance to prevent infinite loops
      if (lastProcessedBalance.current && eq(newBalance, lastProcessedBalance.current)) {
        return;
      }
      
      const calculatedDiff = subtract(newBalance, localBalance);
      
      // Start animation if there's a positive diff
      if (gt(calculatedDiff, DNUM_0)) {
        lastProcessedBalance.current = newBalance;
        setAnimatedDiff(calculatedDiff);
        animateValues(localBalance, calculatedDiff);
      }
    }
  }, [newBalance, localBalance, animateValues]);

  useEffect(() => {
    if (newBalance && gt(newBalance, DNUM_0)) {
      const currentStoredBalance = getShellpointsBalance(address);
      if (!currentStoredBalance || gt(newBalance, currentStoredBalance)) {
        localStorage.setItem(
          `shellpoints-balance-${address.toLowerCase()}`,
          newBalance[0].toString(),
        );
      }
    }
  }, [newBalance, address]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  return (
    <div className={css({ position: "relative" })}>
      <ShellpointsBalanceLinkButton balance={animatedBalance} />
      
      {/* Diff Badge */}
      {gt(animatedDiff, DNUM_0) && (
        <a.div
          style={{
            opacity: badgeSpring.opacity,
            transform: badgeSpring.scale.to(s => `scale(${s})`),
          }}
          className={css({
            position: "absolute",
            top: -8,
            right: -8,
            background: "positive",
            color: "positiveContent",
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 10,
            minWidth: 20,
            textAlign: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          })}
        >
          +{format(animatedDiff, 0)}
        </a.div>
      )}
    </div>
  );
}