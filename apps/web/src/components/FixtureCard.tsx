'use client';

import LockIcon from '@mui/icons-material/Lock';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { FixtureWithTeams, Prediction, Team } from '@pitchpredict/contracts';
import { useEffect, useState } from 'react';
import { usePrediction } from '../api/hooks/usePrediction';
import { ScoreStepper } from './ScoreStepper';

export interface FixtureCardProps {
  fixture: FixtureWithTeams;
  /** The caller's saved prediction for this fixture, if any. */
  prediction?: Prediction;
}

/** "Sat 14 Jun · 4:00 PM ET" — ports `kickoff_label(style: :short)`. */
function kickoffLabel(kickoffAt: Date): string {
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/New_York',
  }).format(kickoffAt);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(kickoffAt);
  return `${date} · ${time} ET`;
}

interface TeamColumnProps {
  /** Null when the knockout slot has no team assigned yet (TBD). */
  team: Team | null;
}

function TeamColumn({ team }: TeamColumnProps) {
  // Knockout slots may be unassigned: show a neutral placeholder, no flag.
  const flagEmoji = team ? team.flagEmoji : '⚽';
  const name = team ? team.name : 'TBD';
  return (
    <Box
      sx={{
        minWidth: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        textAlign: 'center',
      }}
    >
      <Box
        component="span"
        sx={{ fontSize: '1.875rem', lineHeight: 1, color: team ? undefined : 'text.disabled' }}
        aria-hidden
      >
        {flagEmoji}
      </Box>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: team ? undefined : 'text.disabled',
        }}
      >
        {name}
      </Typography>
    </Box>
  );
}

function StatusBadge({
  fixture,
  prediction,
}: {
  fixture: FixtureWithTeams;
  prediction?: Prediction;
}) {
  const finished = fixture.status === 'finished';

  if (finished && prediction && prediction.pointsAwarded != null) {
    return (
      <Chip
        size="small"
        color="secondary"
        label={`+${prediction.pointsAwarded} pts`}
        sx={{ fontWeight: 600 }}
      />
    );
  }
  if (finished && !prediction) {
    return <Chip size="small" variant="outlined" label="No prediction" />;
  }
  if (prediction && !finished) {
    return <Chip size="small" color="success" label="Predicted" />;
  }
  return null;
}

export function FixtureCard({ fixture, prediction }: FixtureCardProps) {
  const finished = fixture.status === 'finished';
  const live = fixture.status === 'live';
  const locked = fixture.locked;
  const editable = !locked && !finished;

  const [home, setHome] = useState(prediction?.homeScore ?? 0);
  const [away, setAway] = useState(prediction?.awayScore ?? 0);

  // Keep local steppers in sync if the saved prediction arrives/changes.
  useEffect(() => {
    setHome(prediction?.homeScore ?? 0);
    setAway(prediction?.awayScore ?? 0);
  }, [prediction?.homeScore, prediction?.awayScore]);

  const mutation = usePrediction();

  const submit = () => {
    mutation.mutate({
      fixtureId: fixture.id,
      input: { homeScore: home, awayScore: away },
    });
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent
        sx={{
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
          p: 2.5,
        }}
      >
        {/* Header: venue + kickoff, plus status / lock badges. */}
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 500,
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fixture.stadium.name} · {fixture.stadium.city}
            </Typography>
            <Typography
              variant="caption"
              component="time"
              dateTime={fixture.kickoffAt.toISOString()}
              sx={{ color: 'text.secondary' }}
            >
              {kickoffLabel(fixture.kickoffAt)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 0.75 }}>
            {live && <Chip size="small" color="error" label="Live" />}
            <StatusBadge fixture={fixture} prediction={prediction} />
            {locked && !finished && (
              <LockIcon
                fontSize="small"
                sx={{ color: 'text.disabled' }}
                aria-label="Locked"
              />
            )}
          </Box>
        </Box>

        {finished ? (
          <FinishedBody fixture={fixture} prediction={prediction} />
        ) : locked ? (
          <LockedBody fixture={fixture} prediction={prediction} />
        ) : (
          <OpenBody
            fixture={fixture}
            home={home}
            away={away}
            onHome={setHome}
            onAway={setAway}
            onSubmit={submit}
            saving={mutation.isPending}
            saved={mutation.isSuccess}
            error={mutation.error?.message ?? null}
            hasPrediction={!!prediction}
            disabled={!editable}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FinishedBody({
  fixture,
  prediction,
}: {
  fixture: FixtureWithTeams;
  prediction?: Prediction;
}) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <TeamColumn team={fixture.homeTeam} />
        <Typography
          sx={{
            flexShrink: 0,
            px: 1,
            fontSize: '1.875rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: 'primary.main',
          }}
        >
          {fixture.homeScore}
          <Box component="span" sx={{ px: 1, color: 'text.disabled' }}>
            –
          </Box>
          {fixture.awayScore}
        </Typography>
        <TeamColumn team={fixture.awayTeam} />
      </Box>

      <Divider sx={{ mt: 'auto' }} />
      <Box
        component="footer"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {prediction ? (
            <>
              Your pick:{' '}
              <Box
                component="span"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {prediction.homeScore}–{prediction.awayScore}
              </Box>
            </>
          ) : (
            <Box component="span" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
              No prediction
            </Box>
          )}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Result:{' '}
          <Box
            component="span"
            sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {fixture.homeScore}–{fixture.awayScore}
          </Box>
        </Typography>
      </Box>
    </>
  );
}

function LockedBody({
  fixture,
  prediction,
}: {
  fixture: FixtureWithTeams;
  prediction?: Prediction;
}) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <TeamColumn team={fixture.homeTeam} />
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            alignItems: 'center',
            gap: 1,
          }}
        >
          <ScoreStepper
            value={prediction?.homeScore ?? 0}
            onChange={() => undefined}
            disabled
            label={`Your predicted ${fixture.homeTeam?.name ?? 'home'} goals`}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.disabled',
            }}
          >
            vs
          </Typography>
          <ScoreStepper
            value={prediction?.awayScore ?? 0}
            onChange={() => undefined}
            disabled
            label={`Your predicted ${fixture.awayTeam?.name ?? 'away'} goals`}
          />
        </Box>
        <TeamColumn team={fixture.awayTeam} />
      </Box>

      <Box
        sx={{
          mt: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        <LockIcon sx={{ fontSize: 14, color: 'text.disabled' }} aria-hidden />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {!fixture.homeTeam || !fixture.awayTeam
            ? 'Teams to be confirmed.'
            : prediction
              ? 'Your prediction · locked at kickoff'
              : 'Predictions closed at kickoff.'}
        </Typography>
      </Box>
    </>
  );
}

function OpenBody({
  fixture,
  home,
  away,
  onHome,
  onAway,
  onSubmit,
  saving,
  saved,
  error,
  hasPrediction,
  disabled,
}: {
  fixture: FixtureWithTeams;
  home: number;
  away: number;
  onHome: (n: number) => void;
  onAway: (n: number) => void;
  onSubmit: () => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  hasPrediction: boolean;
  disabled: boolean;
}) {
  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      sx={{
        mt: 'auto',
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {error && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <TeamColumn team={fixture.homeTeam} />
        <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 1.5 }}>
          <ScoreStepper
            value={home}
            onChange={onHome}
            disabled={disabled}
            label={`${fixture.homeTeam?.name ?? 'home'} goals`}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.disabled',
            }}
          >
            vs
          </Typography>
          <ScoreStepper
            value={away}
            onChange={onAway}
            disabled={disabled}
            label={`${fixture.awayTeam?.name ?? 'away'} goals`}
          />
        </Box>
        <TeamColumn team={fixture.awayTeam} />
      </Box>

      <Box
        sx={{
          mt: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={disabled || saving}
        >
          {hasPrediction ? 'Update prediction' : 'Save prediction'}
        </Button>
        {saved && !saving && (
          <Typography
            variant="caption"
            role="status"
            sx={{ fontWeight: 600, color: 'success.main' }}
          >
            Saved ✓
          </Typography>
        )}
      </Box>
    </Box>
  );
}
