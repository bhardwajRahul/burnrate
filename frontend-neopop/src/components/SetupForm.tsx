import { useState, useEffect } from 'react';
import { Button } from '@cred/neopop-web/lib/components';
import { Typography } from '@cred/neopop-web/lib/components';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import type { Bank } from '@/lib/types';
import { BANK_CONFIG } from '@/lib/types';
import { Plus, Trash2, FolderOpen, CreditCard, Shield } from 'lucide-react';
import axios from 'axios';

interface CardEntry {
  bank: Bank;
  last4: string;
}

interface SetupFormData {
  name: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  cards: CardEntry[];
  watchFolder: string;
}

export interface SetupFormInitialData {
  name?: string;
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
  cards?: CardEntry[];
  watchFolder?: string;
}

interface SetupFormProps {
  onSubmit?: (data: SetupFormData) => void;
  className?: string;
  initialData?: SetupFormInitialData;
  isUpdate?: boolean;
}

const BANKS: { id: Bank; name: string; color: string }[] = [
  { id: 'hdfc', name: 'HDFC Bank', color: BANK_CONFIG.hdfc.color },
  { id: 'icici', name: 'ICICI Bank', color: BANK_CONFIG.icici.color },
  { id: 'axis', name: 'Axis Bank', color: BANK_CONFIG.axis.color },
];

export function SetupForm({ onSubmit, className, initialData, isUpdate = false }: SetupFormProps) {
  const [name, setName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [cards, setCards] = useState<CardEntry[]>([{ bank: 'hdfc', last4: '' }]);
  const [watchFolder, setWatchFolder] = useState('');

  useEffect(() => {
    if (initialData) {
      if (initialData.name) setName(initialData.name);
      if (initialData.dobDay) setDobDay(initialData.dobDay);
      if (initialData.dobMonth) setDobMonth(initialData.dobMonth);
      if (initialData.dobYear) setDobYear(initialData.dobYear);
      if (initialData.watchFolder) setWatchFolder(initialData.watchFolder);
      if (initialData.cards && initialData.cards.length > 0) {
        setCards(initialData.cards);
      }
    }
  }, [initialData]);

  const handleBrowse = async () => {
    try {
      const { data } = await axios.post('http://localhost:8000/api/settings/browse-folder');
      if (data.path) {
        setWatchFolder(data.path);
        return;
      }
    } catch {
      // Backend not available, fall through
    }
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as Window & { showDirectoryPicker: (opts?: { mode?: string }) => Promise<{ name: string }> }).showDirectoryPicker({ mode: 'read' });
        setWatchFolder(handle.name);
      } catch {
        // User cancelled
      }
    }
  };

  const addCard = () => setCards([...cards, { bank: 'hdfc', last4: '' }]);

  const removeCard = (index: number) => {
    if (cards.length > 1) setCards(cards.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, field: keyof CardEntry, value: string) => {
    setCards(cards.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ name, dobDay, dobMonth, dobYear, cards, watchFolder });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#0D0D0D',
      }}
      className={className}
    >
      <div style={{ width: '100%', maxWidth: 448, boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <CreditCard size={28} color="#FF8744" />
            <Typography fontType={FontType.BODY} fontSize={24} fontWeight={FontWeights.BOLD} color="#ffffff" style={{ letterSpacing: '-0.02em' }}>
              burnrate
            </Typography>
          </div>
          <Typography fontType={FontType.BODY} fontSize={20} fontWeight={FontWeights.SEMI_BOLD} color="#ffffff" style={{ marginBottom: 8 }}>
            Let's make sense of your spends.
          </Typography>
          <Typography fontType={FontType.BODY} fontSize={14} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.6)">
            Set up your cards once, and we'll handle the rest.
          </Typography>
        </div>

        <form onSubmit={handleSubmit} style={{ boxSizing: 'border-box' }}>
          <div
            style={{
              backgroundColor: '#161616',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              maxWidth: 448,
              width: '100%',
            }}
          >
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.MEDIUM} color="rgba(255,255,255,0.6)" style={{ marginBottom: 6 }}>
                Your name (as on card)
              </Typography>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pratik Prakash"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#ffffff',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  outline: 'none',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.MEDIUM} color="rgba(255,255,255,0.6)" style={{ marginBottom: 6 }}>
                Date of Birth
              </Typography>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8 }}>
                <input
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="DD"
                  maxLength={2}
                  style={{
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    outline: 'none',
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                />
                <input
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="MM"
                  maxLength={2}
                  style={{
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    outline: 'none',
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                />
                <input
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="YYYY"
                  maxLength={4}
                  style={{
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    outline: 'none',
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>

            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.MEDIUM} color="rgba(255,255,255,0.6)" style={{ marginBottom: 6 }}>
                Your Credit Cards
              </Typography>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.map((card, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={card.bank}
                      onChange={(e) => updateCard(index, 'bank', e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        boxSizing: 'border-box',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: '#ffffff',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.2)',
                        outline: 'none',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {BANKS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        ····
                      </span>
                      <input
                        value={card.last4}
                        onChange={(e) => updateCard(index, 'last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1234"
                        maxLength={4}
                        style={{
                          width: 96,
                          paddingLeft: 40,
                          boxSizing: 'border-box',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#ffffff',
                          padding: '10px 12px 10px 40px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.2)',
                          outline: 'none',
                          fontSize: 14,
                        }}
                      />
                    </div>
                    {cards.length > 1 && (
                      <Button
                        type="button"
                        variant="primary"
                        kind="elevated"
                        size="small"
                        colorMode="dark"
                        onClick={() => removeCard(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.5)',
                          padding: 4,
                          minWidth: 32,
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="primary"
                kind="elevated"
                size="small"
                colorMode="dark"
                onClick={addCard}
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#FF8744',
                  background: 'none',
                  border: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                <Plus size={14} />
                Add another card
              </Button>
            </div>

            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.MEDIUM} color="rgba(255,255,255,0.6)" style={{ marginBottom: 6 }}>
                Watch folder for new statements
              </Typography>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={watchFolder}
                  onChange={(e) => setWatchFolder(e.target.value)}
                  placeholder="~/Documents/Statements"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    outline: 'none',
                    fontSize: 14,
                  }}
                />
                <Button type="button" variant="primary" kind="elevated" size="small" colorMode="dark" onClick={handleBrowse}>
                  <FolderOpen size={14} style={{ marginRight: 4 }} />
                  Browse
                </Button>
              </div>
              <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
                Tip: Sync your Google Drive here for auto-import
              </Typography>
            </div>

            <Button type="submit" variant="primary" kind="elevated" size="big" colorMode="dark" fullWidth style={{ marginTop: 8 }}>
              {isUpdate ? 'Update' : 'Save & Continue'}
            </Button>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          <Shield size={12} color="rgba(255,255,255,0.5)" />
          <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.5)">
            Your data never leaves your laptop.
          </Typography>
        </div>
      </div>
    </div>
  );
}
