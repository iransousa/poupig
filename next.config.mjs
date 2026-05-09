/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'localhost:3009'] },
    serverComponentsExternalPackages: [
      '@kamino-finance/klend-sdk',
      '@kamino-finance/kliquidity-sdk',
      '@kamino-finance/kvault-sdk',
      '@kamino-finance/farms-sdk',
      '@kamino-finance/scope-sdk',
      '@orca-so/whirlpools',
      '@orca-so/whirlpools-core',
      '@orca-so/whirlpools-client',
      '@solana/kit',
      '@solana-program/address-lookup-table',
      '@solana-program/system',
      '@solana-program/token',
      '@solana-program/token-2022',
      'zstddec',
    ],
  },
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@orca-so/whirlpools-core': 'commonjs @orca-so/whirlpools-core',
      });
    }
    return config;
  },
};

export default nextConfig;
