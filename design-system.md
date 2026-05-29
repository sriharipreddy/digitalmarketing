# 🎨 Design System
## MUI Theme · States · Accessibility · i18n · Responsive Design

> A consistent design language across all 20 modules. Every component obeys the same rules.

---

## 📋 Table of Contents

1. [Design Principles](#design-principles)
2. [MUI Theme Tokens](#mui-theme-tokens)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component States](#component-states)
6. [Empty States](#empty-states)
7. [Loading States](#loading-states)
8. [Error States](#error-states)
9. [Accessibility (WCAG 2.1 AA)](#accessibility)
10. [Internationalisation](#internationalisation)
11. [Responsive Design](#responsive-design)
12. [Component Catalogue](#component-catalogue)
13. [Storybook & Documentation](#storybook--documentation)

---

## Design Principles

1. **Clarity over cleverness** — marketers need to ship campaigns fast, not learn the UI
2. **Density when needed, breathing room when not** — data tables can be dense; dashboards must breathe
3. **Predictable patterns** — same action in two places looks the same
4. **Mobile-first for client-facing UI** — agency clients check analytics on phones
5. **Performance is a feature** — Time to Interactive < 3s, no jank scrolling 50k-row tables
6. **Accessibility is non-negotiable** — WCAG 2.1 AA across all pages

---

## MUI Theme Tokens

Single source of truth: `apps/web/lib/theme.ts`

```typescript
import { createTheme, alpha } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8', contrastText: '#FFFFFF' },
    secondary: { main: '#7C3AED', light: '#A78BFA', dark: '#5B21B6', contrastText: '#FFFFFF' },
    success:   { main: '#16A34A', light: '#4ADE80', dark: '#15803D', contrastText: '#FFFFFF' },
    error:     { main: '#DC2626', light: '#F87171', dark: '#991B1B', contrastText: '#FFFFFF' },
    warning:   { main: '#D97706', light: '#FBBF24', dark: '#92400E', contrastText: '#FFFFFF' },
    info:      { main: '#0EA5E9', light: '#7DD3FC', dark: '#075985', contrastText: '#FFFFFF' },
    grey: {
      50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB',
      400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151',
      800: '#1F2937', 900: '#111827',
    },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    text:       { primary: '#111827', secondary: '#6B7280', disabled: '#9CA3AF' },
    divider:    '#E5E7EB',
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem',    fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem',  fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: '1.125rem',fontWeight: 600, lineHeight: 1.5 },
    h5: { fontSize: '1rem',    fontWeight: 600 },
    h6: { fontSize: '0.875rem',fontWeight: 600 },
    body1:   { fontSize: '1rem',     lineHeight: 1.6 },
    body2:   { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem',  lineHeight: 1.4, color: '#6B7280' },
    button:  { textTransform: 'none', fontWeight: 600 },
  },

  shape: { borderRadius: 10 },

  spacing: 8,  // 1 unit = 8px

  shadows: [
    'none',
    '0 1px 2px 0 rgba(0,0,0,0.05)',
    '0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px 0 rgba(0,0,0,0.06)',
    '0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)',
    '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -2px rgba(0,0,0,0.05)',
    '0 20px 25px -5px rgba(0,0,0,0.10), 0 10px 10px -5px rgba(0,0,0,0.04)',
    '0 25px 50px -12px rgba(0,0,0,0.25)',
    // ... remaining shadows
  ],

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        sizeLarge: { padding: '10px 24px', fontSize: '1rem' },
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderRadius: 12 }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' }
    },
    MuiDataGrid: {
      defaultProps: { density: 'compact', disableRowSelectionOnClick: true }
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } }
    },
    MuiTooltip: {
      defaultProps: { arrow: true }
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 16 } }
    },
  },
});

export const darkTheme = createTheme({
  ...lightTheme,
  palette: {
    mode: 'dark',
    primary:    { main: '#60A5FA', light: '#93C5FD', dark: '#3B82F6', contrastText: '#0F172A' },
    background: { default: '#0F172A', paper: '#1E293B' },
    text:       { primary: '#F1F5F9', secondary: '#94A3B8', disabled: '#64748B' },
    divider:    '#334155',
  }
});
```

### White-Label Theming

Agency owners override these tokens per their workspace:
```typescript
function getThemeForWorkspace(workspace) {
  if (workspace.agency_branding?.brand_colour) {
    return createTheme({
      ...lightTheme,
      palette: {
        ...lightTheme.palette,
        primary: { main: workspace.agency_branding.brand_colour }
      }
    });
  }
  return lightTheme;
}
```

---

## Typography

### Type Scale

| Token | Size | Weight | Use |
|---|---|---|---|
| h1 | 2rem (32px) | 700 | Page titles only — one per page |
| h2 | 1.5rem (24px) | 600 | Section headers within a page |
| h3 | 1.25rem (20px) | 600 | Card titles, module headers |
| h4 | 1.125rem (18px) | 600 | Sub-section titles |
| h5 | 1rem (16px) | 600 | Form section labels |
| h6 | 0.875rem (14px) | 600 | Compact labels (table headers) |
| body1 | 1rem (16px) | 400 | Primary body text |
| body2 | 0.875rem (14px) | 400 | Secondary body text, dense lists |
| caption | 0.75rem (12px) | 400 | Helper text, metadata |

### Font Loading

Inter loaded via self-hosted `.woff2` files in `public/fonts/`, preloaded via `<link rel="preload" as="font" crossorigin>` in `index.html` (Option C — no FOUT, no external requests).

```typescript
// apps/web/app/layout.tsx
// In Option C (React + Vite): import font CSS or preload in index.html
// Example index.html: <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
```

---

## Spacing & Layout

### Spacing Scale (multiples of 8px)

| Token | Pixels | Use |
|---|---|---|
| 0.5 | 4px | Tight inline spacing |
| 1 | 8px | Compact gaps |
| 2 | 16px | Default gap |
| 3 | 24px | Comfortable gap |
| 4 | 32px | Section separators |
| 6 | 48px | Major section separators |
| 8 | 64px | Page-level spacing |

Always use `theme.spacing(N)` or shorthand: `sx={{ p: 2, mt: 3 }}` (= 16px padding, 24px margin-top).

### Grid Breakpoints

```typescript
breakpoints: {
  values: {
    xs: 0,      // phones (< 600px)
    sm: 600,    // small tablets
    md: 900,    // tablets
    lg: 1200,   // desktops
    xl: 1536,   // large desktops
  }
}
```

### Page Layout Pattern

```tsx
<DashboardLayout>
  <Container maxWidth="xl" sx={{ py: 3 }}>
    <PageHeader title="Keyword Rankings" actions={<Button>Add Keyword</Button>} />
    <Stack spacing={3}>
      <StatsRow stats={...} />
      <Paper sx={{ p: 3 }}>
        <DataGrid rows={...} columns={...} />
      </Paper>
    </Stack>
  </Container>
</DashboardLayout>
```

---

## Component States

Every interactive component supports five states. MUI provides these by default; consistent usage is the discipline.

### The Five States

| State | Visual | Trigger |
|---|---|---|
| **Default** | Resting appearance | Component idle |
| **Hover** | Slight elevation / colour shift | Mouse over (desktop) |
| **Focus** | Visible focus ring (2px primary colour outline) | Keyboard focus or click |
| **Active** | Slightly pressed appearance | Mouse down / touch |
| **Disabled** | 40% opacity, no cursor change | Action unavailable |

### Critical Rule: Focus Indicators

**Never** remove the focus ring. It is a WCAG 2.1 requirement (1.4.11 Non-text Contrast, 2.4.7 Focus Visible).

```typescript
// Theme override to ensure focus rings everywhere
MuiButton: {
  styleOverrides: {
    root: {
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px',
      }
    }
  }
}
```

---

## Empty States

When a list has no items, never show a blank page.

### Empty State Anatomy

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              [Illustration or Icon]                  │
│                                                      │
│              You haven't tracked                     │
│              any keywords yet                        │
│                                                      │
│   Add keywords to monitor their Google rankings,     │
│   spot new opportunities, and beat competitors.      │
│                                                      │
│              [+ Add Your First Keyword]              │
│                                                      │
│              Or [import from CSV]                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Component

```tsx
// components/EmptyState.tsx
interface Props {
  icon?: React.ReactNode;
  illustration?: string;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, primaryAction, secondaryAction }: Props) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
      {icon && <Box sx={{ mb: 2, color: 'text.disabled' }}>{icon}</Box>}
      <Typography variant="h5" gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        {description}
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        {primaryAction && (
          <Button variant="contained" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="text" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
```

### Empty State Catalogue (per module)

Every module ships with its own empty state copy and illustrations:

| Module | Title | Description | Primary Action |
|---|---|---|---|
| SEO Keywords | "No keywords tracked yet" | "Add keywords to monitor your Google rankings" | "Add Keyword" |
| Campaigns | "Ready to launch your first campaign?" | "Use One-Click Capture for an instant multi-channel plan" | "One-Click Capture" |
| Email Lists | "Start building your audience" | "Import existing subscribers or create a sign-up form" | "Create List" |
| CRM Contacts | "Your CRM is empty" | "Add your first contact or connect a form to capture leads" | "Add Contact" |
| Social Posts | "Schedule your first post" | "Connect a social account and create a post in seconds" | "Connect Account" |
| Reports | "No reports generated yet" | "Build a custom report or use a template" | "Create Report" |

---

## Loading States

### Three Levels of Loading

| Level | Use | Component |
|---|---|---|
| **Skeleton** | Initial page load, predictable structure | `<Skeleton />` matching the final layout |
| **Spinner** | Action in progress within an existing UI | `<CircularProgress />` or button loading state |
| **Progress bar** | Long async operations with known progress | `<LinearProgress variant="determinate" />` |

### Skeleton Loading Pattern

```tsx
// Loading state mirrors the final layout structurally
{isLoading ? (
  <Stack spacing={2}>
    <Skeleton variant="rounded" height={60} />
    <Skeleton variant="rounded" height={400} />
  </Stack>
) : (
  <Stack spacing={2}>
    <StatsRow stats={data.stats} />
    <DataGrid rows={data.rows} columns={data.cols} />
  </Stack>
)}
```

### Loading Spinner Standards

- Buttons: replace label with `<CircularProgress size={20} color="inherit" />` while busy
- Inline forms: spinner appears within the field or at the form level
- Modal: full-overlay spinner during submission

### Long Operations (> 5 seconds)

- One-Click Capture: streaming SSE with step-by-step progress (no spinner, live updates)
- Bulk imports: progress bar with row count + ETA
- Report generation: notification toast → email when complete

### Never Block UI

- Background operations show progress but don't block interaction
- Use `<Snackbar>` for "Saving..." → "Saved" toasts
- Optimistic updates: change UI immediately, rollback on error

---

## Error States

### Three Levels of Error

| Level | Use | Component |
|---|---|---|
| **Inline** | Form field validation | TextField `error` prop + `helperText` |
| **Banner** | Page-level issue | `<Alert severity="error">` at top |
| **Full-page** | Catastrophic failure | Error page with retry CTA |

### Inline Field Errors

```tsx
<TextField
  label="Email"
  type="email"
  error={!!errors.email}
  helperText={errors.email?.message || ''}
  {...register('email', { required: 'Email is required' })}
/>
```

### Banner Errors

```tsx
{error && (
  <Alert
    severity="error"
    onClose={() => setError(null)}
    action={
      <Button color="inherit" size="small" onClick={retry}>RETRY</Button>
    }
  >
    {error.message}
  </Alert>
)}
```

### Error Boundary (catches React crashes)

```tsx
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>Something went wrong</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            We've been notified and are looking into it.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Container>
      );
    }
    return this.props.children;
  }
}
```

### Network Error Handling

```typescript
// RTK Query / axios interceptor
axios.interceptors.response.use(undefined, (error) => {
  if (!error.response) {
    enqueueSnackbar('Network error — check your connection', { variant: 'error' });
  } else if (error.response.status === 401) {
    // Token expired — refresh transparently
    return refreshAndRetry(error.config);
  } else if (error.response.status === 402) {
    showUpgradeDialog(error.response.data.upgrade_url);
  } else if (error.response.status === 429) {
    enqueueSnackbar('Slow down — too many requests', { variant: 'warning' });
  } else if (error.response.status >= 500) {
    enqueueSnackbar('Server error — please try again', { variant: 'error' });
    Sentry.captureException(error);
  }
  return Promise.reject(error);
});
```

### Error Copy Guidelines

- **Specific** — not "Something went wrong" but "Your email address is invalid"
- **Actionable** — tell the user what to do: "Check the format: name@example.com"
- **Blameless** — never "You did X wrong" — passive voice or system-neutral
- **No technical jargon** — never "TypeError: Cannot read property 'foo'"

---

## Accessibility

### WCAG 2.1 AA Conformance

The platform commits to WCAG 2.1 AA. Critical principles:

| Principle | Requirement | How We Achieve |
|---|---|---|
| **Perceivable** | Text contrast ≥ 4.5:1; UI element contrast ≥ 3:1 | MUI default palette meets; custom colours validated with `tinycolor2` in theme tests |
| **Operable** | Keyboard navigation, focus visible, no keyboard traps | All MUI components keyboard-native; custom focus rings enforced |
| **Understandable** | Predictable navigation, labels on form fields | Every TextField has `label`, every IconButton has `aria-label` |
| **Robust** | Valid HTML, ARIA usage correct | Semantic HTML; aria-* only where needed; tested with screen readers |

### Required Practices

**Semantic HTML first, ARIA second**
```tsx
<button onClick={...}>Submit</button>      // Good
<div role="button" onClick={...}>Submit</div>  // Avoid
```

**Labels on every form control**
```tsx
<TextField label="Email" />                // MUI handles label association
<IconButton aria-label="Delete">           // Required for icon-only buttons
  <DeleteIcon />
</IconButton>
```

**Heading hierarchy**
- One `<h1>` per page (the page title)
- Don't skip levels (h2 → h4 is forbidden)
- Headings describe the page structure for screen readers

**Colour is never the only signal**
```tsx
// Bad: red text only signals error
<Typography color="error">Failed</Typography>

// Good: colour + icon + text
<Stack direction="row" alignItems="center" spacing={1}>
  <ErrorIcon color="error" />
  <Typography color="error">Failed</Typography>
</Stack>
```

**Live regions for dynamic updates**
```tsx
<Alert role="alert">  {/* Screen reader announces immediately */}
  Campaign launched successfully
</Alert>
```

**Skip links**
```tsx
<a href="#main-content" className="skip-link">Skip to main content</a>
```

### Automated Testing

```bash
# CI: axe-core via jest-axe
yarn test:a11y

# Lighthouse CI on every PR
yarn build && yarn lighthouse:ci
```

### Manual Testing

- VoiceOver (Mac), NVDA (Windows), TalkBack (Android) tested per major release
- Keyboard-only navigation test for every new feature
- Browser zoom 200% must not break layouts

---

## Internationalisation

The platform supports 12 languages out of the gate (English baseline, expanded by demand).

### Library: `next-intl`

```bash
yarn add next-intl
```

### File Structure

```
apps/web/messages/
├── en.json        ← source of truth
├── es.json
├── fr.json
├── de.json
├── pt.json
├── it.json
├── nl.json
├── pl.json
├── tr.json
├── ja.json
├── zh-CN.json
└── ar.json        ← RTL
```

### Message Format

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading..."
  },
  "seo": {
    "keywords": {
      "title": "Keyword Rankings",
      "empty_title": "No keywords tracked yet",
      "add_first": "Add Your First Keyword",
      "track_count": "{count, plural, =0 {No keywords} one {# keyword} other {# keywords}} tracked"
    }
  }
}
```

### Usage

```tsx
import { useTranslations } from 'next-intl';

function KeywordsPage() {
  const t = useTranslations('seo.keywords');
  return (
    <>
      <Typography variant="h1">{t('title')}</Typography>
      <Typography>{t('track_count', { count: 42 })}</Typography>
    </>
  );
}
```

### Locale Detection

1. URL prefix: `/en/dashboard`, `/es/dashboard`
2. Accept-Language header on first visit
3. User preference saved in `core_users.preferred_locale`
4. Switcher in account menu

### RTL Support (Arabic)

MUI supports RTL natively via theme `direction: 'rtl'`:

```tsx
const cacheRtl = createCache({ key: 'mui-rtl', stylisPlugins: [stylisRTLPlugin] });
<CacheProvider value={cacheRtl}>
  <ThemeProvider theme={createTheme({ direction: 'rtl', ...lightTheme })}>
    ...
  </ThemeProvider>
</CacheProvider>
```

### Number, Date, Currency Formatting

```tsx
import { useFormatter } from 'next-intl';

const format = useFormatter();
format.number(1234.56, { style: 'currency', currency: 'GBP' });   // £1,234.56
format.dateTime(new Date(), { dateStyle: 'medium' });             // 28 May 2026
format.relativeTime(-3, 'day');                                    // 3 days ago
```

### Translation Workflow

- Source: English JSON files (in repo, code-reviewed)
- Translation service: Crowdin or Lokalise (sync via CLI)
- New strings auto-flagged for translation
- Translator UI shows context screenshots
- CI: missing-translation linter blocks PR

---

## Responsive Design

### Mobile-First

All layouts start at `xs` (phone) and progressively enhance.

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4} lg={3}>
    <Card>...</Card>
  </Grid>
</Grid>
```

### Per-Module Mobile Strategy

| Module | Mobile Strategy |
|---|---|
| Dashboard | Stack cards vertically, key metrics first |
| Data tables (Keywords, Contacts) | Convert to card list on mobile (each row = a card); inline-edit disabled |
| Campaign builder | Multi-step wizard becomes single-column flow |
| Email builder | Read-only on mobile (editing requires desktop) — show notice |
| Workflow canvas | Read-only / view list of nodes on mobile |
| One-Click Capture | Fully usable on mobile (most marketers do quick captures on phone) |
| Analytics | Charts resize down; secondary metrics collapse into accordion |

### Tablet Specific (`md` breakpoint)

- Two-column layouts where desktop has three
- Sidebar collapsible
- Touch-friendly tap targets (min 44px)

### Performance on Slow Networks

- Lazy-load below-the-fold content
- Code-splitting per route via `React.lazy()` + `Suspense` (Option C) — manual but predictable
- Vite manual chunks config: split MUI, charts, editor bundles separately (see `vite.config.ts` in `frontend-decision.md`)
- Image optimisation via Cloudflare Polish (Pro plan) + `<img loading="lazy">` everywhere
- Sub-3-second LCP on 3G

---

## Component Catalogue

Every commonly-used pattern lives in `apps/web/components/` and is documented in Storybook.

### Core Components

```
components/
├── ui/                          ← Pure presentation
│   ├── Card.tsx
│   ├── DataTable.tsx            ← Wraps MUI DataGrid with our defaults
│   ├── EmptyState.tsx
│   ├── ErrorBoundary.tsx
│   ├── PageHeader.tsx
│   ├── StatCard.tsx
│   ├── Stepper.tsx
│   └── ConfirmDialog.tsx
├── charts/
│   ├── LineChart.tsx            ← MUI X LineChart wrapper
│   ├── BarChart.tsx
│   ├── FunnelChart.tsx          ← Recharts custom
│   ├── HeatmapGrid.tsx
│   └── KPITrend.tsx
├── forms/
│   ├── EmailField.tsx
│   ├── PasswordField.tsx
│   ├── PhoneField.tsx
│   ├── DateRangePicker.tsx
│   ├── TagsInput.tsx
│   └── FileUpload.tsx
├── layout/
│   ├── DashboardLayout.tsx
│   ├── PublicLayout.tsx
│   ├── Sidebar.tsx
│   └── AppBar.tsx
└── feedback/
    ├── Toast.tsx                ← notistack wrapper
    └── UpgradeDialog.tsx
```

### StatCard Example

```tsx
// components/ui/StatCard.tsx
interface Props {
  label: string;
  value: string | number;
  change?: { value: number; direction: 'up' | 'down'; positive?: boolean };
  icon?: React.ReactNode;
  loading?: boolean;
}

export function StatCard({ label, value, change, icon, loading }: Props) {
  if (loading) return <Skeleton variant="rounded" height={120} />;

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        {icon && <Box sx={{ color: 'primary.main' }}>{icon}</Box>}
        <Box>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h4">{value}</Typography>
          {change && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {change.direction === 'up' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
              <Typography variant="caption" color={change.positive ? 'success.main' : 'error.main'}>
                {Math.abs(change.value)}%
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Card>
  );
}
```

---

## Storybook & Documentation

### Setup

```bash
yarn dlx storybook@latest init
```

Every component has a `.stories.tsx` file:

```tsx
// components/ui/StatCard.stories.tsx
export default { title: 'UI/StatCard', component: StatCard };

export const Default = { args: { label: 'Visitors', value: '12,450' } };
export const WithChange = { args: { label: 'Revenue', value: '£8,420', change: { value: 24, direction: 'up', positive: true } } };
export const Loading = { args: { label: 'Visitors', value: '0', loading: true } };
```

Hosted at `storybook.yourplatform.com` for the design + engineering teams.

### Design Tokens Documentation

Storybook plugin: `@storybook/addon-designs` links each component story to its Figma design — no drift between design and implementation.

### Visual Regression Testing

Chromatic (Storybook's first-party VRT) catches unintended UI changes:
- Every PR generates a Chromatic build
- Visual diff against baseline
- Designer approval required for accepted changes
