'use client';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  STAGE_TABS,
  fixtureResultInputSchema,
  zStatus,
  type FixtureWithTeams,
  type Stage,
  type Status,
} from '@pitchpredict/contracts';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import {
  useAdminFixtures,
  useAdminScoreFixture,
} from '../../../src/api/hooks/useAdminFixtures';
import { ScoreStepper } from '../../../src/components/ScoreStepper';

const STAGE_OPTIONS = STAGE_TABS.filter(
  (t): t is Stage => t !== 'upcoming'
);
const STATUS_OPTIONS = zStatus.options;

const STAGE_LABELS: Record<Stage, string> = {
  group: 'Group',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  third_place: 'Third place',
  final: 'Final',
};

const STATUS_LABELS: Record<Status, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  finished: 'Finished',
};

const STATUS_COLOR: Record<Status, 'default' | 'warning' | 'success'> = {
  scheduled: 'default',
  live: 'warning',
  finished: 'success',
};

function FilterRow<T extends string>({
  label,
  options,
  optionLabel,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  optionLabel: (v: T) => string;
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="caption"
        sx={{
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'text.secondary',
          mr: 0.5,
        }}
      >
        {label}
      </Typography>
      <Chip
        label="All"
        size="small"
        color={value === undefined ? 'primary' : 'default'}
        variant={value === undefined ? 'filled' : 'outlined'}
        onClick={() => onChange(undefined)}
      />
      {options.map((opt) => (
        <Chip
          key={opt}
          label={optionLabel(opt)}
          size="small"
          color={value === opt ? 'primary' : 'default'}
          variant={value === opt ? 'filled' : 'outlined'}
          onClick={() => onChange(opt)}
        />
      ))}
    </Box>
  );
}

interface FeedbackHandlers {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function FixtureResultRow({
  fixture,
  feedback,
}: {
  fixture: FixtureWithTeams;
  feedback: FeedbackHandlers;
}) {
  const finished = fixture.status === 'finished';
  const [home, setHome] = useState<number>(fixture.homeScore ?? 0);
  const [away, setAway] = useState<number>(fixture.awayScore ?? 0);
  const score = useAdminScoreFixture();

  const kickoff = fixture.kickoffAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const submit = () => {
    const parsed = fixtureResultInputSchema.safeParse({
      homeScore: home,
      awayScore: away,
    });
    if (!parsed.success) {
      feedback.onError('Scores must be non-negative whole numbers.');
      return;
    }
    score.mutate(
      { fixtureId: fixture.id, input: parsed.data },
      {
        onSuccess: () =>
          feedback.onSuccess(
            `Saved ${fixture.homeTeam.code} ${parsed.data.homeScore}–${parsed.data.awayScore} ${fixture.awayTeam.code}.`
          ),
        onError: (err) =>
          feedback.onError(
            err instanceof Error ? err.message : 'Could not save the result.'
          ),
      }
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        ...(finished
          ? { bgcolor: (t) => alpha(t.palette.success.main, 0.06) }
          : null),
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {fixture.homeTeam.flagEmoji} {fixture.homeTeam.name}
            </Typography>
            <Typography component="span" sx={{ color: 'text.disabled' }}>
              vs
            </Typography>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {fixture.awayTeam.name} {fixture.awayTeam.flagEmoji}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={STAGE_LABELS[fixture.stage]}
            />
            <Chip
              size="small"
              color={STATUS_COLOR[fixture.status]}
              label={STATUS_LABELS[fixture.status]}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {kickoff}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
          }}
        >
          <ScoreStepper
            value={home}
            onChange={setHome}
            disabled={score.isPending}
            label={`${fixture.homeTeam.name} goals`}
          />
          <Typography sx={{ fontWeight: 800, color: 'text.disabled' }}>
            –
          </Typography>
          <ScoreStepper
            value={away}
            onChange={setAway}
            disabled={score.isPending}
            label={`${fixture.awayTeam.name} goals`}
          />
          <Button
            variant={finished ? 'outlined' : 'contained'}
            onClick={submit}
            disabled={score.isPending}
            sx={{ whiteSpace: 'nowrap', minWidth: 116 }}
          >
            {score.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : finished ? (
              'Update result'
            ) : (
              'Enter result'
            )}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [stage, setStage] = useState<Stage | undefined>(undefined);
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [snack, setSnack] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = session?.user?.role === 'admin';

  const {
    data: fixtures,
    isPending,
    isError,
    error,
  } = useAdminFixtures(isAdmin ? { stage, status } : {});

  const feedback: FeedbackHandlers = {
    onSuccess: (message) => setSnack({ severity: 'success', message }),
    onError: (message) => setSnack({ severity: 'error', message }),
  };

  if (sessionStatus === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Alert severity="error">
        You need administrator access to view this page.
      </Alert>
    );
  }

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
          <AdminPanelSettingsIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Admin panel
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Manage fixtures · Enter results
          </Typography>
        </Box>
      </Box>

      <Alert severity="warning" icon={false} sx={{ borderRadius: 3 }}>
        <strong>Admin mode</strong> · Entering a result finishes the fixture and
        rescores all predictions immediately.
      </Alert>

      <Stack spacing={1.5}>
        <FilterRow
          label="Stage"
          options={STAGE_OPTIONS}
          optionLabel={(s) => STAGE_LABELS[s]}
          value={stage}
          onChange={setStage}
        />
        <FilterRow
          label="Status"
          options={STATUS_OPTIONS}
          optionLabel={(s) => STATUS_LABELS[s]}
          value={status}
          onChange={setStatus}
        />
      </Stack>

      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error
            ? error.message
            : 'Could not load fixtures.'}
        </Alert>
      ) : fixtures.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No fixtures match this filter.
          </Typography>
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => {
              setStage(undefined);
              setStatus(undefined);
            }}
          >
            Show all fixtures
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {fixtures.map((fixture) => (
            <FixtureResultRow
              key={fixture.id}
              fixture={fixture}
              feedback={feedback}
            />
          ))}
        </Stack>
      )}

      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 72, sm: 80 } }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            onClose={() => setSnack(null)}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
