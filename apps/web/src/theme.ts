'use client';

import { createTheme } from '@mui/material/styles';

/**
 * PitchPredict brand theme. Pitch-emerald primary, gold accent, off-white
 * surfaces, charcoal text. Rounded cards with a soft shadow and non-uppercase
 * buttons, matching the design spec.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0A7B4B',
      dark: '#075C38',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E8B53D',
      contrastText: '#111418',
    },
    background: {
      default: '#F7F8F6',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111418',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily:
      'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow:
            '0 1px 2px rgb(17 20 24 / 0.04), 0 6px 24px -8px rgb(17 20 24 / 0.12)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
