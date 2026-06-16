'use client';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSession } from 'next-auth/react';
import { useLeaderboard } from '../../../src/api/hooks/useLeaderboard';
import { LeaderboardTable } from '../../../src/components/LeaderboardTable';
import { Podium } from '../../../src/components/Podium';

/**
 * Live standings screen. `useLeaderboard` polls every 15s; renders the top-3
 * `Podium` above the full `LeaderboardTable`, highlighting the signed-in user.
 */
export default function LeaderboardPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ? Number(session.user.id) : undefined;
  const { data: rows, isPending, isError, error } = useLeaderboard();

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
          aria-hidden
        >
          <EmojiEventsIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Leaderboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Live standings · updates automatically
          </Typography>
        </Box>
      </Box>

      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error
            ? error.message
            : 'Could not load the leaderboard.'}
        </Alert>
      ) : (
        <>
          <Podium rows={rows} currentUserId={currentUserId} />
          <Divider />
          <LeaderboardTable rows={rows} currentUserId={currentUserId} />
        </>
      )}
    </Stack>
  );
}
