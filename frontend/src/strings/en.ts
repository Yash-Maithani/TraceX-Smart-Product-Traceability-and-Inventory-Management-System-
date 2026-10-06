/**
 * Centralized user-facing copy and labels (SPEC §5.2, Phase 5 Part A & Part C).
 * Plain statements of what the product does; no marketing language, no invented figures.
 */
export const STRINGS = {
  app: {
    name: 'TraceX',
    tagline: 'Batch Freshness, Quality Inspection, and FEFO Dispatch System'
  },
  common: {
    skipToContent: 'Skip to main content',
    signOut: 'Sign out',
    signOutAll: 'Sign out everywhere',
    retry: 'Try again',
    requestIdLabel: 'Request ID',
    offlineBanner: 'You are offline or the server is unreachable. Changes cannot be saved until connection returns.'
  },
  nav: {
    sidebarLabel: 'Primary navigation',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    mobileDrawerTitle: 'Navigation menu'
  },
  roles: {
    'admin': 'Administrator',
    'manager': 'Manager',
    'factory-manager': 'Factory Manager',
    'quality-inspector': 'Quality Inspector',
    'dispatch-coordinator': 'Dispatch Coordinator'
  },
  theme: {
    light: 'Switch to light theme',
    dark: 'Switch to dark theme',
    paletteLabel: 'Color palette',
    accentLabel: 'Accent color',
    pageImagesLabel: 'Page backdrops',
    pageImagesOn: 'Page images: On',
    pageImagesOff: 'Page images: Off',
    palettes: {
      editorial: 'Editorial (Warm Paper)',
      obsidian: 'Obsidian (Cool Slate)',
      emerald: 'Emerald (Botanical)'
    },
    accents: {
      cobalt: 'Cobalt',
      emerald: 'Emerald',
      amber: 'Amber',
      rose: 'Rose'
    }
  },
  auth: {
    loginTitle: 'Sign in to TraceX',
    loginSubtitle: 'Enter your username and password to access batch and dispatch records.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Enter your username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    signInBtn: 'Sign in',
    signingInBtn: 'Signing in…',
    requestAccessLink: 'Request access',
    forgotPasswordLink: 'Forgot password?',
    backToLogin: 'Back to sign in',
    sessionExpiredBanner: 'Your session has expired or was revoked. Please sign in again.',
    deactivatedBanner: 'Your account has been deactivated. Contact an administrator.',
    rateLimitedBanner: 'Too many requests. Please wait and try again later.',

    requestAccessTitle: 'Request Account Access',
    requestAccessSubtitle: 'Submit your name, email address, and role for administrator review.',
    nameLabel: 'Full Name',
    namePlaceholder: 'Enter your full name',
    emailLabel: 'Email Address',
    emailPlaceholder: 'name@example.com',
    roleLabel: 'Role',
    submitRequestBtn: 'Submit Request',
    requestAccessSuccess: 'Access request submitted. An administrator will review your request and send an invitation link by email.',

    activateTitle: 'Activate Account',
    activateSubtitle: 'Set your account password to receive a 6-digit verification code by email.',
    inviteTokenLabel: 'Invitation Token',
    newPasswordLabel: 'New Password',
    confirmPasswordLabel: 'Confirm Password',
    activateBtn: 'Activate Account',

    verifyOtpTitle: 'Verify Email Code',
    verifyOtpSubtitle: 'Enter the 6-digit verification code sent to your email address.',
    otpLabel: 'Verification Code',
    otpPlaceholder: '6-digit code',
    verifyOtpBtn: 'Verify and Sign In',
    resendOtpBtn: 'Resend code',
    resendOtpSuccess: 'If the account is pending verification, a new 6-digit code has been sent.',

    forgotPasswordTitle: 'Forgot Password',
    forgotPasswordSubtitle: 'Enter your account email address to receive a 6-digit reset code.',
    sendResetCodeBtn: 'Send Reset Code',
    forgotPasswordSent: 'If an active account exists for that email address, a 6-digit reset code has been sent.',

    resetPasswordTitle: 'Reset Password',
    resetPasswordSubtitle: 'Verify your 6-digit reset code and choose a new password (at least 8 characters).',
    resetPasswordBtn: 'Reset Password',
    resetPasswordSuccess: 'Your password has been reset and existing sessions have been revoked. You can now sign in.'
  },
  home: {
    welcomePrefix: 'Signed in',
    phase5PlaceholderNotice: 'Phase 5 signed-in home placeholder. This view will be replaced by the operational dashboard in Phase 6.',
    currentRoleLabel: 'Assigned Role',
    roleGuardDemoLink: 'Open Admin Guard Demo (/admin-check)',
    roleGuardDemoTitle: 'Admin Guard Demonstration',
    roleGuardDemoBody: 'This route is protected by RequireRole for the admin role so client-side RBAC and the 403 ForbiddenState can be verified.'
  },
  states: {
    emptyDefaultTitle: 'No records found',
    emptyDefaultBody: 'There are no items matching the current criteria.',
    errorDefaultTitle: 'Unable to load data',
    errorDefaultBody: 'The request could not be completed.',
    forbiddenTitle: 'Access Restricted (403)',
    forbiddenBody: 'Your account role does not have permission to view this page.',
    notFoundTitle: 'Page Not Found (404)',
    notFoundBody: 'The requested page does not exist.',
    backToHome: 'Back to overview'
  },
  publicPages: {
    tracePlaceholderTitle: 'Public Batch Traceability',
    tracePlaceholderBody: 'Public QR batch traceability lookup screen placeholder (scheduled for Phase 10).',
    privacyTitle: 'Privacy Policy',
    privacyBody: 'TraceX stores operational batch, inspection, dispatch, and user account records required for food supply chain traceability.',
    termsTitle: 'Terms of Use',
    termsBody: 'Access to TraceX is restricted to authorized personnel. All state-changing actions are recorded in the audit log.'
  }
} as const;

export const en = STRINGS;
