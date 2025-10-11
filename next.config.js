/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Three.js transpilation
  transpilePackages: ['three'],
  
  // Experimental features for modern React/Next.js
  experimental: {
    esmExternals: 'loose'
  },
  
  // Webpack configuration for Three.js and Atlas Directive
  webpack: (config) => {
    // Handle Three.js examples imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'three/examples/jsm': 'three/examples/jsm'
    };

    // Handle .mjs files (for our validation scripts)
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto'
    });

    // Optimize for production
    if (!config.dev) {
      // Tree shaking for Three.js
      config.optimization.usedExports = true;
      
      // Reduce bundle size
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three',
            chunks: 'all',
            priority: 10
          }
        }
      };
    }

    return config;
  },
  
  // Static file handling
  // Commented out: No API routes exist, so /data rewrite is unnecessary
  // async rewrites() {
  //   return [
  //     {
  //       source: '/data/:path*',
  //       destination: '/api/data/:path*'
  //     }
  //   ];
  // },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif']
  },
  
  // Environment variables
  env: {
    ATLAS_VERSION: '1.0.0',
    BUILD_TIME: new Date().toISOString()
  }
};

module.exports = nextConfig;
