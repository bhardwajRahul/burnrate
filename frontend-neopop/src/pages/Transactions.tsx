import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { CommandSearch } from '@/components/CommandSearch';
import { TransactionRow } from '@/components/TransactionRow';
import { FilterModal } from '@/components/FilterModal';
import { useFilters } from '@/contexts/FilterContext';
import { useTransactions, useCards } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@cred/neopop-web/lib/components';
import { Typography } from '@cred/neopop-web/lib/components';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import styled from 'styled-components';

const PageLayout = styled.div`
  min-height: 100vh;
  background-color: #0D0D0D;
`;

const Content = styled.main`
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  align-items: center;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const TransactionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DateGroup = styled.div`
  margin-bottom: 24px;
`;

const DateLabel = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PAGE_SIZE = 20;

function TransactionsContent() {
  const navigate = useNavigate();
  const { filters, setFilters, hasActiveFilters } = useFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategories, setSearchCategories] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const cardFilter = filters.selectedCards.length === 1 ? filters.selectedCards[0] : undefined;
  const categoryFilter =
    searchCategories.length > 0
      ? (searchCategories[0] as import('@/lib/types').Category)
      : filters.selectedCategories.length === 1
        ? filters.selectedCategories[0]
        : undefined;

  const { transactions, total, totalAmount, loading } = useTransactions({
    card: cardFilter,
    category: categoryFilter,
    search: searchQuery || undefined,
    from: filters.dateRange.from,
    to: filters.dateRange.to,
    direction: filters.direction !== 'all' ? filters.direction : undefined,
    limit: (page + 1) * PAGE_SIZE,
    offset: 0,
  });
  const { cards } = useCards();

  useEffect(() => {
    setPage(0);
  }, [filters.selectedCards, filters.selectedCategories, filters.dateRange.from, filters.dateRange.to, filters.amountRange.min, filters.amountRange.max, filters.direction]);

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeTotal = typeof total === 'number' ? total : 0;

  let filteredTransactions = safeTransactions;
  if (filters.selectedCards.length > 1) {
    const cardSet = new Set(filters.selectedCards);
    filteredTransactions = filteredTransactions.filter((t) => {
      const card = safeCards.find((c) => c.bank === t.bank && c.last4 === t.cardLast4);
      return card && cardSet.has(card.id);
    });
  }
  if (filters.amountRange.min !== undefined || filters.amountRange.max !== undefined) {
    filteredTransactions = filteredTransactions.filter((t) => {
      const amt = t.type === 'debit' ? t.amount : -t.amount;
      if (filters.amountRange.min !== undefined && amt < filters.amountRange.min!) return false;
      if (filters.amountRange.max !== undefined && amt > filters.amountRange.max!) return false;
      return true;
    });
  }

  const handleSearch = useCallback(
    (query: string, searchFilters: { categories: import('@/lib/types').Category[] }) => {
      setSearchQuery(query);
      setSearchCategories(searchFilters.categories);
      setPage(0);
      setSearchOpen(false);
    },
    []
  );

  const handleCardToggle = (cardId: string) => {
    setFilters({
      selectedCards: filters.selectedCards.includes(cardId)
        ? filters.selectedCards.filter((id) => id !== cardId)
        : [...filters.selectedCards, cardId],
    });
    setPage(0);
  };

  const handleAllCards = () => {
    setFilters({ selectedCards: [] });
    setPage(0);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  const groupedByDate = filteredTransactions.reduce<
    Record<string, typeof filteredTransactions>
  >(
    (acc, tx) => {
      const date = tx.date;
      if (!acc[date]) acc[date] = [];
      acc[date]!.push(tx);
      return acc;
    },
    {}
  );

  const activeCount =
    filters.selectedCards.length +
    filters.selectedCategories.length +
    (filters.dateRange.from ? 1 : 0) +
    (filters.dateRange.to ? 1 : 0) +
    (filters.amountRange.min !== undefined ? 1 : 0) +
    (filters.amountRange.max !== undefined ? 1 : 0) +
    (filters.direction !== 'all' ? 1 : 0);

  return (
    <PageLayout>
      <Navbar activeTab="transactions" onTabChange={(tab) => navigate(`/${tab}`)} />
      <Content>
        <ActionBar>
          <Button
            variant={hasActiveFilters ? 'secondary' : 'primary'}
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={14} style={{ marginRight: 6 }} />
            Filters {hasActiveFilters ? `(${activeCount})` : ''}
          </Button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button
              variant={searchQuery ? 'secondary' : searchOpen ? 'secondary' : 'primary'}
              kind="elevated"
              size="small"
              colorMode="dark"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={14} style={{ marginRight: 6 }} />
              {searchQuery ? `"${searchQuery}"` : 'Search'}
              {!searchQuery && <kbd style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>⌘K</kbd>}
            </Button>
            {searchQuery && (
              <Button
                variant="secondary"
                kind="elevated"
                size="small"
                colorMode="dark"
                onClick={() => {
                  setSearchQuery('');
                  setSearchCategories([]);
                  setPage(0);
                }}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </ActionBar>

        <FilterRow>
          <Button
            variant={filters.selectedCards.length === 0 ? 'secondary' : 'primary'}
            kind="elevated"
            size="small"
            colorMode="dark"
            onClick={handleAllCards}
          >
            All cards
          </Button>
          {safeCards.map((card) => (
            <Button
              key={card.id}
              variant={filters.selectedCards.includes(card.id) ? 'secondary' : 'primary'}
              kind="elevated"
              size="small"
              colorMode="dark"
              onClick={() => handleCardToggle(card.id)}
            >
              {card.bank} ...{card.last4}
            </Button>
          ))}
        </FilterRow>

        <Header>
          <div>
            <Typography fontType={FontType.BODY} fontSize={12} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.5)">
              {safeTotal} transaction{safeTotal !== 1 ? 's' : ''}
            </Typography>
            <Typography fontType={FontType.BODY} fontSize={20} fontWeight={FontWeights.SEMI_BOLD} color="#ffffff">
              {formatCurrency(totalAmount)}
            </Typography>
          </div>
        </Header>

        <CommandSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={handleSearch}
        />

        {loading ? (
          <Typography fontType={FontType.BODY} fontSize={14} color="rgba(255,255,255,0.5)">
            Loading...
          </Typography>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Typography fontType={FontType.BODY} fontSize={16} fontWeight={FontWeights.REGULAR} color="rgba(255,255,255,0.6)">
              No transactions found. Import credit card statements or adjust your filters.
            </Typography>
          </div>
        ) : (
          <TransactionList>
            {Object.entries(groupedByDate).map(([date, txs]) => (
              <DateGroup key={date}>
                <DateLabel>
                  {new Date(date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </DateLabel>
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </DateGroup>
            ))}
          </TransactionList>
        )}

        {!loading && safeTransactions.length < safeTotal && (
          <Button
            variant="primary"
            kind="elevated"
            size="medium"
            colorMode="dark"
            fullWidth
            onClick={handleLoadMore}
            style={{ marginTop: 24 }}
          >
            Load more ({safeTotal - safeTransactions.length} remaining)
          </Button>
        )}
      </Content>

      <FilterModal open={filterOpen} onClose={() => setFilterOpen(false)} />
    </PageLayout>
  );
}

export function Transactions() {
  return <TransactionsContent />;
}
