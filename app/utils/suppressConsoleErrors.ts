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
    // Her argümanı ayrı ayrı kontrol et
    for (const arg of args) {
      let argStr = '';
      if (typeof arg === 'string') {
        argStr = arg;
      } else if (typeof arg === 'object') {
        argStr = JSON.stringify(arg);
      } else {
        argStr = String(arg);
      }
      
      // Metamask ile ilgili herhangi bir log'u filtrele
      // [log] [message] formatını da kontrol et
      if (
        argStr.toLowerCase().includes("metamask") ||
        argStr.includes("metamask-provider") ||
        argStr.includes("metamask-inpage") ||
        argStr.includes("metamask_chainChanged") ||
        argStr.includes("chainChanged") ||
        argStr.includes('"target":"metamask-inpage"') ||
        argStr.includes('"name":"metamask-provider"') ||
        (argStr.includes('[log]') && argStr.includes('metamask')) ||
        (argStr.includes('[message]') && argStr.includes('metamask')) ||
        (argStr.includes('networkVersion') && argStr.includes('metamask')) ||
        (argStr.includes('"target"') && argStr.includes('metamask'))
      ) {
        return; // Metamask loglarını gösterme
      }
    }
    
    // Tüm argümanları birleştirip tekrar kontrol et
    const fullMessage = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    if (
      fullMessage.toLowerCase().includes("metamask") ||
      fullMessage.includes("metamask-provider") ||
      fullMessage.includes("metamask-inpage") ||
      fullMessage.includes('"target":"metamask-inpage"')
    ) {
      return; // Metamask loglarını gösterme
    }
    
    originalLog.apply(console, args);
  };
}
