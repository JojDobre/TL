// frontend/src/theme.js
//
// Tenká MUI téma postavená nad CSS premennými z tokens.css.
// Filozofia: zdrojom pravdy o farbách/spacingu sú CSS premenné (--brand, --bg...).
// MUI téma z nich len číta, aby natívne MUI komponenty (Button, TextField,
// Dialog, Card...) vyzerali rovnako ako komponenty zo šablóny.
//
// Vďaka tomu sa dá tokens.css preniesť 1:1 a netreba duplikovať hodnoty v JS.

import { createTheme } from '@mui/material/styles';

// Pomocník: prečíta hodnotu CSS premennej za behu (z :root).
// Funguje v prehliadači; pri SSR/teste vráti fallback.
const cssVar = (name, fallback) => {
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) return v;
  }
  return fallback;
};

// Téma sa vytvára ako funkcia, aby sa dala neskôr prepnúť dark/light.
// Hodnoty držíme zhodné s tokens.css (fallbacky pre istotu, keby CSS ešte nebol načítaný).
const buildTheme = (mode = 'dark') =>
  createTheme({
    palette: {
      mode, // 'dark' alebo 'light' — MUI podľa toho ladí svoje defaulty
      primary: {
        main: cssVar('--brand', '#7c5cff'),       // violet — hlavná značka
        light: cssVar('--brand-bright', '#9d83ff'),
        dark: cssVar('--brand-dim', '#5b3fd6'),
        contrastText: '#ffffff',
      },
      secondary: {
        main: cssVar('--gold', '#facc15'),         // gold — CTA / akcie
        dark: cssVar('--gold-dim', '#d4a90a'),
        contrastText: cssVar('--gold-ink', '#1c1605'),
      },
      success: { main: cssVar('--success', '#1fd497') },
      warning: { main: cssVar('--warning', '#f5a524') },
      error: { main: cssVar('--danger', '#f0476a') },
      info: { main: cssVar('--info', '#3da5f4') },
      background: {
        default: cssVar('--bg', '#090c16'),
        paper: cssVar('--surface-1', '#111728'),
      },
      text: {
        primary: cssVar('--text-1', '#eef1f9'),
        secondary: cssVar('--text-2', '#b8c0d6'),
        disabled: cssVar('--text-4', '#59617c'),
      },
      divider: cssVar('--line', 'rgba(150, 165, 215, 0.12)'),
    },

    // Typografia podľa tokens.css: Space Grotesk (nadpisy) + Manrope (text)
    typography: {
      fontFamily: "'Manrope', system-ui, sans-serif",
      h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
      h5: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
      h6: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 }, // bez VEĽKÝCH písmen
    },

    shape: {
      borderRadius: 14, // zodpovedá --r-md
    },

    // Drobné úpravy natívnych MUI komponentov, aby sadli do dark-first dizajnu
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 'var(--r-pill, 999px)', paddingInline: '18px' },
          containedSecondary: { color: 'var(--gold-ink, #1c1605)' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'var(--surface-1, #111728)',
            border: '1px solid var(--line, rgba(150,165,215,0.12))',
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { backgroundColor: 'var(--surface-3, #232d47)', borderRadius: 'var(--r-sm, 10px)' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundColor: 'var(--surface-2, #192135)', borderRadius: 'var(--r-lg, 18px)' },
        },
      },
      MuiCssBaseline: {
        // Necháme tokens.css riadiť body/pozadie; MUI len doplní svoje baseline.
        styleOverrides: {},
      },
    },
  });

export default buildTheme;
