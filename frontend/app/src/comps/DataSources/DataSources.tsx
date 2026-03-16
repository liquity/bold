"use client";

import type { ReactNode } from "react";

import content from "@/src/content";
import {
  getRpcOverride,
  getSubgraphOverride,
  isValidUrl,
  setRpcOverride,
  setSubgraphOverride,
} from "@/src/data-sources-override";
import { DEFAULT_CHAIN_RPC_URL, DEFAULT_SUBGRAPH_URL } from "@/src/env";
import { css } from "@/styled-system/css";
import { Button, IconUndo, Modal, TextInput } from "@liquity2/uikit";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type DataSourcesContext = {
  openModal: () => void;
  isUsingCustomRpc: boolean;
  isUsingCustomSubgraph: boolean;
};

const DataSourcesContext = createContext<DataSourcesContext>({
  openModal: () => {},
  isUsingCustomRpc: false,
  isUsingCustomSubgraph: false,
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
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
      })}
    >
      <IconUndo size={16} />
    </button>
  );
}

function DataSourceField({
  label,
  value,
  onChange,
  placeholder,
  hasOverride,
  onReset,
  error,
  sourceName,
  defaultUrl,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasOverride: boolean;
  onReset: () => void;
  error: string | null;
  sourceName: string;
  defaultUrl: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 8,
      })}
    >
      <div
        className={css({
          fontSize: 14,
          fontWeight: 500,
          color: "contentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 8,
        })}
      >
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        {hasOverride && <ResetButton onClick={onReset} />}
      </div>
      {error && (
        <div
          className={css({
            color: "negative",
            fontSize: 14,
          })}
        >
          {error}
        </div>
      )}
      <div
        className={css({
          fontSize: 12,
          color: "contentAlt2",
        })}
      >
        {hasOverride
          ? content.dataSources.usingCustom(sourceName, defaultUrl)
          : content.dataSources.usingDefault(sourceName)}
      </div>
    </div>
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

        <DataSourceField
          label={content.dataSources.rpcUrlLabel}
          value={rpcUrl}
          onChange={(value) => {
            setRpcUrl(value);
            setRpcError(null);
          }}
          placeholder={DEFAULT_CHAIN_RPC_URL}
          hasOverride={hasRpcOverride}
          onReset={() => setRpcUrl("")}
          error={rpcError}
          sourceName="RPC"
          defaultUrl={DEFAULT_CHAIN_RPC_URL}
        />

        <DataSourceField
          label={content.dataSources.subgraphUrlLabel}
          value={subgraphUrl}
          onChange={(value) => {
            setSubgraphUrl(value);
            setSubgraphError(null);
          }}
          placeholder={DEFAULT_SUBGRAPH_URL}
          hasOverride={hasSubgraphOverride}
          onReset={() => setSubgraphUrl("")}
          error={subgraphError}
          sourceName="subgraph"
          defaultUrl={DEFAULT_SUBGRAPH_URL}
        />

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
