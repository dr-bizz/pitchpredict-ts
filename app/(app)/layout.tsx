import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { ReactNode } from 'react';
import { AppHeader } from '../../src/components/AppHeader';
import { BottomNav } from '../../src/components/BottomNav';

/**
 * Shell for the authenticated `(app)` route group: sticky header on top, fixed
 * bottom navigation, and the page content in a centered container with bottom
 * padding so it clears the BottomNav.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader />
      <Container
        maxWidth="lg"
        component="main"
        sx={{ px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 }, pb: { xs: 11, sm: 12 } }}
      >
        {children}
      </Container>
      <BottomNav />
    </Box>
  );
}
