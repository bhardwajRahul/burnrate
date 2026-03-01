import axios from 'axios';
import type {
  Bank,
  Card,
  Category,
  CategoryBreakdown,
  MerchantSpend,
  MonthlyTrend,
  Statement,
  Transaction,
} from '@/lib/types';

export interface Settings {
  configured: boolean;
  name?: string;
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
  watchFolder?: string;
  cards?: { bank: Bank; last4: string }[];
}

/** Raw API response from GET /settings */
export interface SettingsApiResponse {
  setup_complete?: boolean;
  configured?: boolean;
  settings?: {
    name?: string;
    dob_day?: string;
    dob_month?: string;
    dob_year?: string;
    watch_folder?: string;
  };
  cards?: { id: string; bank: Bank; last4: string; name?: string }[];
}

export interface SetupProfilePayload {
  name: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  cards: { bank: Bank; last4: string }[];
  watchFolder: string;
}

export interface GetTransactionsParams {
  card?: string;
  from?: string;
  to?: string;
  category?: Category;
  search?: string;
  direction?: string;
  limit?: number;
  offset?: number;
}

export interface GetTransactionsResponse {
  transactions: Transaction[];
  total: number;
  totalAmount?: number;
}

export interface CardSpendItem {
  bank: string;
  last4: string;
  amount: number;
  count: number;
}

export interface GetSummaryResponse {
  totalSpend: number;
  deltaPercent: number;
  deltaLabel?: string;
  period: string;
  sparklineData: { value: number }[];
  cardBreakdown?: CardSpendItem[];
  creditLimit?: number;
  avgMonthlySpend?: number;
  monthsInRange?: number;
}

export interface GetCategoriesResponse {
  breakdown: CategoryBreakdown[];
}

export interface GetTrendsResponse {
  trends: MonthlyTrend[];
}

export interface GetMerchantsResponse {
  merchants: MerchantSpend[];
}

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export async function getSettings(): Promise<Settings> {
  const { data } = await api.get<SettingsApiResponse>('/settings');
  if (!data) return { configured: false };
  const setupComplete = !!data.setup_complete || !!data.configured;
  return {
    configured: setupComplete,
    name: data.settings?.name,
    dobDay: data.settings?.dob_day,
    dobMonth: data.settings?.dob_month,
    dobYear: data.settings?.dob_year,
    watchFolder: data.settings?.watch_folder,
    cards: data.cards?.map((c) => ({ bank: c.bank as Bank, last4: c.last4 })),
  };
}

export async function updateSettings(payload: {
  name?: string;
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
  watchFolder?: string;
  cards?: { bank: string; last4: string }[];
}): Promise<{ status: string }> {
  const body: Record<string, unknown> = {
    name: payload.name,
    dob_day: payload.dobDay,
    dob_month: payload.dobMonth,
    dob_year: payload.dobYear,
    watch_folder: payload.watchFolder,
  };
  if (payload.cards) {
    body.cards = payload.cards.map((c) => ({ bank: c.bank, last4: c.last4 }));
  }
  const { data } = await api.put<{ status: string }>('/settings', body);
  return data;
}

export async function setupProfile(payload: SetupProfilePayload): Promise<Settings> {
  const body = {
    name: payload.name,
    dob_day: payload.dobDay,
    dob_month: payload.dobMonth,
    dob_year: payload.dobYear,
    watch_folder: payload.watchFolder,
    cards: payload.cards,
  };
  const { data } = await api.post<Settings>('/settings/setup', body);
  return data;
}

export interface UploadStatementResult {
  status: string;
  message?: string;
  count?: number;
  bank?: string;
  period?: { start: string | null; end: string | null };
}

export async function uploadStatement(
  file: File,
  bank?: Bank,
  password?: string
): Promise<UploadStatementResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (bank) formData.append('bank', bank);
  if (password) formData.append('password', password);
  const { data } = await api.post<UploadStatementResult>(
    '/statements/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }
  );
  return data;
}

interface StatementRaw {
  id: string;
  bank: string;
  card_last4: string;
  period_start: string | null;
  period_end: string | null;
  transaction_count: number;
  total_spend: number;
  imported_at: string | null;
}

export async function getStatements(): Promise<Statement[]> {
  const { data } = await api.get<StatementRaw[]>('/statements');
  return data.map((s) => ({
    id: s.id,
    bank: s.bank as Bank,
    cardLast4: s.card_last4,
    periodStart: s.period_start ?? '',
    periodEnd: s.period_end ?? '',
    transactionCount: s.transaction_count,
    totalSpend: s.total_spend,
    importedAt: s.imported_at ?? '',
  }));
}

export async function getTransactions(
  params?: GetTransactionsParams
): Promise<GetTransactionsResponse> {
  const { data } = await api.get<GetTransactionsResponse>('/transactions', {
    params,
  });
  return data;
}

export async function getCards(): Promise<Card[]> {
  const { data } = await api.get<Card[]>('/cards');
  return data;
}

export async function deleteCard(cardId: string): Promise<{ status: string; message: string }> {
  const { data } = await api.delete<{ status: string; message: string }>(`/cards/${cardId}`);
  return data;
}

export interface StatementPeriod {
  bank: string;
  cardLast4: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmountDue: number | null;
  totalSpend: number | null;
  creditLimit: number | null;
}

export async function getStatementPeriods(params?: { from?: string; to?: string }): Promise<{ periods: StatementPeriod[] }> {
  const { data } = await api.get<{ periods: StatementPeriod[] }>('/analytics/statement-periods', { params });
  return data;
}

export async function getSummary(params?: {
  from?: string;
  to?: string;
}): Promise<GetSummaryResponse> {
  const { data } = await api.get<GetSummaryResponse>('/analytics/summary', {
    params,
  });
  return data;
}

export async function getCategories(params?: {
  from?: string;
  to?: string;
}): Promise<GetCategoriesResponse> {
  const { data } = await api.get<GetCategoriesResponse>(
    '/analytics/categories',
    { params }
  );
  return data;
}

export async function getTrends(params?: {
  from?: string;
  to?: string;
}): Promise<GetTrendsResponse> {
  const { data } = await api.get<GetTrendsResponse>('/analytics/trends', {
    params,
  });
  return data;
}

export async function getMerchants(params?: {
  from?: string;
  to?: string;
}): Promise<GetMerchantsResponse> {
  const { data } = await api.get<GetMerchantsResponse>(
    '/analytics/merchants',
    { params }
  );
  return data;
}

export interface ProcessingLog {
  id: string;
  fileName: string;
  status: string;
  message: string | null;
  bank: string | null;
  transactionCount: number;
  createdAt: string | null;
}

export async function getProcessingLogs(): Promise<ProcessingLog[]> {
  const { data } = await api.get<ProcessingLog[]>('/statements/processing-logs', {
    params: { unread_only: true },
  });
  return data;
}

export async function acknowledgeProcessingLog(logId: string): Promise<void> {
  await api.post(`/statements/processing-logs/${logId}/ack`);
}
