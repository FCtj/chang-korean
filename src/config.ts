// 공개 설정값 — 앱 안에 그대로 들어가도 되는 값만 넣으세요.
// ⚠️ Supabase secret / service_role 키, Facebook App Secret 은 절대 여기(또는 저장소 어디에도) 넣지 마세요.
//    Facebook App Secret 은 Supabase 대시보드(Authentication → Providers → Facebook)에만 넣습니다.
// GitHub 저장소 변수(SUPABASE_URL / SUPABASE_ANON_KEY)가 있으면 그 값이 우선입니다.

/** Supabase 프로젝트 주소 (예: https://abcdxyz.supabase.co). 비어 있으면 예시 모드로 동작 */
export const SUPABASE_URL = 'https://aoonpimjvqrdfbkeomya.supabase.co'
/** Supabase Publishable key (공개용) */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RsM7yDx8h6mnHosgkZ4FyA_ope7AahS'
/** Facebook 앱 ID (공개값. 로그인은 Supabase 가 처리하므로 앱 코드에서는 참고용) */
export const FACEBOOK_APP_ID = '2530711987415134'
/** 웹사이트 주소 (앱에서 개인정보처리방침 등을 열 때 사용) */
export const SITE_URL = 'https://fctj.github.io/chang-korean/'
/** 개인정보처리방침 · 데이터 삭제 안내 페이지에 보일 문의 이메일. 비어 있으면 GitHub 문의 링크로 대신함 */
export const CONTACT_EMAIL = 'iamexample2@gmail.com'
/**
 * 처음 소개용 간단 모드: 시작 한 단계 → 30초 체험 + 환영 포인트 → 홈은 '이어하기'와 '내 포인트'만 크게.
 * 단어팩·트랙·계급·커뮤니티·랭킹은 그대로 있고 '더 배우기' / '랭킹 보기' 안에 접혀 있음. false 면 전체 화면.
 */
export const SIMPLE_MODE = true
/**
 * Facebook 로그인 버튼. Meta 앱이 '개발 모드'인 동안은 역할 없는 사람이 로그인할 수 없어서 끔 (카카오만 보임).
 * 꺼져 있어도 주소 끝에 ?fb=1 을 붙여 열면 그 기기에서는 보임 — Meta 검수·관리자 시험용 (?fb=0 으로 다시 숨김).
 * Meta 앱이 Live 가 되면 true.
 */
export const FACEBOOK_LOGIN = false
/** 커뮤니티(게시판·그룹·댓글·공유) — 지금은 단어 외우기에 집중하려고 꺼 둠. true 로 바꾸면 다시 보임 (코드·DB 는 그대로) */
export const COMMUNITY_ENABLED = false
/** 랭킹(순위표) 탭. 일본어·영어판은 판마다 따로 (edition_points) */
export const RANKING_ENABLED = true
/** 포인트·커피 도장·교환소 화면 — 지금은 꺼 둠 (포인트 정책을 정한 뒤 켜기).
 *  꺼 둬도 포인트 기록은 안 보이게 그대로 쌓임 */
export const POINTS_ENABLED = false
/** 테스트 기간: 다른 사람에게 보이는 이름은 항상 일부 가림(K*y) · 사진은 모자이크 (랭킹 · 그룹 · 설정의 '이렇게 보여요') */
export const ALWAYS_MASK = true
/** 다른 사람에게 내 이름·사진이 보이는 곳(랭킹·커뮤니티)이 있을 때만 '가리기' 설정을 보여 줌 */
export const PUBLIC_PROFILE = RANKING_ENABLED || COMMUNITY_ENABLED
/** 체험을 마치면 주는 환영 포인트 */
export const WELCOME_POINTS = 100
/** 테스트 기간 예시 데이터: 지인 15명을 랭킹에 섞고, 포인트 교환 내역(커피·치킨 등) 예시를 보여 줌.
 *  화면에는 '예시' 표시가 붙음. 실제 사용자·실제 교환이 생기면 false 로 끄면 됨 */
export const SAMPLE_DATA = false
