import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { Typography } from '@cred/neopop-web/lib/components';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import { formatCurrency } from '@/lib/utils';
import type { CategoryBreakdown } from '@/lib/types';
import { CATEGORY_CONFIG, CATEGORY_COLORS } from '@/lib/types';

interface CategoryDonutProps {
  data: CategoryBreakdown[];
  className?: string;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const category = entry.name as string;
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
  return (
    <div
      style={{
        backgroundColor: '#161616',
        borderRadius: 8,
        padding: '8px 12px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.other,
        }}
      >
        {config?.label ?? category}
      </p>
      <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
        {formatCurrency(entry.value as number)}
      </p>
    </div>
  );
}

export function CategoryDonut({ data, className }: CategoryDonutProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div
      style={{ padding: 20, minWidth: 280, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
      className={className}
    >
      <Typography fontType={FontType.BODY} fontSize={14} fontWeight={FontWeights.SEMI_BOLD} color="#ffffff" style={{ marginBottom: 16 }}>
        Where your money goes
      </Typography>

      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ width: 176, height: 176, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={2}
                dataKey="amount"
                nameKey="category"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
          {data.slice(0, 6).map((entry) => {
            const config = CATEGORY_CONFIG[entry.category];
            const pct = total > 0 ? Math.round((entry.amount / total) * 100) : 0;
            return (
              <div key={entry.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: CATEGORY_COLORS[entry.category],
                  }}
                />
                <Typography
                  fontType={FontType.BODY}
                  fontSize={12}
                  fontWeight={FontWeights.REGULAR}
                  color="#ffffff"
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {config?.label ?? entry.category}
                </Typography>
                <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.SEMI_BOLD} color="#ffffff" style={{ flexShrink: 0 }}>
                  {pct}%
                </Typography>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
