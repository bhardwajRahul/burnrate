import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from '@/components/Toast';
import { SetupWizard } from '@/pages/SetupWizard';
import { Dashboard } from '@/pages/Dashboard';
import { Cards } from '@/pages/Cards';
import { Transactions } from '@/pages/Transactions';
import { Analytics } from '@/pages/Analytics';
import { FilterProvider } from '@/contexts/FilterContext';
import { useSettings, useProcessingLogPoller } from '@/hooks/useApi';

function RootRedirect() {
  const { settings, loading } = useSettings();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0D0D0D',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        Loading...
      </div>
    );
  }

  if (settings?.configured) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/setup" replace />;
}

function ProcessingLogWatcher() {
  const handleLog = useCallback(
    (log: { status: string; fileName: string; message: string | null; transactionCount: number }) => {
      if (log.status === 'success') {
        toast.success(
          `Imported ${log.transactionCount} transactions from ${log.fileName}`,
        );
      } else if (log.status === 'duplicate') {
        toast.info(`${log.fileName} was already imported`);
      } else {
        toast.error(
          `Failed to process ${log.fileName}: ${log.message || 'Unknown error'}`,
        );
      }
    },
    [],
  );

  useProcessingLogPoller(handleLog, 60_000);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
      <ToastContainer />
      <ProcessingLogWatcher />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
      </FilterProvider>
    </BrowserRouter>
  );
}
