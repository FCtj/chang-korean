// 공개 설정값 — 앱 안에 그대로 들어가도 되는 값만 넣으세요.
// ⚠️ Supabase secret / service_role 키, Facebook App Secret 은 절대 여기(또는 저장소 어디에도) 넣지 마세요.
//    Facebook App Secret 은 Supabase 대시보드(Authentication → Providers → Facebook)에만 넣습니다.
// GitHub 저장소 변수(SUPABASE_URL / SUPABASE_ANON_KEY)가 있으면 그 값이 우선입니다.

/** Supabase 프로젝트 주소 (예: https://abcdxyz.supabase.co). 비어 있으면 예시 모드로 동작 */
export const SUPABASE_URL = ''
/** Supabase Publishable key (공개용) */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RsM7yDx8h6mnHosgkZ4FyA_ope7AahS'
/** Facebook 앱 ID (공개값. 로그인은 Supabase 가 처리하므로 앱 코드에서는 참고용) */
export const FACEBOOK_APP_ID = '1714624056889473'
/** 웹사이트 주소 (앱에서 개인정보처리방침 등을 열 때 사용) */
export const SITE_URL = 'https://fctj.github.io/chang-korean/'
/** 개인정보처리방침 · 데이터 삭제 안내 페이지에 보일 문의 이메일. 비어 있으면 GitHub 문의 링크로 대신함 */
export const CONTACT_EMAIL = ''
