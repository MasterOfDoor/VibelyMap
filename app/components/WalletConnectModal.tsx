"use client";

import { useAccount, useConnect } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({
  isOpen,
  onClose,
}: WalletConnectModalProps) {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected } = useAccount();

  if (!isOpen) return null;

  // Wallet bağlandıysa modal'ı kapat (onClose çağrılabilir)
  if (isConnected) {
    // Modal'ı kapat ama onClose boş fonksiyon olabilir
    return null;
  }

  const handleConnect = (connector: any) => {
    connect({ connector });
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
      onClick={() => {}} // Wallet bağlanmadan modal kapatılamaz
    >
      <div
        className="modal-content"
        style={{
          background: "linear-gradient(125deg, rgba(255, 252, 242, 0.98), rgba(233, 221, 189, 0.95))",
          borderRadius: "18px",
          padding: "32px",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "0 18px 50px rgba(95, 74, 36, 0.35)",
          border: "1px solid rgba(125, 103, 52, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
            Cüzdan Bağlantısı
          </h2>
          <p style={{ color: "#7a6c49", fontSize: "14px" }}>
            Uygulamayı kullanmak için cüzdanınızı bağlayın
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={isPending}
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(125, 103, 52, 0.25)",
                background: "rgba(255, 255, 255, 0.9)",
                cursor: isPending ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: 600,
                color: "#2b261a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                transition: "all 0.2s ease",
                opacity: isPending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.background = "rgba(212, 166, 87, 0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {connector.name === "Coinbase Wallet" && "🟦"}
              {connector.name === "MetaMask" && "🦊"}
              {connector.name}
              {isPending && "..."}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <p style={{ color: "#7a6c49", fontSize: "12px" }}>
            Uygulamayı kullanmak için cüzdanınızı bağlamanız gerekiyor
          </p>
        </div>
      </div>
    </div>
  );
}



