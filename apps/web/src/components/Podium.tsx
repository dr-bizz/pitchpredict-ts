'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { LeaderboardRow } from '@pitchpredict/contracts';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
/** Visual order: 2nd, 1st, 3rd (1st in the middle and tallest). */
const DISPLAY_ORDER = [2, 1, 3];
const HEIGHTS: Record<number, number> = { 1: 140, 2: 110, 3: 88 };

export interface PodiumProps {
  /** Full ranked rows; only ranks 1–3 are rendered. */
  rows: LeaderboardRow[];
  currentUserId?: number;
}

/** Top-3 podium with medals, taller center step for first place. */
export function Podium({ rows, currentUserId }: PodiumProps) {
  const byRank = new Map(rows.map((r) => [r.rank, r]));
  const present = DISPLAY_ORDER.map((rank) => byRank.get(rank)).filter(
    (r): r is LeaderboardRow => !!r
  );

  if (present.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: { xs: 1, sm: 2 },
        py: 2,
      }}
    >
      {DISPLAY_ORDER.map((rank) => {
        const row = byRank.get(rank);
        if (!row) return null;
        const mine = currentUserId != null && row.user.id === currentUserId;
        return (
          <Box
            key={rank}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              flex: 1,
              maxWidth: 140,
            }}
          >
            <Box sx={{ fontSize: '1.75rem', lineHeight: 1 }} aria-hidden>
              {MEDALS[rank]}
            </Box>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                fontWeight: 700,
                bgcolor: mine ? 'primary.main' : 'secondary.main',
                color: mine ? 'primary.contrastText' : 'secondary.contrastText',
              }}
              aria-hidden
            >
              {row.user.name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                textAlign: 'center',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.user.name}
              {mine ? ' (You)' : ''}
            </Typography>
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                height: HEIGHTS[rank],
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                pt: 1.5,
                borderRadius: '12px 12px 0 0',
                bgcolor: (t) =>
                  mine
                    ? alpha(t.palette.primary.main, 0.18)
                    : alpha(t.palette.primary.main, 0.08),
              }}
            >
              <Typography
                sx={{
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'secondary.dark',
                }}
              >
                {row.totalPoints}
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: 'text.disabled', ml: 0.5 }}
                >
                  pts
                </Typography>
              </Typography>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
