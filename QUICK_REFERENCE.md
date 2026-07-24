# SafeMeds Platform - Quick Reference Guide

## Features at a Glance

### 🎨 Dark/Light Mode
**How it works**: Browser automatically detects system preference, or user can toggle manually
- **Toggle Button**: Top-right of every page (sun/moon icon)
- **Keyboard**: Manual toggle via UI button
- **Persistence**: Saved to localStorage

**For Developers**:
```typescript
import { useTheme } from 'next-themes'

function MyComponent() {
  const { theme, setTheme } = useTheme()
  // theme = 'light' | 'dark' | 'system'
}
```

**CSS Variables** (use in Tailwind):
```css
--bg, --surface, --primary, --accent-gold, --ok, --warn, --bad, --info
(plus -hover, -fg, -bg variants)
```

---

### ⌘K Command Palette
**Access**: Press `Ctrl+K` or `Cmd+K` anywhere in the app

**Pre-configured Commands**:
- Task Inbox - View your tasks
- Users & Roles - Manage team members
- Country Rules - Regulatory configuration
- Workflow Viewer - Process flows
- Master Data - Products, batches, registrations
- Audit Trail - Compliance records

**For Developers** - Add new commands:
```typescript
// In components/ui/command-palette.tsx, add to commands array:
{
  id: 'new-feature',
  label: 'Feature Name',
  description: 'What it does',
  action: () => router.push('/path'),
  category: 'Category',
}
```

---

### 🏷️ Logo System
**Components**: 
- `<LogoMark size="sm|md|lg" />` - Logo tile alone
- `<LogoLockup />` - Logo + "SafeMeds" wordmark

**Usage**:
```typescript
import { LogoMark, LogoLockup } from '@/components/ui/logo-mark'

<LogoMark size="md" />
<LogoLockup />
```

**Sizes**: sm=32px, md=48px, lg=64px

---

### 📄 Page Headers
**Component**: `PageHeader` from `components/ui/page-header.tsx`

**Usage**:
```typescript
<PageHeader
  title="Users & Roles"
  description="Manage team permissions and access"
  breadcrumb={[
    { label: 'Admin', href: '/admin' },
    { label: 'Users' }
  ]}
  action={{
    label: 'Invite User',
    onClick: () => setShowInviteModal(true)
  }}
/>
```

---

### 📤 File Upload
**Component**: `FileUpload` from `components/ui/file-upload.tsx`

**Features**: Drag-and-drop, click-to-browse, file preview, validation

**Usage**:
```typescript
<FileUpload
  accepted={['.pdf', '.jpg', '.png']}
  maxSize={10 * 1024 * 1024} // 10MB
  onFileSelect={(file) => {
    console.log('File selected:', file.name, file.size)
  }}
/>
```

---

## Semantic Token System

### Available Tokens (Light Mode)
```css
--bg: #F5F9F7;              /* Background */
--surface: #FFFFFF;         /* Cards, panels */
--surface-raised: #FFFFFF;  /* Elevated elements */
--border: #E1EBE8;          /* Borders */
--text: #0A1E24;            /* Primary text */
--text-muted: #5B7079;      /* Secondary text */

--primary: #27B89C;         /* Brand teal */
--primary-hover: #1E9A82;   /* Hover state */
--primary-fg: #FFFFFF;      /* Text on primary */

--sidebar: #0C5446;         /* Sidebar background */
--sidebar-fg: #DFF2ED;      /* Sidebar text */
--sidebar-active: #27B89C;  /* Active nav item */

--accent-gold: #D8A84B;     /* Ceremonial accent */
--accent-gold-hover: #C2913A; /* Hover state */

--ok: #1CA97B;              /* Success color */
--ok-bg: #E4F5EE;           /* Success background */
--warn: #E0A63A;            /* Warning color */
--warn-bg: #FAF1DD;         /* Warning background */
--bad: #DB5A4B;             /* Error color */
--bad-bg: #FBE7E4;          /* Error background */
--info: #3B82C4;            /* Info color */
--info-bg: #E7F0F9;         /* Info background */
```

### Dark Mode
**Same tokens**, adjusted values for dark contrast. Automatic via `next-themes`.

---

## Styling Best Practices

### ✅ DO:
```jsx
// Use semantic tokens
<div className="bg-[var(--bg)] text-[var(--text)]">
  <button className="bg-[var(--primary)] text-[var(--primary-fg)]">
    Action
  </button>
</div>

// Status badges with color pairs
<span className="bg-[var(--ok-bg)] text-[var(--ok)]">Active</span>
```

### ❌ DON'T:
```jsx
// Never hardcode colors
<div className="bg-white text-gray-900">
  <button className="bg-teal-600">Action</button>
</div>

// Never use non-semantic Tailwind classes
<span className="bg-blue-100 text-blue-600">Message</span>
```

---

## Theme Provider Setup

Already done in `/app/layout.tsx`:
```typescript
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

No additional setup needed for new pages/components.

---

## Component Checklist for Phase 2

### Before Merging PRs:
- [ ] All colors use `var(--token-name)`
- [ ] Tested in light mode
- [ ] Tested in dark mode
- [ ] No hardcoded hex values
- [ ] WCAG AA contrast verified
- [ ] Responsive (mobile/tablet/desktop)
- [ ] PageHeader used for screen titles
- [ ] Loading/empty/error states implemented

---

## Common Tasks

### Add Dark Mode Support to Existing Component
1. Find all color references (bg-, text-, border-, etc.)
2. Replace with semantic tokens: `className="bg-[var(--surface)]"`
3. Test in both light and dark modes

### Extend Command Palette
1. Open `components/ui/command-palette.tsx`
2. Add to `commands` array
3. Rebuild and test with Ctrl+K

### Update Logo on New Page
1. Import: `import { LogoMark } from '@/components/ui/logo-mark'`
2. Use: `<LogoMark size="md" />`
3. Or for full lockup: `<LogoLockup />`

---

## File Structure

```
SafeMeds/
├── app/
│   ├── globals.css          ← Semantic token definitions
│   ├── layout.tsx           ← ThemeProvider + CommandPalette
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── components/
│   ├── ui/
│   │   ├── logo-mark.tsx              ← New: Unified logo
│   │   ├── theme-toggle.tsx           ← New: Theme switcher
│   │   ├── command-palette.tsx        ← New: ⌘K navigation
│   │   ├── page-header.tsx            ← New: Screen headers
│   │   ├── file-upload.tsx            ← New: Document upload
│   │   └── [other UI components]
│   ├── layout/
│   │   ├── top-bar.tsx      ← Updated: LogoMark + ThemeToggle
│   │   ├── sidebar.tsx
│   │   └── context-strip.tsx
│   └── screens/
├── lib/
│   ├── types.ts
│   ├── store/
│   └── mock/
└── public/
```

---

## Deployment Notes

- ✅ Build: `pnpm build` (zero errors expected)
- ✅ Dev: `pnpm dev` (HMR works with theme switching)
- ✅ Export: Ready for production deployment
- ⚠️ Theme: First toggle may require refresh (next-themes initialization)

---

## Troubleshooting

### Theme not switching?
- Check that `ThemeProvider` wraps layout
- Verify browser console for errors
- Try refreshing page after first toggle

### Command palette not opening?
- Check keyboard: Ctrl+K (Windows/Linux) or Cmd+K (Mac)
- Verify CommandPalette component in layout
- Check browser console for JS errors

### Colors look wrong?
- Check for hardcoded Tailwind classes
- Verify semantic token is defined in globals.css
- Test in both light and dark modes

---

## Resources

- **Semantic Tokens**: `app/globals.css` (lines 1-174)
- **Theme Setup**: `app/layout.tsx` (lines 1-50)
- **Logo Component**: `components/ui/logo-mark.tsx`
- **Command Palette**: `components/ui/command-palette.tsx`
- **Full Documentation**: `FINAL_CONSOLIDATION.md` or `PHASE1_COMPLETION_REPORT.md`

---

**Last Updated**: 2026-07-23  
**Status**: Phase 1 Complete - Phase 2 Ready
