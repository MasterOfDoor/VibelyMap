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

export default function WalletConnectionScreen() {
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
    if (!err) return "Bilinmeyen hata";
    
    const message = err.message || err.toString();
    
    if (message.includes("rejected") || message.includes("User rejected")) {
      return "Cüzdan bağlantısı reddedildi. Lütfen cüzdanınızda bağlantıyı onaylayın.";
    }
    if (message.includes("not found") || message.includes("install")) {
      return "Cüzdan bulunamadı. Lütfen cüzdan uygulamasını yükleyin ve tekrar deneyin.";
    }
    if (message.includes("network") || message.includes("chain")) {
      return "Ağ hatası. Lütfen cüzdanınızda Base ağının seçili olduğundan emin olun.";
    }
    
    return `Bağlantı hatası: ${message}`;
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWallet(walletId);
    setConnectionError(null);
    
    const walletConnector = connectors.find((c) => c.id === walletId);
    
    if (!walletConnector) {
      setConnectionError("Seçilen cüzdan bulunamadı.");
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
      let description = "Cüzdan ile bağlan";

      if (connector.id === "baseAccounts" || connector.id.includes("baseAccounts")) {
        name = "Base Account";
        icon = "🔷";
        description = "Base Mini App için optimize edilmiş hesap";
      } else if (connector.id.includes("coinbase") || connector.id.includes("coinbaseWalletSDK")) {
        name = "Coinbase Wallet";
        icon = "🔷";
        description = "Coinbase cüzdanı ile bağlan";
      } else if (connector.id.includes("metaMask") || connector.id.includes("injected")) {
        name = "MetaMask";
        icon = "🦊";
        description = "Popüler Web3 cüzdanı";
      } else if (connector.id === "io.metamask") {
        name = "MetaMask";
        icon = "🦊";
        description = "MetaMask cüzdanı";
      } else if (connector.id.includes("walletConnect")) {
        name = "WalletConnect";
        icon = "🔗";
        description = "QR kod ile bağlan";
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
            <h1 className="connection-title">Cüzdan Bağlanıyor...</h1>
            <p className="connection-subtitle">
              Lütfen cüzdanınızda bağlantıyı onaylayın
            </p>
          </div>
          
          <div className="connection-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>

          <div className="connection-instructions">
            <p className="instruction-text">
              <strong>Adım 1:</strong> Cüzdan uygulamanızda açılan popup'ı kontrol edin
            </p>
            <p className="instruction-text">
              <strong>Adım 2:</strong> "Bağlan" veya "Approve" butonuna tıklayın
            </p>
            <p className="instruction-text">
              <strong>Adım 3:</strong> İşlemi onaylayın
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
            <h1 className="connection-title">Bağlantı Hatası</h1>
            <p className="connection-subtitle error-text">{connectionError}</p>
          </div>

          <div className="error-details">
            <h2 className="error-title">Çözüm önerileri:</h2>
            <ul className="error-list">
              <li>Cüzdan uygulamanızın açık ve hazır olduğundan emin olun</li>
              <li>Base ağının cüzdanınızda seçili olduğunu kontrol edin</li>
              <li>Tarayıcı izinlerinizi kontrol edin</li>
              <li>Cüzdan uygulamanızı yeniden başlatmayı deneyin</li>
            </ul>
          </div>

          <div className="connection-actions">
            <button
              onClick={handleRetry}
              className="btn-primary"
              aria-label="Tekrar dene"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cüzdan seçim ekranı
  return (
    <div className="wallet-connection-screen" role="main">
      <div className="connection-container">
        <div className="connection-header">
          <div className="connection-icon">🔐</div>
          <h1 className="connection-title">Cüzdan Bağlantısı</h1>
          <p className="connection-subtitle">
            Uygulamayı kullanmak için cüzdanınızı bağlamanız gerekiyor
          </p>
        </div>

        <div className="security-notice">
          <p className="security-text">
            <strong>🔒 Güvenlik:</strong> Cüzdan bilgileriniz sadece sizin kontrolünüzdedir.
            Hiçbir zaman özel anahtarlarınızı paylaşmayın.
          </p>
        </div>

        <div className="wallet-options" role="list" aria-label="Cüzdan seçenekleri">
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
                aria-label={`${wallet.name} ile bağlan`}
              >
                <div className="wallet-icon">{wallet.icon}</div>
                <div className="wallet-info">
                  <h3 className="wallet-name">{wallet.name}</h3>
                  <p className="wallet-description">{wallet.description}</p>
                </div>
                {!isAvailable && (
                  <span className="wallet-status" aria-label="Kullanılamıyor">
                    Kurulu Değil
                  </span>
                )}
                {isPendingConnection && (
                  <span className="wallet-status" aria-label="Bağlanıyor">
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
              Cüzdanınız yok mu? Nasıl oluşturulur?
            </summary>
            <div className="help-content">
              <p>
                <strong>Base Wallet:</strong> Base ekosisteminde optimize edilmiş cüzdan.
                Coinbase hesabınızla kolayca oluşturabilirsiniz.
              </p>
              <p>
                <strong>MetaMask:</strong> En popüler Web3 cüzdanı.
                <a
                  href="https://metamask.io/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="help-link"
                >
                  MetaMask'i indirin
                </a>
              </p>
              <p className="security-tip">
                <strong>💡 İpucu:</strong> Cüzdan oluştururken seed phrase'inizi güvenli bir
                yerde saklayın. Bunu kaybederseniz cüzdanınıza erişemezsiniz.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

