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
    roleDescriptions: {
      'factory-manager': 'Creates batches and imports production records.',
      'quality-inspector': 'Inspects batches and records pass or fail results.',
      'dispatch-coordinator': 'Dispatches stock from the queue, soonest expiry first.',
      'manager': 'Oversees operations, creates batches and views the team.',
      'admin': 'Manages users, roles and access requests.'
    },
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
  states: {
    emptyDefaultTitle: 'No records found',
    emptyDefaultBody: 'There are no items matching the current criteria.',
    errorDefaultTitle: 'Unable to load data',
    errorDefaultBody: 'The request could not be completed.',
    forbiddenTitle: 'You do not have access to this page',
    forbiddenTitleFor: (page: string) => `You do not have access to ${page}`,
    forbiddenBody: 'Ask an administrator if you need access.',
    forbiddenBodyFor: (role: string) => `Your role is ${role}. Ask an administrator if you need access.`,
    notFoundTitle: 'Page not found',
    notFoundBody: 'This link does not lead anywhere in TraceX. It may be mistyped or out of date.',
    backToHome: 'Go to the dashboard',
    backToStart: 'Go to the home page',
    superAdminRole: 'Super administrator',
    forbiddenRoles: (roles: readonly string[]) =>
      roles.length === 1 ? `This page is for the ${roles[0]} role.` : `This page is for these roles: ${roles.join(', ')}.`
  },
  publicPages: {
    privacyTitle: 'Privacy Policy',
    termsTitle: 'Terms and Conditions'
  }
} as const;

export const en = STRINGS;
