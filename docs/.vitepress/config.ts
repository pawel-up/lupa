import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Lupa',
  description: 'The modern browser testing framework',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/lupa-icon.svg' }],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('consent', 'default', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied'
      });`,
    ],
    ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-RBNN7BPRNN' }],
    [
      'script',
      {},
      `gtag('js', new Date());
      gtag('config', 'G-RBNN7BPRNN');`,
    ],
  ],
  themeConfig: {
    logo: '/lupa-icon.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API Reference', link: '/api/' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Test Suites', link: '/guide/test-suites' },
          { text: 'Grouping Tests', link: '/guide/grouping-tests' },
          { text: 'Assertions', link: '/guide/assertions' },
          { text: 'Network Mocking', link: '/guide/network-mocking' },
          { text: 'Exceptions', link: '/guide/exceptions' },
        ],
      },
      {
        text: 'Browser Commands',
        items: [
          { text: 'Overview', link: '/guide/commands' },
          { text: 'Locator API', link: '/guide/locator' },
          { text: 'Keyboard API', link: '/guide/keyboard' },
          { text: 'Mouse API', link: '/guide/mouse' },
          { text: 'Cookies API', link: '/guide/cookies' },
          { text: 'FileChooser Interception', link: '/guide/file-chooser' },
          { text: 'Emulation API', link: '/guide/emulation' },
          { text: 'Screenshot API', link: '/guide/screenshot' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Datasets', link: '/guide/datasets' },
          { text: 'Test Macros', link: '/guide/test-macros' },
          { text: 'Lifecycle Hooks', link: '/guide/lifecycle-hooks' },
          { text: 'Plugins', link: '/guide/plugins' },
          { text: 'Skipping Tests', link: '/guide/skipping-tests' },
          { text: 'Filtering Tests', link: '/guide/filtering-tests' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'CLI Options', link: '/guide/cli' },
          { text: 'Test Reporters', link: '/guide/test-reporters' },
          { text: 'Vite Configuration', link: '/guide/vite-configuration' },
          { text: 'Customizing Harness', link: '/guide/customizing-harness' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/pawel-up/lupa' }],
  },
})
