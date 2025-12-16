/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    
    // Ignore optional dependencies that are not needed in browser
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      };
      
      // Ignore these modules in webpack
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@react-native-async-storage\/async-storage$/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^pino-pretty$/,
        })
      );
    }
    
    return config;
  },
  // Suppress console errors in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // API body size limit (App Router için)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // 10MB body size limit
    },
  },
}

export default nextConfig

