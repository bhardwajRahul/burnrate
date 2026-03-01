import { useState, useEffect } from 'react';
import { ElevatedCard } from '@cred/neopop-web/lib/components';
import { Typography } from '@cred/neopop-web/lib/components';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import { Button } from '@cred/neopop-web/lib/components';
import { X } from 'lucide-react';
import { useFilters, type Direction } from '@/contexts/FilterContext';
import { useCards } from '@/hooks/useApi';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { Category } from '@/lib/types';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];

export function FilterModal({ open, onClose }: FilterModalProps) {
  const { filters, setFilters, clearFilters } = useFilters();
  const { cards } = useCards();

  const [localCards, setLocalCards] = useState<string[]>([]);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [localDirection, setLocalDirection] = useState<Direction>('all');
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [localMin, setLocalMin] = useState('');
  const [localMax, setLocalMax] = useState('');

  const safeCards = Array.isArray(cards) ? cards : [];

  useEffect(() => {
    if (open) {
      setLocalCards(filters.selectedCards);
      setLocalCategories(filters.selectedCategories);
      setLocalDirection(filters.direction);
      setLocalFrom(filters.dateRange.from ?? '');
      setLocalTo(filters.dateRange.to ?? '');
      setLocalMin(filters.amountRange.min?.toString() ?? '');
      setLocalMax(filters.amountRange.max?.toString() ?? '');
    }
  }, [open, filters]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const toggleCard = (id: string) => {
    setLocalCards((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCategory = (cat: Category) => {
    setLocalCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleApply = () => {
    setFilters({
      selectedCards: localCards,
      selectedCategories: localCategories,
      direction: localDirection,
      dateRange: {
        from: localFrom || undefined,
        to: localTo || undefined,
      },
      amountRange: {
        min: localMin ? Number(localMin) : undefined,
        max: localMax ? Number(localMax) : undefined,
      },
    });
    onClose();
  };

  const handleClearAll = () => {
    clearFilters();
    onClose();
  };

  if (!open) return null;

  const inputStyle = {
    backgroundColor: '#121212',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#ffffff',
    outline: 'none' as const,
    width: '100%',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      <ElevatedCard
        backgroundColor="#161616"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography
            fontType={FontType.BODY}
            fontSize={18}
            fontWeight={FontWeights.BOLD}
            color="#ffffff"
          >
            Filters
          </Typography>
          <Button
            variant="primary"
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={onClose}
            style={{  minWidth: 'auto' }}
          >
            <X size={18} />
          </Button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Cards */}
          <Typography
            fontType={FontType.BODY}
            fontSize={12}
            fontWeight={FontWeights.MEDIUM}
            color="rgba(255,255,255,0.5)"
            style={{ marginBottom: 10 }}
          >
            Cards
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {safeCards.map((card) => (
              <Button
                key={card.id}
                variant={localCards.includes(card.id) ? 'secondary' : 'primary'}
                kind="elevated"
                size="small"
                colorMode="dark"
                onClick={() => toggleCard(card.id)}
              >
                {card.bank} ...{card.last4}
              </Button>
            ))}
          </div>

          {/* Direction */}
          <Typography
            fontType={FontType.BODY}
            fontSize={12}
            fontWeight={FontWeights.MEDIUM}
            color="rgba(255,255,255,0.5)"
            style={{ marginBottom: 10 }}
          >
            Direction
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {(['all', 'incoming', 'outgoing'] as const).map((d) => (
              <Button
                key={d}
                variant={localDirection === d ? 'secondary' : 'primary'}
                kind="elevated"
                size="small"
                colorMode="dark"
                onClick={() => setLocalDirection(d)}
              >
                {d === 'all' ? 'All' : d === 'incoming' ? 'Incoming' : 'Outgoing'}
              </Button>
            ))}
          </div>

          {/* Categories */}
          <Typography
            fontType={FontType.BODY}
            fontSize={12}
            fontWeight={FontWeights.MEDIUM}
            color="rgba(255,255,255,0.5)"
            style={{ marginBottom: 10 }}
          >
            Categories
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={localCategories.includes(cat) ? 'secondary' : 'primary'}
                kind="elevated"
                size="small"
                colorMode="dark"
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORY_CONFIG[cat].label}
              </Button>
            ))}
          </div>

          {/* Date Range */}
          <Typography
            fontType={FontType.BODY}
            fontSize={12}
            fontWeight={FontWeights.MEDIUM}
            color="rgba(255,255,255,0.5)"
            style={{ marginBottom: 10 }}
          >
            Date Range
          </Typography>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Amount Range */}
          <Typography
            fontType={FontType.BODY}
            fontSize={12}
            fontWeight={FontWeights.MEDIUM}
            color="rgba(255,255,255,0.5)"
            style={{ marginBottom: 10 }}
          >
            Amount Range
          </Typography>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                placeholder="Min"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                placeholder="Max"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="secondary"
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
          <Button
            variant="primary"
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </ElevatedCard>
    </div>
  );
}
