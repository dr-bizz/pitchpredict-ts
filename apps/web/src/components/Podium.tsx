'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { LeaderboardRow } from '@pitchpredict/contracts';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
/** Podium slot heights: center (1st) tallest, then left (2nd), then right (3rd). */
const HEIGHTS: Record<number, number> = { 1: 140, 2: 110, 3: 88 };

export interface PodiumProps {
  /** Full ranked rows; only ranks 1–3 are rendered. */
  rows: LeaderboardRow[];
  currentUserId?: number;
}

/** Top-3 podium with medals, taller center step for first place. */
export function Podium({ rows, currentUserId }: PodiumProps) {
  // Take the top three rows by display order — NOT keyed by rank, because ranks
  // tie (a tie at #1 means there may be no rank-2 row, and two rows share rank 1).
  // Visual columns: 2nd on the left, 1st in the (tallest) center, 3rd on the right.
  // The medal reflects each row's real rank (tied leaders both show 🥇); the step
  // height reflects the podium slot.
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;
  const columns = [
    { row: top[1], slot: 2 },
    { row: top[0], slot: 1 },
    { row: top[2], slot: 3 },
  ].filter((c): c is { row: LeaderboardRow; slot: number } => Boolean(c.row));

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
      {columns.map(({ row, slot }) => {
        const mine = currentUserId != null && row.user.id === currentUserId;
        return (
          <Box
            key={row.user.id}
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
              {MEDALS[row.rank] ?? MEDALS[slot]}
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
                height: HEIGHTS[slot],
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
