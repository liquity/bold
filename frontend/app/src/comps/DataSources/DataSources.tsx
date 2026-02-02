"use client";

import type { ReactNode } from "react";

import content from "@/src/content";
import { CHAIN_RPC_URL, DEFAULT_CHAIN_RPC_URL, DEFAULT_SUBGRAPH_URL, SUBGRAPH_URL } from "@/src/env";
import {
  getRpcOverride,
  getSubgraphOverride,
  isValidUrl,
  setRpcOverride,
  setSubgraphOverride,
} from "@/src/data-sources-override";
import { css } from "@/styled-system/css";
import { Button, IconUndo, Modal, TextInput } from "@liquity2/uikit";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type DataSourcesContext = {
  openModal: () => void;
  isUsingCustomRpc: boolean;
  isUsingCustomSubgraph: boolean;
  currentRpcUrl: string;
  currentSubgraphUrl: string;
};

const DataSourcesContext = createContext<DataSourcesContext>({
  openModal: () => {},
  isUsingCustomRpc: false,
  isUsingCustomSubgraph: false,
  currentRpcUrl: "",
  currentSubgraphUrl: "",
});

export function useDataSources() {
  return useContext(DataSourcesContext);
}

export function DataSources({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const isUsingCustomRpc = getRpcOverride() !== null;
  const isUsingCustomSubgraph = getSubgraphOverride() !== null;

  const contextValue = useMemo(() => ({
    openModal: () => setVisible(true),
    isUsingCustomRpc,
    isUsingCustomSubgraph,
    currentRpcUrl: CHAIN_RPC_URL,
    currentSubgraphUrl: SUBGRAPH_URL,
  }), [isUsingCustomRpc, isUsingCustomSubgraph]);

  return (
    <DataSourcesContext.Provider value={contextValue}>
      {children}
      <DataSourcesModal
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </DataSourcesContext.Provider>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title={content.dataSources.resetToDefault}
      aria-label={content.dataSources.resetToDefault}
      onClick={onClick}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: 48,
        height: 48,
        padding: 0,
        color: "contentAlt",
        cursor: "pointer",
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
        outline: "none",
        _hover: {
          color: "accent",
          borderColor: "fieldBorderFocused",
        },
      })}
    >
      <IconUndo size={16} />
    </button>
  );
}

function DataSourcesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const currentRpcOverride = getRpcOverride();
  const currentSubgraphOverride = getSubgraphOverride();

  const [rpcUrl, setRpcUrl] = useState(currentRpcOverride ?? "");
  const [subgraphUrl, setSubgraphUrl] = useState(currentSubgraphOverride ?? "");
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [subgraphError, setSubgraphError] = useState<string | null>(null);

  const hasRpcOverride = currentRpcOverride !== null;
  const hasSubgraphOverride = currentSubgraphOverride !== null;

  const trimmedRpcUrl = rpcUrl.trim();
  const trimmedSubgraphUrl = subgraphUrl.trim();

  const rpcHasChanges = trimmedRpcUrl !== (currentRpcOverride ?? "");
  const subgraphHasChanges = trimmedSubgraphUrl !== (currentSubgraphOverride ?? "");
  const hasChanges = rpcHasChanges || subgraphHasChanges;

  const rpcIsEmpty = trimmedRpcUrl === "";
  const subgraphIsEmpty = trimmedSubgraphUrl === "";

  const handleCancel = useCallback(() => {
    setRpcUrl(currentRpcOverride ?? "");
    setSubgraphUrl(currentSubgraphOverride ?? "");
    setRpcError(null);
    setSubgraphError(null);
    onClose();
  }, [currentRpcOverride, currentSubgraphOverride, onClose]);

  const handleSave = useCallback(() => {
    let hasError = false;

    if (!rpcIsEmpty && !isValidUrl(trimmedRpcUrl)) {
      setRpcError(content.dataSources.validationError);
      hasError = true;
    }

    if (!subgraphIsEmpty && !isValidUrl(trimmedSubgraphUrl)) {
      setSubgraphError(content.dataSources.validationError);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    if (rpcIsEmpty) {
      setRpcOverride(null);
    } else if (rpcHasChanges) {
      setRpcOverride(trimmedRpcUrl);
    }

    if (subgraphIsEmpty) {
      setSubgraphOverride(null);
    } else if (subgraphHasChanges) {
      setSubgraphOverride(trimmedSubgraphUrl);
    }

    window.location.reload();
  }, [trimmedRpcUrl, trimmedSubgraphUrl, rpcIsEmpty, subgraphIsEmpty, rpcHasChanges, subgraphHasChanges]);

  const buttonLabel = (() => {
    const rpcWillReset = rpcIsEmpty && hasRpcOverride;
    const subgraphWillReset = subgraphIsEmpty && hasSubgraphOverride;

    if (rpcWillReset || subgraphWillReset) {
      return content.dataSources.resetButton;
    }
    return content.dataSources.saveButton;
  })();

  return (
    <Modal
      onClose={onClose}
      visible={visible}
      title={content.dataSources.title}
      maxWidth={540}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingTop: 24,
        })}
      >
        <p
          className={css({
            fontSize: 14,
            color: "content",
            lineHeight: 1.5,
          })}
        >
          {content.dataSources.description}
        </p>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
          })}
        >
          <label
            className={css({
              fontSize: 14,
              fontWeight: 500,
              color: "contentAlt",
            })}
          >
            {content.dataSources.rpcUrlLabel}
          </label>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
            })}
          >
            <TextInput
              value={rpcUrl}
              onChange={(value) => {
                setRpcUrl(value);
                setRpcError(null);
              }}
              placeholder={DEFAULT_CHAIN_RPC_URL}
            />
            {hasRpcOverride && (
              <ResetButton onClick={() => setRpcUrl("")} />
            )}
          </div>
          {rpcError && (
            <div
              className={css({
                color: "negative",
                fontSize: 14,
              })}
            >
              {rpcError}
            </div>
          )}
          <div
            className={css({
              fontSize: 12,
              color: "contentAlt2",
            })}
          >
            {hasRpcOverride
              ? content.dataSources.usingCustom("RPC", DEFAULT_CHAIN_RPC_URL)
              : content.dataSources.usingDefault("RPC")}
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
          })}
        >
          <label
            className={css({
              fontSize: 14,
              fontWeight: 500,
              color: "contentAlt",
            })}
          >
            {content.dataSources.subgraphUrlLabel}
          </label>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
            })}
          >
            <TextInput
              value={subgraphUrl}
              onChange={(value) => {
                setSubgraphUrl(value);
                setSubgraphError(null);
              }}
              placeholder={DEFAULT_SUBGRAPH_URL}
            />
            {hasSubgraphOverride && (
              <ResetButton onClick={() => setSubgraphUrl("")} />
            )}
          </div>
          {subgraphError && (
            <div
              className={css({
                color: "negative",
                fontSize: 14,
              })}
            >
              {subgraphError}
            </div>
          )}
          <div
            className={css({
              fontSize: 12,
              color: "contentAlt2",
            })}
          >
            {hasSubgraphOverride
              ? content.dataSources.usingCustom("subgraph", DEFAULT_SUBGRAPH_URL)
              : content.dataSources.usingDefault("subgraph")}
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          })}
        >
          <Button
            mode="secondary"
            label={content.dataSources.cancelButton}
            onClick={handleCancel}
          />
          <Button
            mode="primary"
            label={buttonLabel}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </div>
    </Modal>
  );
}
