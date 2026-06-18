'use client';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { Dashboard } from '@pitchpredict/contracts';
import Link from 'next/link';
import { useChampionPickMutation } from '../../src/api/hooks/useChampionPick';
import { useDashboard } from '../../src/api/hooks/useDashboard';

const CHAMPION_BONUS = 10;
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const NUM = { fontVariantNumeric: 'tabular-nums' } as const;

const SCORING_TILES = [
  { points: '+4', label: 'Exact score', color: 'primary.dark' },
  { points: '+3', label: 'Goal difference', color: 'primary.main' },
  { points: '+2', label: 'Correct result', color: 'secondary.dark' },
  { points: '+0', label: 'Wrong result', color: 'text.disabled' },
] as const;

export default function DashboardPage() {
  const { data, isPending, isError, error, refetch } = useDashboard();

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Could not load your dashboard.{' '}
        {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  return <DashboardView data={data} />;
}

function DashboardView({ data }: { data: Dashboard }) {
  const {
    myRow,
    fixturesCount,
    predictedCount,
    totalPoints,
    championPick,
    championLocked,
    teams,
    topRows,
  } = data;

  const currentUserId = myRow?.user.id;
  const rankLabel = myRow ? `#${myRow.rank}` : '—';

  return (
    <Stack spacing={3}>
      <StatRow
        predictedCount={predictedCount}
        fixturesCount={fixturesCount}
        totalPoints={totalPoints}
        rankLabel={rankLabel}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <ChampionPickCard
          championPick={championPick}
          championLocked={championLocked}
          teams={teams}
        />
        <TopPlayersCard rows={topRows} currentUserId={currentUserId} />
      </Box>

      <HowItWorksCard />
    </Stack>
  );
}

function StatRow({
  predictedCount,
  fixturesCount,
  totalPoints,
  rankLabel,
}: {
  predictedCount: number;
  fixturesCount: number;
  totalPoints: number;
  rankLabel: string;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
      }}
    >
      <StatCard
        label="Predicted"
        value={`${predictedCount}/${fixturesCount}`}
        sub="matches"
      />
      <StatCard
        label="Points"
        value={String(totalPoints)}
        sub="total"
        valueColor="secondary.dark"
      />
      <StatCard label="Rank" value={rankLabel} sub="global" />
    </Box>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent>
        <Typography
          variant="caption"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, mt: 0.5, color: valueColor, ...NUM }}
        >
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ChampionPickCard({
  championPick,
  championLocked,
  teams,
}: Pick<Dashboard, 'championPick' | 'championLocked' | 'teams'>) {
  const mutation = useChampionPickMutation();

  const handleChange = (event: SelectChangeEvent) => {
    const teamId = Number(event.target.value);
    if (!Number.isNaN(teamId)) {
      mutation.mutate({ teamId });
    }
  };

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Champion Pick
          </Typography>
          <Chip
            size="small"
            color="warning"
            label={`+${CHAMPION_BONUS} pts`}
            sx={{ fontWeight: 700 }}
          />
        </Box>

        {championPick && (
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderRadius: 2,
              border: (t) => `1px solid ${alpha(t.palette.secondary.main, 0.4)}`,
              bgcolor: (t) => alpha(t.palette.secondary.main, 0.12),
              px: 2,
              py: 1.5,
            }}
          >
            <Typography sx={{ fontSize: '1.75rem' }} aria-hidden>
              {championPick.team.flagEmoji}
            </Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {championPick.team.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Your champion pick
              </Typography>
            </Box>
            <EmojiEventsIcon sx={{ color: 'secondary.dark' }} />
          </Box>
        )}

        {championLocked ? (
          <Box sx={{ mt: 2 }}>
            <Chip size="small" label="🔒 Picks locked — tournament underway" />
            {!championPick && (
              <Typography
                variant="body2"
                sx={{ mt: 2, color: 'text.secondary' }}
              >
                No champion pick was locked in before kickoff — no bonus on the
                line, but your match predictions still count for everything
                else.
              </Typography>
            )}
          </Box>
        ) : (
          <FormControl fullWidth size="small" sx={{ mt: 3 }}>
            <InputLabel id="champion-pick-label">Change pick</InputLabel>
            <Select
              labelId="champion-pick-label"
              label="Change pick"
              value={championPick ? String(championPick.teamId) : ''}
              onChange={handleChange}
              disabled={mutation.isPending}
            >
              {teams.map((team) => (
                <MenuItem key={team.id} value={String(team.id)}>
                  <span aria-hidden>{team.flagEmoji}</span>
                  <Box component="span" sx={{ ml: 1 }}>
                    {team.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            <Typography
              variant="caption"
              sx={{ mt: 1, display: 'block', color: 'text.secondary' }}
            >
              Champion picks close Sat Jun 20, 6:00 PM ET
            </Typography>
          </FormControl>
        )}

        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Could not update your champion pick.'}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function TopPlayersCard({
  rows,
  currentUserId,
}: {
  rows: Dashboard['topRows'];
  currentUserId?: number;
}) {
  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Top Players
          </Typography>
          <Button
            component={Link}
            href="/leaderboard"
            size="small"
            sx={{ fontWeight: 600 }}
          >
            Full table →
          </Button>
        </Box>

        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            No players yet — be the first on the board!
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {rows.map((row) => {
              const mine =
                currentUserId != null && row.user.id === currentUserId;
              const medal = MEDALS[row.rank];
              return (
                <Box
                  key={row.user.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    borderRadius: 1.5,
                    px: 1,
                    py: 0.75,
                    bgcolor: mine
                      ? (t) => alpha(t.palette.primary.main, 0.08)
                      : undefined,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 28,
                      fontWeight: 700,
                      fontSize: medal ? '1.25rem' : '0.95rem',
                      color: 'text.secondary',
                      ...NUM,
                    }}
                  >
                    {medal ?? `#${row.rank}`}
                  </Box>
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
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}
                    noWrap
                  >
                    {row.user.name}
                    {mine ? ' (you)' : ''}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 800, color: 'secondary.dark', ...NUM }}
                  >
                    {row.totalPoints}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function HowItWorksCard() {
  return (
    <Card>
      <CardContent>
        <Typography
          variant="caption"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          How it works
        </Typography>

        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          }}
        >
          {SCORING_TILES.map((tile) => (
            <Box
              key={tile.label}
              sx={{
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'background.default',
                py: 2,
              }}
            >
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, color: tile.color, ...NUM }}
              >
                {tile.points}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {tile.label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Alert
          icon={<EmojiEventsIcon fontSize="inherit" />}
          severity="warning"
          sx={{ mt: 2 }}
        >
          <strong>+{CHAMPION_BONUS} pts</strong> for correct champion pick ·
          Predictions lock at kickoff
        </Alert>
      </CardContent>
    </Card>
  );
}
