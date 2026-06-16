'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { LeaderboardRow } from '@pitchpredict/contracts';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const NUM = { fontVariantNumeric: 'tabular-nums' } as const;

export interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /** Highlight (and badge) the row belonging to this user id. */
  currentUserId?: number;
}

/** Full standings table; highlights the current user's row with a "You" badge. */
export function LeaderboardTable({ rows, currentUserId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2.25rem' }} aria-hidden>
          🏆
        </Typography>
        <Typography variant="h6" sx={{ mt: 2 }}>
          No standings yet
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Make some predictions and the table will fill up once results are
          scored.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ textTransform: 'uppercase', fontSize: 11 }}>
              Rank
            </TableCell>
            <TableCell sx={{ textTransform: 'uppercase', fontSize: 11 }}>
              Player
            </TableCell>
            <TableCell
              align="right"
              sx={{ textTransform: 'uppercase', fontSize: 11 }}
            >
              Points
            </TableCell>
            <TableCell
              align="right"
              sx={{
                textTransform: 'uppercase',
                fontSize: 11,
                display: { xs: 'none', sm: 'table-cell' },
              }}
            >
              Preds
            </TableCell>
            <TableCell
              align="right"
              sx={{
                textTransform: 'uppercase',
                fontSize: 11,
                display: { xs: 'none', md: 'table-cell' },
              }}
            >
              Exact
            </TableCell>
            <TableCell
              align="right"
              sx={{
                textTransform: 'uppercase',
                fontSize: 11,
                display: { xs: 'none', md: 'table-cell' },
              }}
            >
              Diff
            </TableCell>
            <TableCell
              align="right"
              sx={{
                textTransform: 'uppercase',
                fontSize: 11,
                display: { xs: 'none', md: 'table-cell' },
              }}
            >
              Tendency
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const mine = currentUserId != null && row.user.id === currentUserId;
            const medal = MEDALS[row.rank];
            return (
              <TableRow
                key={row.user.id}
                sx={
                  mine
                    ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }
                    : undefined
                }
              >
                <TableCell>
                  {medal ? (
                    <Box
                      component="span"
                      sx={{ fontSize: '1.25rem', lineHeight: 1 }}
                      title={`Rank ${row.rank}`}
                    >
                      {medal}
                    </Box>
                  ) : (
                    <Typography
                      component="span"
                      sx={{ fontWeight: 600, color: 'text.secondary', ...NUM }}
                    >
                      #{row.rank}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.875rem',
                        bgcolor: mine ? 'primary.main' : 'grey.300',
                        color: mine ? 'primary.contrastText' : 'text.primary',
                      }}
                      aria-hidden
                    >
                      {row.user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {row.user.name}
                    </Typography>
                    {mine && (
                      <Chip size="small" color="success" label="You" />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    component="span"
                    sx={{ fontWeight: 800, color: 'secondary.dark', ...NUM }}
                  >
                    {row.totalPoints}
                  </Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ color: 'text.disabled', ml: 0.5 }}
                  >
                    pts
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: 'none', sm: 'table-cell' },
                    color: 'text.secondary',
                    ...NUM,
                  }}
                >
                  {row.predictionsCount}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: 'none', md: 'table-cell' },
                    fontWeight: 600,
                    color: 'primary.main',
                    ...NUM,
                  }}
                >
                  {row.exactCount}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: 'none', md: 'table-cell' },
                    fontWeight: 600,
                    ...NUM,
                  }}
                >
                  {row.diffCount}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: 'none', md: 'table-cell' },
                    color: 'text.secondary',
                    ...NUM,
                  }}
                >
                  {row.tendencyCount}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
