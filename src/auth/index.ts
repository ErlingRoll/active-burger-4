export {
  createAuthenticationService,
  createAuthenticationServiceFromClient,
  getSupabaseClient,
  isAdminAppMetadata,
  isMissingProfileDisplayNameError,
  resolveProviderDisplayName,
  resolveAuthEnvironment,
  resolveAuthRedirectUrl,
} from './AuthService'
export type {
  AuthAccount,
  AuthEnvironment,
  AuthenticationService,
  SignInOptions,
  SignUpResult,
} from './AuthService'
export { AuthPanel } from './AuthPanel'
export type { AuthenticationState, AuthenticationStatus } from './AuthPanel'
export { AccountSettingsMenu } from './AccountSettingsMenu'
export { createNicknameService, validateNickname } from './NicknameService'
export type {
  NicknameChangeRequest,
  NicknameService,
  NicknameState,
} from './NicknameService'
export {
  DEFAULT_PLAYER_DISPLAY_NAME,
  getPlayerDisplayName,
} from './PlayerName'
export type { PlayerNameSources } from './PlayerName'
