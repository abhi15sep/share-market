import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConnectionStatusBadge from '../common/ConnectionStatus';
import type { ConnectionStatus } from '../../hooks/useRealtimePrices';

/* ─── NAV STRUCTURE ─── */
interface NavItem {
  path: string;
  label: string;
  desc?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const primaryNav: NavItem[] = [
  { path: '/', label: 'Overview' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/screener', label: 'Screener' },
  { path: '/watchlist', label: 'Watchlist' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/copilot', label: 'Copilot' },
];

const navGroups: NavGroup[] = [
  {
    label: 'Analysis',
    items: [
      { path: '/heatmap', label: 'Heat Map', desc: 'Market treemap by sector' },
      { path: '/sectors', label: 'Sectors', desc: 'Sector performance breakdown' },
      { path: '/compare', label: 'Compare', desc: 'Side-by-side stock comparison' },
      { path: '/backtest', label: 'Backtest', desc: 'Test stock-picking strategies' },
      { path: '/sector-rotation', label: 'Rotation', desc: 'Sector rotation momentum model' },
      { path: '/chart-replay', label: 'Replay', desc: 'Practice trading on historical data' },
    ],
  },
  {
    label: 'Screens',
    items: [
      { path: '/minervini', label: 'Minervini', desc: 'SEPA trend template screen' },
      { path: '/canslim', label: 'CAN SLIM', desc: "O'Neil's 7-point growth screen" },
      { path: '/custom-screen', label: 'Custom Screen', desc: 'Build your own screening rules' },
      { path: '/earnings', label: 'Earnings', desc: 'Upcoming earnings calendar' },
      { path: '/query', label: 'NL Query', desc: 'Search stocks in plain English' },
      { path: '/weighted-screener', label: 'Weighted', desc: 'Custom-weight stock ranking' },
      { path: '/economic-calendar', label: 'Econ Calendar', desc: 'FOMC, CPI, NFP, GDP dates' },
      { path: '/indicator-builder', label: 'AI Builder', desc: 'Build screens with AI' },
    ],
  },
  {
    label: 'Signals',
    items: [
      { path: '/online-picks', label: 'Online Picks', desc: 'Analyst, broker & community stock picks' },
      { path: '/fallen', label: 'Fallen Stocks', desc: 'Stocks down today — dips, oversold & dividend bargains' },
      { path: '/bearish', label: 'Bearish', desc: 'Stocks with warning signals' },
      { path: '/dip', label: 'Buy the Dip', desc: 'Oversold bounce candidates' },
      { path: '/breakout', label: 'Breakouts', desc: 'Squeeze & volume breakouts' },
      { path: '/support-bounce', label: 'Support Bounce', desc: 'Pullback to support buy setups' },
      { path: '/yearly-uptrend', label: 'Yearly Uptrend', desc: 'Multi-year uptrend below resistance' },
      { path: '/most-owned', label: 'Most Owned', desc: 'Top institutional holdings on discount' },
    ],
  },
  {
    label: 'More',
    items: [
      { path: '/news', label: 'News', desc: 'Headlines with sentiment scores' },
      { path: '/alerts', label: 'Alerts', desc: 'Configure Telegram price alerts' },
      { path: '/guide', label: 'Guide', desc: 'Learn stock analysis basics' },
    ],
  },
];

const allNavItems = [
  ...primaryNav,
  ...navGroups.flatMap(g => g.items),
];

interface HeaderProps {
  lastUpdated?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  connectionStatus?: ConnectionStatus;
}

export default function Header({ lastUpdated, theme, onToggleTheme, connectionStatus }: HeaderProps) {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  const isGroupActive = (group: NavGroup) =>
    group.items.some(item => isActive(item.path));

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-bullish flex items-center justify-center text-white text-sm font-bold">
              SM
            </div>
            <span className="text-base font-bold t-primary group-hover:text-accent-light transition-colors hidden sm:block">
              StockMarket
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 mx-4">
            {/* Primary links */}
            {primaryNav.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-accent/15 text-accent-light'
                    : 't-tertiary hover:t-primary hover:bg-surface-hover'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="w-px h-5 bg-surface-border mx-1" />

            {/* Grouped dropdowns */}
            {navGroups.map(group => (
              <NavDropdown
                key={group.label}
                group={group}
                pathname={pathname}
                isGroupActive={isGroupActive(group)}
              />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {connectionStatus && (
              <div className="hidden md:block mr-1">
                <ConnectionStatusBadge status={connectionStatus} />
              </div>
            )}
            {lastUpdated && (
              <div className="hidden md:flex items-center gap-2 text-xs t-muted mr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" />
                {new Date(lastUpdated).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            )}

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-tertiary border border-surface-border hover:border-accent/30 transition-all"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg className="w-3.5 h-3.5 t-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 t-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center bg-surface-tertiary border border-surface-border"
            >
              <svg className="w-4 h-4 t-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <MobileMenu
          pathname={pathname}
          isActive={isActive}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </header>
  );
}

/* ─── DROPDOWN COMPONENT ─── */
function NavDropdown({ group, pathname, isGroupActive }: {
  group: NavGroup;
  pathname: string;
  isGroupActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isGroupActive
            ? 'bg-accent/15 text-accent-light'
            : 't-tertiary hover:t-primary hover:bg-surface-hover'
        }`}
      >
        {group.label}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 py-1.5 bg-surface-secondary border border-surface-border rounded-xl shadow-xl z-50">
          {group.items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2.5 transition-colors ${
                isActive(item.path)
                  ? 'bg-accent/10 text-accent-light'
                  : 't-secondary hover:bg-surface-hover hover:t-primary'
              }`}
            >
              <span className="text-sm font-medium">{item.label}</span>
              {item.desc && (
                <span className="block text-xs t-muted mt-0.5">{item.desc}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── MOBILE MENU ─── */
function MobileMenu({ pathname, isActive, onClose }: {
  pathname: string;
  isActive: (path: string) => boolean;
  onClose: () => void;
}) {
  return (
    <div className="lg:hidden border-t border-surface-border bg-surface-secondary/95 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 py-3 space-y-3">
        {/* Primary */}
        <div className="flex flex-wrap gap-1.5">
          {primaryNav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-accent/15 text-accent-light'
                  : 't-tertiary hover:t-primary hover:bg-surface-hover'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Groups */}
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-1.5">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? 'bg-accent/15 text-accent-light'
                      : 't-tertiary hover:t-primary hover:bg-surface-hover'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
