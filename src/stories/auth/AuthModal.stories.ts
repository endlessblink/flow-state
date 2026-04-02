import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * AuthModal - Authentication Modal
 *
 * Modal overlay for login, signup, and password reset flows.
 * Uses BaseModal internally with glass morphism styling.
 *
 * **Note:** The real component uses `useAuthStore()`, `useUIStore()`,
 * and Supabase auth — so this story renders static visual replicas
 * of each auth view to avoid runtime errors.
 */
const meta: Meta = {
  title: '🔐 Auth/AuthModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Authentication modal with login, signup, and password reset views.

**Features:**
- Email/password login and signup
- Google OAuth sign-in button
- Password reset via email
- View switching (login ↔ signup ↔ reset)
- Auto-close on successful authentication

**Note:** Uses Supabase auth in real component. This story shows static visual replicas.`
      }
    }
  }
}

export default meta
type Story = StoryObj

const S = {
  page: 'min-height:100vh; background:var(--app-background-gradient); display:flex; align-items:center; justify-content:center; padding:var(--space-10) var(--space-4);',
  overlay: 'position:absolute; inset:0; background:var(--overlay-bg); backdrop-filter:blur(4px);',
  modal: 'position:relative; width:100%; max-width:420px; background:var(--surface-secondary); border:1px solid var(--border-medium); border-radius:var(--radius-lg); box-shadow:0 24px 48px var(--overlay-bg); backdrop-filter:blur(20px); overflow:hidden; padding:var(--space-8);',
  closeBtn: 'position:absolute; top:var(--space-4); right:var(--space-4); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--text-lg);',
  logo: 'display:flex; justify-content:center; margin-bottom:var(--space-6);',
  logoIcon: 'width:48px; height:48px; border-radius:var(--radius-lg); background:linear-gradient(135deg, var(--brand-primary-dim), var(--brand-primary-subtle)); border:1px solid var(--brand-primary-dim); display:flex; align-items:center; justify-content:center;',
  title: 'font-size:var(--text-xl); font-weight:600; color:var(--text-primary); text-align:center; margin:0 0 var(--space-1_5) 0;',
  subtitle: 'font-size:var(--text-meta); color:var(--text-muted); text-align:center; margin:0 0 var(--space-6) 0;',
  label: 'display:block; font-size:var(--text-xs); font-weight:500; color:var(--text-secondary); margin-bottom:var(--space-1_5);',
  input: 'width:100%; padding:var(--space-2_5) var(--space-3_5); background:var(--glass-bg-medium); border:1px solid var(--border-medium); border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-meta); outline:none; box-sizing:border-box;',
  fieldGroup: 'margin-bottom:var(--space-4);',
  primaryBtn: 'width:100%; padding:var(--space-3); background:var(--brand-primary-subtle); border:1px solid var(--brand-primary-dim); border-radius:var(--radius-md); color:var(--brand-primary); font-size:var(--text-sm); font-weight:600; cursor:pointer; backdrop-filter:blur(8px);',
  googleBtn: 'width:100%; padding:var(--space-3); background:var(--glass-bg-light); border:1px solid var(--glass-border-hover); border-radius:var(--radius-md); color:var(--text-secondary); font-size:var(--text-meta); font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:var(--space-2_5);',
  divider: 'display:flex; align-items:center; gap:var(--space-3); margin:var(--space-5) 0;',
  dividerLine: 'flex:1; height:1px; background:var(--border-subtle);',
  dividerText: 'font-size:var(--text-xs); color:var(--text-subtle); text-transform:uppercase; letter-spacing:0.05em;',
  link: 'color:var(--brand-primary); font-size:var(--text-xs); cursor:pointer; background:none; border:none; text-decoration:none;',
  switchRow: 'text-align:center; margin-top:var(--space-5); font-size:var(--text-xs); color:var(--text-muted);',
  forgotRow: 'text-align:right; margin-bottom:var(--space-4);',
  required: 'color:var(--color-priority-high);',
}

/**
 * Login View
 *
 * Default authentication view with email/password fields and Google sign-in.
 */
export const Login: Story = {
  name: 'Login View',
  parameters: {
    docs: {
      description: {
        story: 'Login form with email, password, Google OAuth, and links to signup/reset.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.modal">
          <button :style="S.closeBtn">&times;</button>

          <!-- Logo -->
          <div :style="S.logo">
            <div :style="S.logoIcon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
          </div>

          <h2 :style="S.title">Welcome Back</h2>
          <p :style="S.subtitle">Sign in to your FlowState account</p>

          <!-- Google Sign In -->
          <button :style="S.googleBtn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <!-- Divider -->
          <div :style="S.divider">
            <div :style="S.dividerLine"></div>
            <span :style="S.dividerText">or</span>
            <div :style="S.dividerLine"></div>
          </div>

          <!-- Email -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Email <span :style="S.required">*</span></label>
            <input :style="S.input" type="email" placeholder="Enter your email" readonly />
          </div>

          <!-- Password -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Password <span :style="S.required">*</span></label>
            <input :style="S.input" type="password" placeholder="Enter your password" value="••••••••" readonly />
          </div>

          <!-- Forgot Password -->
          <div :style="S.forgotRow">
            <button :style="S.link">Forgot password?</button>
          </div>

          <!-- Sign In Button -->
          <button :style="S.primaryBtn">Sign In</button>

          <!-- Switch to Signup -->
          <div :style="S.switchRow">
            Don't have an account? <button :style="S.link">Sign up</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Signup View
 *
 * Account creation form with email, password, and confirmation.
 */
export const Signup: Story = {
  name: 'Signup View',
  parameters: {
    docs: {
      description: {
        story: 'Signup form with email, password, confirm password, Google OAuth, and link to login.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.modal">
          <button :style="S.closeBtn">&times;</button>

          <!-- Logo -->
          <div :style="S.logo">
            <div :style="S.logoIcon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
          </div>

          <h2 :style="S.title">Create Account</h2>
          <p :style="S.subtitle">Get started with FlowState</p>

          <!-- Google Sign In -->
          <button :style="S.googleBtn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <!-- Divider -->
          <div :style="S.divider">
            <div :style="S.dividerLine"></div>
            <span :style="S.dividerText">or</span>
            <div :style="S.dividerLine"></div>
          </div>

          <!-- Email -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Email <span :style="S.required">*</span></label>
            <input :style="S.input" type="email" placeholder="Enter your email" readonly />
          </div>

          <!-- Password -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Password <span :style="S.required">*</span></label>
            <input :style="S.input" type="password" placeholder="Create a password" readonly />
          </div>

          <!-- Confirm Password -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Confirm Password <span :style="S.required">*</span></label>
            <input :style="S.input" type="password" placeholder="Confirm your password" readonly />
          </div>

          <!-- Create Account Button -->
          <button :style="S.primaryBtn">Create Account</button>

          <!-- Switch to Login -->
          <div :style="S.switchRow">
            Already have an account? <button :style="S.link">Sign in</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Reset Password View
 *
 * Password reset form that sends a reset link via email.
 */
export const ResetPassword: Story = {
  name: 'Reset Password View',
  parameters: {
    docs: {
      description: {
        story: 'Password reset form — enter email to receive a reset link. Links back to login.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.modal">
          <button :style="S.closeBtn">&times;</button>

          <!-- Logo -->
          <div :style="S.logo">
            <div :style="S.logoIcon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>

          <h2 :style="S.title">Reset Password</h2>
          <p :style="S.subtitle">Enter your email to receive a password reset link</p>

          <!-- Email -->
          <div :style="S.fieldGroup">
            <label :style="S.label">Email <span :style="S.required">*</span></label>
            <input :style="S.input" type="email" placeholder="Enter your email" readonly />
          </div>

          <!-- Send Reset Link Button -->
          <button :style="S.primaryBtn">Send Reset Link</button>

          <!-- Back to Login -->
          <div :style="S.switchRow">
            <button :style="S.link">&larr; Back to Login</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Reset Success State
 *
 * Confirmation view shown after a password reset email is sent.
 */
export const ResetSuccess: Story = {
  name: 'Reset Email Sent',
  parameters: {
    docs: {
      description: {
        story: 'Success state after sending a password reset email. Shows confirmation message with check to inbox prompt.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.modal">
          <button :style="S.closeBtn">&times;</button>

          <!-- Success Icon -->
          <div :style="S.logo">
            <div style="width:56px; height:56px; border-radius:var(--radius-full); background:var(--brand-primary-subtle); border:2px solid var(--brand-primary-dim); display:flex; align-items:center; justify-content:center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>

          <h2 :style="S.title">Check Your Email</h2>
          <p :style="S.subtitle">We've sent a password reset link to your email address. Please check your inbox and follow the instructions.</p>

          <div style="padding:var(--space-4); background:var(--glass-glow); border:1px solid var(--brand-primary-subtle); border-radius:var(--radius-md); margin-bottom:var(--space-5);">
            <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin:0; line-height:1.5;">Didn't receive the email? Check your spam folder or try again in a few minutes.</p>
          </div>

          <!-- Back to Login -->
          <button :style="S.primaryBtn">Back to Login</button>
        </div>
      </div>
    `
  })
}
