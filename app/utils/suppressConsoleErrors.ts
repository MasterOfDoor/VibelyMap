// Console hatalarını suppress et (development için)
if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = (...args: any[]) => {
    // Coinbase Analytics ve ad blocker hatalarını ignore et
    const message = args[0]?.toString() || "";
    if (
      message.includes("Analytics SDK") ||
      message.includes("Failed to fetch") ||
      message.includes("ERR_BLOCKED_BY_CLIENT") ||
      message.includes("cca-lite.coinbase.com")
    ) {
      return; // Bu hataları gösterme
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    // Coinbase Analytics uyarılarını ignore et
    const message = args[0]?.toString() || "";
    if (
      message.includes("Analytics SDK") ||
      message.includes("cca-lite.coinbase.com")
    ) {
      return; // Bu uyarıları gösterme
    }
    originalWarn.apply(console, args);
  };

  // Metamask loglarını suppress et (Base Mini App'te Metamask kullanılmıyor)
  console.log = (...args: any[]) => {
    // Tüm argümanları birleştirip tek bir string'e çevir
    const fullMessage = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // [log] [message] formatını kontrol et (Base.dev platform log formatı)
    const hasLogPrefix = args.some(arg => 
      typeof arg === 'string' && (arg === '[log]' || arg === '[message]')
    );
    
    // Metamask ile ilgili herhangi bir log'u filtrele
    if (
      fullMessage.toLowerCase().includes("metamask") ||
      fullMessage.includes("metamask-provider") ||
      fullMessage.includes("metamask-inpage") ||
      fullMessage.includes("metamask_chainChanged") ||
      fullMessage.includes('"target":"metamask-inpage"') ||
      fullMessage.includes('"name":"metamask-provider"') ||
      fullMessage.includes('"method":"metamask_chainChanged"') ||
      (hasLogPrefix && fullMessage.includes('metamask-inpage')) ||
      (hasLogPrefix && fullMessage.includes('metamask-provider')) ||
      (fullMessage.includes('[log]') && fullMessage.includes('metamask')) ||
      (fullMessage.includes('[message]') && fullMessage.includes('metamask'))
    ) {
      return; // Metamask loglarını gösterme
    }
    
    // Her argümanı ayrı ayrı kontrol et (nested object'ler için)
    for (const arg of args) {
      let argStr = '';
      if (typeof arg === 'string') {
        argStr = arg;
      } else if (typeof arg === 'object' && arg !== null) {
        try {
          argStr = JSON.stringify(arg);
        } catch {
          argStr = String(arg);
        }
      } else {
        argStr = String(arg);
      }
      
      if (
        argStr.toLowerCase().includes("metamask") ||
        argStr.includes("metamask-provider") ||
        argStr.includes("metamask-inpage") ||
        argStr.includes("metamask_chainChanged") ||
        argStr.includes('"target":"metamask-inpage"') ||
        argStr.includes('"name":"metamask-provider"')
      ) {
        return; // Metamask loglarını gösterme
      }
    }
    
    originalLog.apply(console, args);
  };
}
