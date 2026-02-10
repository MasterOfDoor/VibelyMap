"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  connector: any;
}

const SKIP_STORAGE_KEY = "vibelymap_skip_login";

export default function WalletConnectionScreen({ onSkip }: { onSkip?: () => void }) {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStep, setConnectionStep] = useState<"select" | "connecting" | "error">("select");

  // Base Account'u otomatik bağlamayı devre dışı bırakıyoruz
  // Kullanıcı manuel olarak wallet seçecek

  // Hata durumunu yönet
  useEffect(() => {
    if (error) {
      setConnectionError(getErrorMessage(error));
      setConnectionStep("error");
      setSelectedWallet(null);
    }
  }, [error]);

  // Başarılı bağlantı
  useEffect(() => {
    if (isConnected && address) {
      setConnectionError(null);
      setConnectionStep("select");
    }
  }, [isConnected, address]);

  const getErrorMessage = (err: any): string => {
    if (!err) return "Unknown error";
    
    const message = err.message || err.toString();
    
    if (message.includes("rejected") || message.includes("User rejected")) {
      return "Wallet connection rejected. Please approve the connection in your wallet.";
    }
    if (message.includes("not found") || message.includes("install")) {
      return "Wallet not found. Please install the wallet app and try again.";
    }
    if (message.includes("network") || message.includes("chain")) {
      return "Network error. Please make sure Base network is selected in your wallet.";
    }
    
    return `Connection error: ${message}`;
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWallet(walletId);
    setConnectionError(null);
    
    const walletConnector = connectors.find((c) => c.id === walletId);
    
    if (!walletConnector) {
      setConnectionError("Selected wallet not found.");
      setConnectionStep("error");
      return;
    }

    setConnectionStep("connecting");
    
    try {
      connect({ connector: walletConnector, chainId: base.id });
    } catch (err: any) {
      setConnectionError(getErrorMessage(err));
      setConnectionStep("error");
    }
  };

  const handleRetry = () => {
    setConnectionError(null);
    setConnectionStep("select");
    setSelectedWallet(null);
  };

  // Mevcut connector'ları kullan (OnchainKit zaten yapılandırmış)
  // Base Account dahil tüm wallet'ları göster
  const walletOptions = connectors
    .map((connector) => {
      let name = connector.name;
      let icon = "🔗";
      let description = "Connect with wallet";

      if (connector.id === "baseAccounts" || connector.id.includes("baseAccounts")) {
        name = "Base Account";
        icon = "🔷";
        description = "Optimized account for Base Mini App";
      } else if (connector.id.includes("coinbase") || connector.id.includes("coinbaseWalletSDK")) {
        name = "Coinbase Wallet";
        icon = "🔷";
        description = "Connect with Coinbase Wallet";
      } else if (connector.id.includes("metaMask") || connector.id.includes("injected")) {
        name = "MetaMask";
        icon = "🦊";
        description = "Popular Web3 wallet";
      } else if (connector.id === "io.metamask") {
        name = "MetaMask";
        icon = "🦊";
        description = "MetaMask wallet";
      } else if (connector.id.includes("walletConnect")) {
        name = "WalletConnect";
        icon = "🔗";
        description = "Connect with QR code";
      }

      return {
        id: connector.id,
        name,
        icon,
        description,
        connector,
      };
    });

  // Bağlanıyor durumu
  if (isConnecting || connectionStep === "connecting") {
    return (
      <div className="wallet-connection-screen" role="main" aria-live="polite">
        <div className="connection-container">
          <div className="connection-header">
            <div className="connection-icon animate-pulse">
              {selectedWallet === "baseAccounts" || selectedWallet?.includes("baseAccounts") 
                ? "🔷" 
                : selectedWallet === "coinbaseWalletSDK" 
                ? "🔷" 
                : "🔗"}
            </div>
            <h1 className="connection-title">Connecting Wallet...</h1>
            <p className="connection-subtitle">
              Please approve the connection in your wallet
            </p>
          </div>
          
          <div className="connection-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>

          <div className="connection-instructions">
            <p className="instruction-text">
              <strong>Step 1:</strong> Check the popup in your wallet app
            </p>
            <p className="instruction-text">
              <strong>Step 2:</strong> Click "Connect" or "Approve" button
            </p>
            <p className="instruction-text">
              <strong>Step 3:</strong> Confirm the transaction
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Hata durumu
  if (connectionStep === "error" && connectionError) {
    return (
      <div className="wallet-connection-screen" role="main" aria-live="assertive">
        <div className="connection-container">
          <div className="connection-header">
            <div className="connection-icon error">⚠️</div>
            <h1 className="connection-title">Connection Error</h1>
            <p className="connection-subtitle error-text">{connectionError}</p>
          </div>

          <div className="error-details">
            <h2 className="error-title">Suggested solutions:</h2>
            <ul className="error-list">
              <li>Make sure your wallet app is open and ready</li>
              <li>Check that Base network is selected in your wallet</li>
              <li>Check your browser permissions</li>
              <li>Try restarting your wallet app</li>
            </ul>
          </div>

          <div className="connection-actions">
            <button
              onClick={handleRetry}
              className="btn-primary"
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SKIP_STORAGE_KEY, "1");
    }
    onSkip?.();
  };

  // Cüzdan seçim ekranı
  return (
    <div className="wallet-connection-screen relative" role="main">
      <div className="connection-container relative pt-2 pr-16">
        {onSkip && (
          <button
            type="button"
            onClick={handleSkip}
            className="absolute top-4 right-4 z-[100] w-10 h-10 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 text-gray-700 hover:text-gray-900 border-2 border-gray-400/50 shadow-lg transition-colors"
            aria-label="Geçici olarak atla (giriş yapmadan devam et)"
            title="Geçici olarak atla"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <div className="connection-header">
          <div className="connection-icon">🔐</div>
          <h1 className="connection-title">Wallet Connection</h1>
          <p className="connection-subtitle">
            You need to connect your wallet to use the app
          </p>
        </div>

        <div className="security-notice">
          <p className="security-text">
            <strong>🔒 Security:</strong> Your wallet information is only under your control.
            Never share your private keys.
          </p>
        </div>

        <div className="wallet-options" role="list" aria-label="Wallet options">
          {walletOptions.map((wallet) => {
            const isAvailable = connectors.some((c) => c.id === wallet.id);
            const isPendingConnection = isPending && selectedWallet === wallet.id;

            return (
              <button
                key={wallet.id}
                onClick={() => handleWalletSelect(wallet.id)}
                disabled={!isAvailable || isPendingConnection}
                className={`wallet-option ${!isAvailable ? "disabled" : ""} ${isPendingConnection ? "pending" : ""}`}
                role="listitem"
                aria-label={`Connect with ${wallet.name}`}
              >
                <div className="wallet-icon">{wallet.icon}</div>
                <div className="wallet-info">
                  <h3 className="wallet-name">{wallet.name}</h3>
                  <p className="wallet-description">{wallet.description}</p>
                </div>
                {!isAvailable && (
                  <span className="wallet-status" aria-label="Not available">
                    Not Installed
                  </span>
                )}
                {isPendingConnection && (
                  <span className="wallet-status" aria-label="Connecting">
                    ...
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="connection-help">
          <details className="help-details">
            <summary className="help-summary">
              Don't have a wallet? How to create one?
            </summary>
            <div className="help-content">
              <p>
                <strong>Base Wallet:</strong> Optimized wallet for Base ecosystem.
                You can easily create one with your Coinbase account.
              </p>
              <p>
                <strong>MetaMask:</strong> The most popular Web3 wallet.
                <a
                  href="https://metamask.io/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="help-link"
                >
                  Download MetaMask
                </a>
              </p>
              <p className="security-tip">
                <strong>💡 Tip:</strong> When creating a wallet, store your seed phrase in a
                safe place. If you lose it, you cannot access your wallet.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

