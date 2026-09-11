/**
 * Which backend this build serves, and whether the development tools show.
 *
 * `VITE_APP_ENVIRONMENT` is defined at build time by vite.config.ts: an
 * explicit value wins, otherwise Netlify's deploy context decides for a hosted
 * build and the Vite mode for a local one. Only "dev" is ever shown to the
 * player, in the header's build stamp.
 *
 * The development tools used to hang off `import.meta.env.DEV`, which is only
 * true under `vite dev`. The dev deploy on Netlify is a production-mode build
 * of the dev branch, so it never had them. They now follow the environment:
 * on for a local dev server and for any build that serves the dev backend,
 * off for production. The server still guards the inventory grants behind the
 * admin role, so this flag decides what is shown, never what is allowed.
 */
export const APP_ENVIRONMENT: 'production' | 'dev' =
  import.meta.env.VITE_APP_ENVIRONMENT === 'production' ? 'production' : 'dev'

export const DEVELOPMENT_TOOLS_ENABLED: boolean =
  import.meta.env.DEV || APP_ENVIRONMENT === 'dev'
