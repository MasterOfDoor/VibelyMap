"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useUserProfile } from "../hooks/useUserProfile";

export default function UsernameSetupModal() {
  const { address, isConnected } = useAccount();
  const { profile, isLoading, updateUsername } = useUserProfile(address);
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profil yüklendiğinde ve kullanıcı adı yoksa modalı aç
  useEffect(() => {
    if (isConnected && !isLoading && profile && !profile.username) {
      setIsOpen(true);
    } else if (isConnected && !isLoading && !profile && !isLoading) {
      // Profil hiç yoksa da aç (yeni kayıt)
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isConnected, isLoading, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await updateUsername(username);
    if (result.success) {
      setIsOpen(false);
    } else {
      setError(result.error || "Bir hata oluştu");
    }
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
            👋
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Hoş Geldiniz!</h2>
          <p className="text-gray-500">
            Uygulamayı kullanmaya başlamadan önce kendinize benzersiz bir kullanıcı adı seçin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-semibold text-gray-700 ml-1">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="gurme_ismi"
                className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:bg-white transition-all outline-none font-medium text-lg"
                required
                minLength={3}
                maxLength={20}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 ml-1">
              Sadece harf, rakam ve alt çizgi (_) kullanabilirsiniz.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-3">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || username.length < 3}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform active:scale-95 ${
              isSubmitting || username.length < 3
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-dark hover:shadow-primary/30"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Başla"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
