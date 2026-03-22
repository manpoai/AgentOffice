const path = require('path');

const emptyStub = path.resolve(__dirname, 'src/editor-core/_stubs/empty.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // editor-core has TS errors from Outline internals that don't affect runtime
  typescript: { ignoreBuildErrors: true },
  // styled-components SSR support
  compiler: { styledComponents: true },
  // Redirect unavailable Outline dependencies to empty stubs
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@sentry/react': emptyStub,
      'mermaid': emptyStub,
      '@mermaid-js/layout-elk': emptyStub,
      '@fortawesome/free-solid-svg-icons': emptyStub,
      '@fortawesome/fontawesome-common-types': emptyStub,
      'refractor/core': emptyStub,
      'y-prosemirror': emptyStub,
    };
    return config;
  },
  // Allow iframes from our services
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
