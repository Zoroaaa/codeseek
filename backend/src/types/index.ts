/**
 * CodeSeek 后端类型定义
 * 功能：定义所有数据库实体、环境变量、API响应类型
 * 作者：CodeSeek Team
 * 日期：2024
 */

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  APP_VERSION?: string;
  ALLOW_REGISTRATION?: string;
  MIN_USERNAME_LENGTH?: string;
  MAX_USERNAME_LENGTH?: string;
  MIN_PASSWORD_LENGTH?: string;
  MAX_FAVORITES_PER_USER?: string;
  MAX_HISTORY_PER_USER?: string;
  MAX_TAGS_PER_USER?: string;
  ENABLE_ACTION_LOGGING?: string;
  JWT_EXPIRY_DAYS?: string;
  // Email configuration (defined in wrangler.toml [vars])
  DEFAULT_FROM_EMAIL?: string;
  DEFAULT_FROM_NAME?: string;
  SITE_URL?: string;
  EMAIL_VERIFICATION_ENABLED?: string;
  EMAIL_VERIFICATION_REQUIRED?: string;
  COMMUNITY_REQUIRE_APPROVAL?: string;
  COMMUNITY_MAX_SHARES_PER_USER?: string;
  ENABLE_SOURCE_STATUS_CHECK?: string;
  SOURCE_STATUS_CHECK_TIMEOUT?: string;
  SOURCE_STATUS_CACHE_DURATION?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
  permissions: string;
  settings: string;
  is_active: number;
  last_login: number | null;
  login_count: number;
  email_verified: number;
  last_password_change?: number | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  last_activity: number;
  ip_address: string | null;
  user_agent: string | null;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  url: string;
  icon: string | null;
  keyword: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserSearchHistory {
  id: string;
  user_id: string;
  query: string;
  source: string;
  results_count: number;
  created_at: number;
}

export interface UserAction {
  id: string;
  user_id: string | null;
  action: string;
  data: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface MajorCategory {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string;
  requires_keyword: number;
  display_order: number;
  is_system: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface SearchSourceCategory {
  id: string;
  major_category_id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string;
  default_searchable: number;
  default_site_type: string;
  search_priority: number;
  is_system: number;
  is_active: number;
  display_order: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface SearchSource {
  id: string;
  category_id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  icon: string | null;
  url_template: string;
  homepage_url: string | null;
  site_type: string;
  searchable: number;
  requires_keyword: number;
  search_priority: number;
  is_system: number;
  is_active: number;
  display_order: number;
  usage_count: number;
  last_used_at: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserSearchSourceConfig {
  id: string;
  user_id: string;
  source_id: string;
  is_enabled: number;
  custom_priority: number | null;
  custom_name: string | null;
  custom_subtitle: string | null;
  custom_icon: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface CommunitySourceTag {
  id: string;
  tag_name: string;
  tag_description: string | null;
  tag_color: string;
  usage_count: number;
  is_official: number;
  tag_active: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface CommunitySharedSource {
  id: string;
  user_id: string;
  source_name: string;
  source_subtitle: string | null;
  source_icon: string | null;
  source_url_template: string;
  source_category: string;
  description: string | null;
  tags: string | null;
  status: string;
  is_verified: number;
  is_featured: number;
  view_count: number;
  download_count: number;
  like_count: number;
  rating_score: number;
  rating_count: number;
  created_at: number;
  updated_at: number;
  last_tested_at: number | null;
}

export interface CommunitySourceReview {
  id: string;
  shared_source_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  is_anonymous: number;
  created_at: number;
  updated_at: number;
}

export interface CommunitySourceLike {
  id: string;
  shared_source_id: string;
  user_id: string;
  like_type: string;
  created_at: number;
}

export interface CommunitySourceDownload {
  id: string;
  shared_source_id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface CommunitySourceReport {
  id: string;
  shared_source_id: string;
  reporter_user_id: string;
  report_reason: string;
  report_details: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface CommunityUserStats {
  user_id: string;
  shared_sources_count: number;
  total_downloads: number;
  total_likes: number;
  total_views: number;
  reviews_given: number;
  sources_downloaded: number;
  tags_created: number;
  reputation_score: number;
  contribution_level: string;
  created_at: number;
  updated_at: number;
}

export interface EmailVerification {
  id: string;
  user_id: string | null;
  email: string;
  verification_code: string;
  verification_type: string;
  expires_at: number;
  created_at: number;
  ip_address?: string | null;
  user_agent?: string | null;
  attempt_count?: number;
  email_hash?: string | null;
  code_hash?: string | null;
  status?: string;
  metadata?: string;
}

export interface EmailChangeRequest {
  id: string;
  user_id: string;
  old_email: string;
  new_email: string;
  old_email_verified: number;
  new_email_verified: number;
  status: string;
  expires_at: number;
  created_at: number;
  updated_at: number | null;
}

export interface PasswordResetLog {
  id: string;
  user_id: string | null;
  email: string;
  request_type: string;
  request_status: string;
  ip_address: string | null;
  user_agent: string | null;
  verification_code_sent: number;
  verification_attempts: number;
  created_at: number;
  code_sent_at: number | null;
  verified_at: number | null;
  completed_at: number | null;
}

export interface SecurityLockout {
  id: string;
  lockout_type: string;
  identifier: string;
  attempt_count: number;
  max_attempts: number;
  lockout_duration: number;
  first_attempt_at: number;
  last_attempt_at: number;
  locked_until: number;
  created_at: number;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
}

export interface UserSecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  event_subtype: string | null;
  event_status: string;
  event_data: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  risk_score: number;
  risk_factors: string;
  created_at: number;
}

export interface EmailSendLog {
  id: string;
  user_id: string | null;
  recipient_email: string;
  email_type: string;
  send_status: string;
  provider: string;
  provider_message_id: string | null;
  subject: string | null;
  send_error: string | null;
  ip_address: string | null;
  rate_limit_key: string | null;
  created_at: number;
  sent_at: number | null;
  delivered_at: number | null;
}

export interface EmailTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  required_variables: string;
  optional_variables: string;
  is_active: number;
  version: number;
  created_at: number;
  updated_at: number;
  usage_count: number;
}

export interface SourceStatusCache {
  id: string;
  source_id: string;
  keyword: string;
  keyword_hash: string | null;
  status: string;
  available: number;
  content_match: number;
  response_time: number;
  quality_score: number;
  match_details: string | null;
  page_info: string | null;
  check_error: string | null;
  expires_at: number | null;
  created_at: number;
  last_accessed: number | null;
  access_count: number;
}

export interface SourceHealthStats {
  id: string;
  source_id: string;
  total_checks: number;
  successful_checks: number;
  content_matches: number;
  average_response_time: number;
  last_success: number | null;
  last_failure: number | null;
  success_rate: number;
  health_score: number;
  updated_at: number;
}

export interface StatusCheckJob {
  id: string;
  user_id: string;
  sources: string;
  keyword: string;
  status: string;
  progress: number;
  results: string;
  error_message: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  expires_at: number;
}

export interface SearchCache {
  id: string;
  keyword: string;
  keyword_hash: string;
  results: string;
  expires_at: number;
  created_at: number;
  access_count: number;
  last_accessed: number;
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  config_type: string;
  is_public: number;
  created_at: number;
  updated_at: number;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_type: string;
  event_data: string;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  created_at: number;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role?: string;
  iat: number;
  exp: number;
}
