'use client';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';

export interface ScoreStepperProps {
  /** Current goal value. */
  value: number;
  /** Called with the clamped next value when the user edits/steps. */
  onChange: (value: number) => void;
  /** Disable the whole control (locked / finished cards). */
  disabled?: boolean;
  /** Accessible label, e.g. "Brazil goals". */
  label: string;
  min?: number;
  max?: number;
}

/**
 * Chevron-up / number-input / chevron-down stepper for a single team's goals.
 * Controlled (0–20, tabular-nums). Ports the Rails Stimulus `stepper` controller
 * + `score-input` styling. Clamps to `[min, max]` on both step and manual entry.
 */
export function ScoreStepper({
  value,
  onChange,
  disabled = false,
  label,
  min = 0,
  max = 20,
}: ScoreStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const step = (delta: number) => {
    if (disabled) return;
    onChange(clamp(value + delta));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <IconButton
        type="button"
        size="small"
        disabled={disabled}
        aria-label={`Increase ${label}`}
        onClick={() => step(1)}
      >
        <KeyboardArrowUpIcon fontSize="small" />
      </IconButton>

      <InputBase
        type="number"
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        inputProps={{
          min,
          max,
          step: 1,
          inputMode: 'numeric',
          'aria-label': label,
          style: { textAlign: 'center', MozAppearance: 'textfield' },
        }}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(next) ? min : clamp(next));
        }}
        sx={{
          width: 56,
          '& input': {
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            fontSize: '1.25rem',
            textAlign: 'center',
            py: 0.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          },
          '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button':
            {
              WebkitAppearance: 'none',
              margin: 0,
            },
        }}
      />

      <IconButton
        type="button"
        size="small"
        disabled={disabled}
        aria-label={`Decrease ${label}`}
        onClick={() => step(-1)}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
