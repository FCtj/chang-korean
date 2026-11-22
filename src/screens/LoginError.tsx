// 로그인 실패 안내: 원인을 쉬운 말로 + 운영자 확인용 원문
import { useApp } from '../ctx'
import { useAuth } from '../backend'
import type { StrKey } from '../i18n'

export function loginErrorKey(raw: string): StrKey {
  const m = raw.toLowerCase()
  if (m.includes('email')) return 'loginErrEmail'
  if (m.includes('code_exchange') || m.includes('code verifier') || m.includes('flow state')) return 'loginErrBrowser'
  if (m.includes('signup') || m.includes('sign up')) return 'loginErrSignup'
  return 'loginFailed'
}

export default function LoginError() {
  const { t } = useApp()
  const auth = useAuth()
  if (!auth.error || auth.status === 'in') return null
  return (
    <div className="login-error" role="alert">
      <strong>⚠️ {t(loginErrorKey(auth.error))}</strong>
      <code className="login-error-raw">{auth.error}</code>
    </div>
  )
}
