import {
  AuthPanel,
  type AuthenticationState,
  type SignInOptions,
  type SignUpResult,
} from '../../auth'

export interface AuthGatewayProps {
  authentication: AuthenticationState
  onSignIn: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<boolean>
  onSignUp: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<SignUpResult | null>
  onSignInWithDiscord: (options?: SignInOptions) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

export function AuthGateway({
  authentication,
  onSignIn,
  onSignUp,
  onSignInWithDiscord,
  onSignOut,
}: AuthGatewayProps) {
  return (
    <section className="auth-gateway" aria-labelledby="auth-gateway-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Account access</p>
        <h2 id="auth-gateway-title">Sign in to continue</h2>
        <p>
          Prepare this device for account-backed progression before opening the run dashboard.
        </p>
        <AuthPanel
          authentication={authentication}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          onSignInWithDiscord={onSignInWithDiscord}
          onSignOut={onSignOut}
        />
      </div>
    </section>
  )
}
