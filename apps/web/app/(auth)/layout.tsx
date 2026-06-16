import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/**
 * Shell for the public `(auth)` route group (login / signup / forgot / reset).
 * Centers a branded card on the off-white background; no app header or bottom
 * nav, since these screens are reached while unauthenticated.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 6,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack spacing={0.5} alignItems="center">
              <Typography variant="h5" component="h1" fontWeight={700}>
                PitchPredict
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Predict every match. Climb the leaderboard.
              </Typography>
            </Stack>
            {children}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
