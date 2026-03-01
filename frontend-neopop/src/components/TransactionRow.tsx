import { Typography } from '@cred/neopop-web/lib/components';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { CATEGORY_CONFIG, BANK_CONFIG } from '@/lib/types';
import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Receipt,
  Film,
  Fuel,
  Heart,
  ShoppingCart,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Receipt,
  Film,
  Fuel,
  Heart,
  ShoppingCart,
  CreditCard,
  MoreHorizontal,
};

interface TransactionRowProps {
  transaction: Transaction;
  className?: string;
}

export function TransactionRow({ transaction, className }: TransactionRowProps) {
  const catConfig = CATEGORY_CONFIG[transaction.category];
  const bankConfig = BANK_CONFIG[transaction.bank];
  const Icon = ICON_MAP[catConfig.icon] ?? MoreHorizontal;
  const isCredit = transaction.type === 'credit';
  const isCcPayment = transaction.category === 'cc_payment';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 16px',
        backgroundColor: isCcPayment ? 'rgba(107,114,128,0.08)' : 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        marginBottom: 4,
        opacity: isCcPayment ? 0.7 : 1,
      }}
      className={className}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${catConfig.color}20`,
        }}
      >
        <Icon size={18} color={catConfig.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Typography fontType={FontType.BODY} fontSize={14} fontWeight={FontWeights.SEMI_BOLD} color="#ffffff">
          {transaction.merchant}
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 500,
              backgroundColor: `${catConfig.color}30`,
              color: catConfig.color,
              cursor: isCcPayment ? 'help' : 'default',
            }}
            title={isCcPayment ? 'Credit card payments are not included in spends calculation' : undefined}
          >
            {catConfig.label}
          </span>
          {isCcPayment && (
            <Typography fontType={FontType.BODY} fontSize={11} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.35)">
              Not included in spends
            </Typography>
          )}
          <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.5)">
            {bankConfig.name} ...{transaction.cardLast4}
          </Typography>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          fontType={FontType.BODY}
          fontSize={14}
          fontWeight={FontWeights.SEMI_BOLD}
          color={isCredit ? '#06C270' : '#ffffff'}
        >
          {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
        </Typography>
        <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
          {new Date(transaction.date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        </Typography>
      </div>
    </div>
  );
}
