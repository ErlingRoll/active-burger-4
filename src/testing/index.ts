/**
 * Assertion helpers shared by every spec.
 *
 * Component-rendering helpers deliberately live in `./render` and are imported
 * directly: pulling Testing Library in through this barrel would load a
 * DOM-dependent library into the environment-free simulation suite.
 */
export { assertDefined, definedAt } from './assertDefined'
