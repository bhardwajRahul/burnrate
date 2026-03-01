import { useState, useEffect } from 'react';
import { Button } from '@cred/neopop-web/lib/components';
import { Calendar } from 'lucide-react';

type Preset = 'this_month' | '3_months' | '6_months' | '1_year' | 'custom';

interface DateRangePickerProps {
  value?: Preset;
  onChange?: (preset: Preset, range?: { from: string; to: string }) => void;
  className?: string;
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: '3_months', label: '3 months' },
  { id: '6_months', label: '6 months' },
  { id: '1_year', label: '1 year' },
  { id: 'custom', label: 'Custom' },
];

export function DateRangePicker({ value = 'this_month', onChange, className }: DateRangePickerProps) {
  const [selected, setSelected] = useState<Preset>(value);
  const [showCustom, setShowCustom] = useState(value === 'custom');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setSelected(value);
    setShowCustom(value === 'custom');
  }, [value]);

  const handleSelect = (preset: Preset) => {
    setSelected(preset);
    setShowCustom(preset === 'custom');
    if (preset !== 'custom') {
      onChange?.(preset);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className={className}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant={selected === preset.id ? 'secondary' : 'primary'}
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={() => handleSelect(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Calendar size={16} color="#ffffff" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to) onChange?.('custom', { from: e.target.value, to });
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              outline: 'none',
              fontSize: 14,
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              if (from) onChange?.('custom', { from, to: e.target.value });
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              outline: 'none',
              fontSize: 14,
            }}
          />
        </div>
      )}
    </div>
  );
}
