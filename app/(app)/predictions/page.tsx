'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { STAGE_TABS, type StageTab } from '@pitchpredict/contracts';
import { useState } from 'react';
import type { FixturesResponse } from '../../../src/api/hooks/useFixtures';
import { useFixtures } from '../../../src/api/hooks/useFixtures';
import { FixtureCard } from '../../../src/components/FixtureCard';

/** Display labels for the stage tabs (ports `FixturesHelper::STAGE_TABS`). */
const STAGE_TAB_LABELS: Record<StageTab, string> = {
  upcoming: 'Upcoming',
  group: 'Groups',
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third_place: '3rd Place',
  final: 'Final',
};

/** "Saturday 14 June" from an ISO date label (`2026-06-14`). */
function formatDateHeading(isoDate: string): string {
  // Append a fixed time so the date is parsed in local terms without TZ drift.
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * Turns an API group label into a section heading. `upcoming` groups are keyed
 * by ISO date; the group stage by bare group name; other stages use a single
 * unlabelled group.
 */
function sectionHeading(stage: StageTab, label: string): string | null {
  if (label === '') return null;
  if (stage === 'upcoming') return formatDateHeading(label);
  if (stage === 'group') return `Group ${label}`;
  return label;
}

function emptyMessage(stage: StageTab): string {
  return stage === 'upcoming'
    ? 'No upcoming matches — every game has kicked off.'
    : 'No fixtures scheduled for this stage yet. Check back once the bracket is set.';
}

const GRID_SX = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
} as const;

function FixturesGrid({
  data,
  stage,
}: {
  data: FixturesResponse;
  stage: StageTab;
}) {
  if (data.groups.length === 0 || data.groups.every((g) => g.fixtures.length === 0)) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {emptyMessage(stage)}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={4}>
      {data.groups.map((group) => {
        const heading = sectionHeading(stage, group.label);
        return (
          <Box component="section" key={group.label || 'all'}>
            {heading && (
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 1.5, fontWeight: 700 }}
              >
                {heading}
              </Typography>
            )}
            <Box sx={GRID_SX}>
              {group.fixtures.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  prediction={data.predictionsByFixtureId[String(fixture.id)]}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default function PredictionsPage() {
  const [stage, setStage] = useState<StageTab>('upcoming');
  const { data, isPending, isError, error } = useFixtures(stage);

  return (
    <Stack spacing={3}>
      <Box component="header">
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Predictions
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Lock in your scores before kickoff — 4 pts exact, 3 pts goal difference,
          2 pts outcome.
        </Typography>
      </Box>

      <Tabs
        value={stage}
        onChange={(_, value: StageTab) => setStage(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Tournament stages"
      >
        {STAGE_TABS.map((tab) => (
          <Tab key={tab} value={tab} label={STAGE_TAB_LABELS[tab]} />
        ))}
      </Tabs>

      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load fixtures.'}
        </Alert>
      ) : (
        <FixturesGrid data={data} stage={stage} />
      )}
    </Stack>
  );
}
