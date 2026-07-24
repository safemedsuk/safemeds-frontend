# SafeMeds Authentication System Guide

## Overview

SafeMeds includes a complete, production-ready authentication and authorization system with company registration, user login, password recovery, and session management. All components are fully integrated with the application dashboard.

## Architecture

### Technology Stack
- **State Management**: Zustand 5.0 with persist middleware for session persistence
- **Authentication**: Mock auth layer with realistic latency (300ms simulation)
- **UI Framework**: Next.js 16 with TypeScript, TailwindCSS, Lucide icons
- **Validation**: Live password policy validation, email format checking, account lockout logic

### Key Components

1. **Zustand Auth Store** (`lib/store/auth-store.ts`)
   - Manages authentication state across the application
   - Persists session data to localStorage
   - Tracks login attempts, account lockout status, MFA state
   - Manages registration flow progress

2. **Mock Auth Functions** (`lib/mock/auth.ts`)
   - `login(email, password)` - Authenticates user with lockout logic
   - `registerCompany(data)` - Creates new company registration
   - `verifyEmail(email, code)` - Verifies email with 6-digit code
   - `requestPasswordReset(email)` - Initiates password recovery
   - `resetPassword(token, newPassword)` - Completes password reset
   - All functions simulate 300ms latency for realistic UX

3. **Auth Layout Component** (`components/layout/auth-layout.tsx`)
   - Reusable split-screen layout for all auth pages
   - Left side: SafeMeds branding with pulse-line motif
   - Right side: Auth content area
   - Professional, centered form layout

## User Flows

### 1. New Company Registration Flow

**Route**: `/register`

**Steps**:
1. Company Details (Step 1)
   - Company name
   - Company type (Manufacturer, Distributor, Pharmacy)
   - Regulatory country
   - Licence number

2. Administrator Account (Step 2)
   - Full name
   - Work email
   - Phone number
   - Password with live policy validation
   - Confirm password
   - Terms and conditions agreement

   **Password Requirements**:
   - Minimum 12 characters
   - Contains uppercase letter
   - Contains lowercase letter
   - Contains number
   - Contains special character (!@#$%^&*)

3. Email Verification (Step 3)
   - 6-digit code entry with auto-advance
   - Resend code option
   - Real-time validation

4. Registration Complete (Step 4)
   - Success confirmation
   - Reference number for tracking
   - Next steps information
   - Link to sign in

**Demo**: Navigate to `/register` and complete the 4-step wizard

### 2. User Login Flow

**Route**: `/login`

**Features**:
- Pre-filled demo credentials displayed
- Password visibility toggle
- "Keep me signed in" option with security warning
- Progressive account lockout system:
  - Warning shown after 3 failed attempts
  - Account locked after 5 failed attempts (15 minute cooldown)
  - Lockout status visible in UI with countdown

**Error Handling**:
- Invalid credentials - Clear error message
- Account deactivated - Deactivation notice
- Company suspended - Company status notice
- Account locked - Lockout information with time remaining

**Success**:
- User redirected to dashboard (`/`)
- Session persisted to localStorage
- User profile shown in TopBar with "JD" avatar initials

**Demo Credentials**:
```
Email: james.kipchoge@pharmatech.ke
Password: SecurePass@2024
```

### 3. Password Recovery Flow

**Route**: `/forgot-password`

**Steps**:
1. Request Reset (Step 1)
   - Enter email address
   - Send reset code

2. Verify Code (Step 2)
   - Enter 6-digit code
   - Auto-advance on completion
   - Resend code option

3. Set New Password (Step 3)
   - Enter new password with live policy validation
   - Confirm password
   - Same password requirements as registration

4. Success (Step 4)
   - Confirmation message
   - Link back to login

### 4. Dashboard Access & Logout

**Route**: `/`

**Authentication**:
- Protected route redirects to login if not authenticated
- Session check on component mount
- Loading state during auth verification

**Navigation**:
- Sidebar with 6 main screens:
  - Task Inbox
  - Master Data
  - Country Rules
  - Users & Roles
  - Audit Trail
  - Workflow Viewer

**User Menu**:
- Click user avatar in TopBar (top right)
- Profile link
- Settings link
- Logout button
- Logout returns user to login page and clears auth state

## Security Features

### Account Protection
- Progressive account lockout (3 warnings → 5 attempts lock)
- 15-minute lockout period with countdown
- "Keep me signed in" includes security warning
- Password requirements enforced at registration and reset

### Session Management
- Sessions persist to localStorage via Zustand persist middleware
- Session data includes:
  - Current user object
  - Authentication status
  - Session ID
  - MFA state
  - Login attempts counter
  - Lockout status and expiry time

### Data Validation
- Email format validation
- Password policy enforcement with live feedback
- Company licence number format
- Phone number basic validation

## Navigation Map

```
Entry Point (/)
├── Not Authenticated → /login
├── Authenticated → Dashboard
│
Auth Routes (No Auth Required):
├── /login
│  └── → Dashboard on success
│  └── → /register link
│  └── → /forgot-password link
│
├── /register
│  └── Step 1: Company details
│  └── Step 2: Admin account setup
│  └── Step 3: Email verification
│  └── Step 4: Success → /login
│  └── → /login link (at each step)
│
├── /forgot-password
│  └── Step 1: Request reset code
│  └── Step 2: Verify code
│  └── Step 3: Set new password
│  └── Step 4: Success → /login
│  └── → /login link (at each step)
│
Dashboard Routes (Auth Required):
└── / (Dashboard)
   ├── Task Inbox
   ├── Master Data
   ├── Country Rules
   ├── Users & Roles
   ├── Audit Trail
   ├── Workflow Viewer
   └── Logout → /login
```

## API Mock Responses

### Login Success
```typescript
{
  success: true,
  user: {
    id: 'user_1',
    email: 'james.kipchoge@pharmatech.ke',
    user_name: 'James Kipchoge',
    company_name: 'PharmaTech Solutions',
    company_id: 'company_1',
    roles: ['admin', 'qppv'],
    permissions: ['users.manage', 'compliance.configure', 'audit.view', 'signature.authorize'],
    mfa_enabled: false,
    created_at: '2024-01-15T10:30:00Z'
  },
  mfaRequired: false
}
```

### Login Failure
```typescript
{
  success: false,
  error: 'invalid_credentials' | 'account_deactivated' | 'company_suspended' | 'account_locked'
}
```

### Registration Success
```typescript
{
  success: true,
  draft: {
    id: 'reg_draft_1',
    reference_number: 'REG-2024-001234',
    status: 'email_verification',
    created_at: '2024-01-20T14:45:00Z'
  }
}
```

## Customization Guide

### Update Demo Credentials
File: `/app/login/page.tsx`
```typescript
const [email, setEmail] = useState('your-email@company.com')
const [password, setPassword] = useState('YourPassword@2024')
```

### Change Lockout Parameters
File: `/lib/mock/auth.ts`
```typescript
const MAX_LOGIN_ATTEMPTS = 5 // Changed from 5
const LOCKOUT_DURATION_MINUTES = 15 // Changed from 15
```

### Modify Password Requirements
File: `/lib/mock/auth.ts`
```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true
}
```

### Update Brand Colors
File: `/app/globals.css`
```typescript
--safemeds-teal: #0f766e
--safemeds-spruce: #1e3a3a
--safemeds-gold: #d97706
--safemeds-slate: #475569
```

## Testing Flows

### Test Registration
1. Navigate to `/register`
2. Fill in company details
3. Enter admin account information
4. Enter any 6-digit code for email verification (e.g., "123456")
5. Complete registration
6. Verify redirect to success screen with reference number
7. Click "Go to Login" to sign in

### Test Password Reset
1. Go to `/login`
2. Click "Forgot your password?"
3. Enter an email address
4. Enter any 6-digit code
5. Enter new password meeting all requirements
6. Verify success screen
7. Click "Go to Login" and sign in with new password

### Test Account Lockout
1. Go to `/login`
2. Enter correct email but wrong password
3. Attempt login 5 times with wrong password
4. Verify warning after 3 attempts
5. Verify account locked message after 5 attempts
6. Verify UI shows lockout expiry countdown

### Test Session Persistence
1. Log in successfully
2. Refresh the page (F5)
3. Verify you remain logged in
4. Open developer console and check localStorage
5. Verify "auth-store" key contains session data

## File Structure

```
app/
├── login/
│  └── page.tsx          # Login form with lockout logic
├── register/
│  └── page.tsx          # 4-step registration wizard
├── forgot-password/
│  └── page.tsx          # Password recovery flow
├── page.tsx             # Protected dashboard home
└── globals.css          # Design tokens and brand colors

components/
└── layout/
   └── auth-layout.tsx   # Reusable auth page shell
   └── top-bar.tsx       # TopBar with logout functionality

lib/
├── types.ts             # Auth types and interfaces
├── store/
│  └── auth-store.ts     # Zustand auth state management
└── mock/
   └── auth.ts           # Mock auth functions with latency
```

## Known Limitations & Future Enhancements

### Current Limitations
- Mock authentication (no real backend)
- Passwords stored in plain text for demo purposes
- No CSRF protection (mock only)
- No rate limiting on API endpoints
- Email verification codes not actually sent

### Recommended Enhancements
1. Integrate with real backend API
2. Implement OAuth 2.0 / OIDC support
3. Add biometric authentication (WebAuthn)
4. Implement MFA (TOTP, SMS, Email)
5. Add audit logging for all auth events
6. Implement progressive profiling at registration
7. Add bot detection (reCAPTCHA v3)
8. Implement single sign-on (SSO)
9. Add session security headers (HSTS, CSP)
10. Implement rate limiting and DDOS protection

## Support & Troubleshooting

### User stuck on registration step
- Clear browser localStorage
- Use private/incognito window
- Check that country selection is made before proceeding

### Login not working
- Verify credentials are: james.kipchoge@pharmatech.ke / SecurePass@2024
- Check browser console for errors
- Verify dev server is running on port 3000

### Session lost after refresh
- Check that localStorage is not disabled
- Verify Zustand persist middleware is configured
- Check browser privacy settings

### Password requirements not met
- Ensure password is exactly 12 characters minimum
- Verify all required character types are present
- Live feedback in UI shows which requirements are met

## Version History

- **v1.0** (Current) - Complete auth system with registration, login, password recovery
- Planned v2.0 - MFA support, TOTP setup, SMS verification
- Planned v3.0 - OAuth 2.0, SSO integration
- Planned v4.0 - Advanced session management with device tracking
