'use client';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
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
  type Team,
} from '@pitchpredict/contracts';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import {
  useAdminAssignTeams,
  useAdminFixtures,
  useAdminScoreFixture,
  useAdminTeams,
} from '../../../src/api/hooks/useAdminFixtures';
import { ScoreStepper } from '../../../src/components/ScoreStepper';

const STAGE_OPTIONS = STAGE_TABS.filter(
  (t): t is Stage => t !== 'upcoming'
);
const STATUS_OPTIONS = zStatus.options;

/** Knockout stages, in bracket order, for the team-assignment section. */
const KNOCKOUT_STAGES = [
  'r32',
  'r16',
  'qf',
  'sf',
  'third_place',
  'final',
] as const satisfies readonly Stage[];

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

  // Knockout fixtures may have unassigned teams (TBD) — fall back gracefully.
  const homeName = fixture.homeTeam?.name ?? 'TBD';
  const awayName = fixture.awayTeam?.name ?? 'TBD';
  const homeFlag = fixture.homeTeam?.flagEmoji ?? '⚽';
  const awayFlag = fixture.awayTeam?.flagEmoji ?? '⚽';

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
            `Saved ${fixture.homeTeam?.code ?? 'TBD'} ${parsed.data.homeScore}–${parsed.data.awayScore} ${fixture.awayTeam?.code ?? 'TBD'}.`
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
              {homeFlag} {homeName}
            </Typography>
            <Typography component="span" sx={{ color: 'text.disabled' }}>
              vs
            </Typography>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {awayName} {awayFlag}
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
            label={`${homeName} goals`}
          />
          <Typography sx={{ fontWeight: 800, color: 'text.disabled' }}>
            –
          </Typography>
          <ScoreStepper
            value={away}
            onChange={setAway}
            disabled={score.isPending}
            label={`${awayName} goals`}
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

/** One <select> for a knockout slot; `''` is the unassigned (TBD) state. */
function TeamSelect({
  label,
  value,
  teams,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  teams: Team[];
  disabled: boolean;
  onChange: (id: number | null) => void;
}) {
  const labelId = `${label.replace(/\s+/g, '-').toLowerCase()}-label`;
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value == null ? '' : String(value)}
        disabled={disabled}
        onChange={(e: SelectChangeEvent) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
      >
        <MenuItem value="">
          <em>TBD</em>
        </MenuItem>
        {teams.map((team) => (
          <MenuItem key={team.id} value={String(team.id)}>
            <span aria-hidden>{team.flagEmoji}</span>
            <Box component="span" sx={{ ml: 1 }}>
              {team.name}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function KnockoutTeamsRow({
  fixture,
  teams,
  feedback,
}: {
  fixture: FixtureWithTeams;
  teams: Team[];
  feedback: FeedbackHandlers;
}) {
  const [homeTeamId, setHomeTeamId] = useState<number | null>(
    fixture.homeTeamId ?? null
  );
  const [awayTeamId, setAwayTeamId] = useState<number | null>(
    fixture.awayTeamId ?? null
  );
  const assign = useAdminAssignTeams();

  const kickoff = fixture.kickoffAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const dirty =
    homeTeamId !== (fixture.homeTeamId ?? null) ||
    awayTeamId !== (fixture.awayTeamId ?? null);

  const submit = () => {
    assign.mutate(
      { fixtureId: fixture.id, input: { homeTeamId, awayTeamId } },
      {
        onSuccess: () => feedback.onSuccess('Knockout teams saved.'),
        onError: (err) =>
          feedback.onError(
            err instanceof Error ? err.message : 'Could not save the teams.'
          ),
      }
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            variant="outlined"
            label={STAGE_LABELS[fixture.stage]}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fixture.stadium.name} · {fixture.stadium.city} · {kickoff}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <TeamSelect
            label="Home team"
            value={homeTeamId}
            teams={teams}
            disabled={assign.isPending}
            onChange={setHomeTeamId}
          />
          <Typography sx={{ color: 'text.disabled', fontWeight: 700 }}>vs</Typography>
          <TeamSelect
            label="Away team"
            value={awayTeamId}
            teams={teams}
            disabled={assign.isPending}
            onChange={setAwayTeamId}
          />
          <Button
            variant="contained"
            onClick={submit}
            disabled={assign.isPending || !dirty}
            sx={{ whiteSpace: 'nowrap', minWidth: 96 }}
          >
            {assign.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Save'
            )}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

function KnockoutTeamsSection({ feedback }: { feedback: FeedbackHandlers }) {
  // The full 48-team catalog comes from a dedicated admin endpoint — not the
  // dashboard, whose team list is blanked after the champion-pick deadline,
  // i.e. exactly when knockout teams are assigned.
  const {
    data: teams,
    isPending: teamsPending,
    isError: teamsError,
    error: teamsErr,
  } = useAdminTeams();
  const {
    data: fixtures,
    isPending: fixturesPending,
    isError: fixturesError,
    error: fixturesErr,
  } = useAdminFixtures();

  // Gate the spinner on the requests themselves, never on a (possibly legitimately
  // empty) result, so the section can never hang forever.
  const isPending = teamsPending || fixturesPending;
  const isError = teamsError || fixturesError;
  const error = teamsErr ?? fixturesErr;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Knockout teams
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Assign teams to knockout matches as the groups conclude.
        </Typography>
      </Box>

      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Could not load fixtures.'}
        </Alert>
      ) : teams.length === 0 ? (
        <Alert severity="warning">
          No teams found. Knockout teams cannot be assigned until the team
          catalog is available.
        </Alert>
      ) : (
        <Stack spacing={2.5}>
          {KNOCKOUT_STAGES.map((stage) => {
            const stageFixtures = fixtures
              .filter((f) => f.stage === stage)
              .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
            if (stageFixtures.length === 0) return null;
            return (
              <Box component="section" key={stage}>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1, fontWeight: 700, color: 'text.secondary' }}
                >
                  {STAGE_LABELS[stage]}
                </Typography>
                <Stack spacing={1.5}>
                  {stageFixtures.map((fixture) => (
                    <KnockoutTeamsRow
                      key={fixture.id}
                      fixture={fixture}
                      teams={teams}
                      feedback={feedback}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
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

      <Divider />

      <KnockoutTeamsSection feedback={feedback} />

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
