export interface User {
  id: string;
  username: string;
  email: string;
  permissions: string[];
  settings: UserSettings;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: number;
  lastLogin: number | null;
  loginCount: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  searchHistory: boolean;
  autoCheckSource: boolean;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  browser: boolean;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  verificationCode?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  verificationCode: string;
  code?: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  verificationCode?: string;
}

export interface DeleteAccountRequest {
  verificationCode: string;
  confirmText: string;
  password?: string;
}

export interface SendVerificationCodeRequest {
  email: string;
  verificationType: 'registration' | 'password_reset' | 'email_change_old' | 'email_change_new' | 'account_delete';
  force?: boolean;
}

export interface VerificationStatusResponse {
  hasPendingCode: boolean;
  canResend: boolean;
  remainingTime: number;
}

export interface EmailChangeRequest {
  newEmail: string;
  currentPassword: string;
}

export interface SendEmailChangeCodeRequest {
  requestId: string;
  emailType: 'old' | 'new';
}

export interface VerifyEmailChangeCodeRequest {
  requestId: string;
  emailType: 'old' | 'new';
  code: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  userId: string;
  username: string;
}
