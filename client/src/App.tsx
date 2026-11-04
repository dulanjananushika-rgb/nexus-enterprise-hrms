import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavePage } from './pages/LeavePage';
import { PayrollPage } from './pages/PayrollPage';
import { MyPayslipsPage } from './pages/MyPayslipsPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { ExternalLink } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-[10px_3px_10px_3px] -rotate-3 bg-[#0c0c0d] border border-white/20 flex items-center justify-center text-[#ff5a1f] font-black text-2xl shadow-xl shadow-black/80 animate-pulse">
            N
          </div>
          <div className="text-slate-400 font-mono text-xs uppercase tracking-widest animate-pulse">
            Connecting to Nexus HRMS Core...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'employees':
        return <EmployeesPage />;
      case 'attendance':
        return <AttendancePage />;
      case 'leaves':
        return <LeavePage />;
      case 'payroll':
        return <PayrollPage />;
      case 'my-payslips':
        return <MyPayslipsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'audit':
        return <AuditPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f2] text-[#0c0c0d] flex flex-col font-sans selection:bg-[#ff5a1f] selection:text-white">
      {/* Dulanjan Portfolio Showcase Bar */}
      <div className="bg-[#0c0c0d] text-white px-4 py-1.5 text-xs font-mono flex items-center justify-between border-b border-white/10 z-40">
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-[#ff5a1f] shadow-[0_0_0_3px_rgba(255,90,31,0.25)] animate-pulse" />
          <span className="text-slate-300 tracking-wider uppercase text-[10px] hidden sm:inline">
            Dulanjan Anushika Showcase:
          </span>
          <span className="text-white font-semibold text-[11px]">
            Nexus HRMS (Sri Lanka Statutory Suite)
          </span>
        </div>
        <a
          href="https://dulanjan-modern-portfolio.vercel.app/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-1.5 text-[#ff5a1f] hover:text-[#ff7853] transition text-[11px] font-medium"
        >
          <span>Visit Main Portfolio</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <Navbar />
      
      <div className="flex flex-1">
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
