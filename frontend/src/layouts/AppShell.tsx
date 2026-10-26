import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  Bell,
  Boxes,
  ClipboardCheck,
  Home,
  Keyboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  ShieldOff,
  Truck,
  Upload,
  Users,
  X
} from 'lucide-react';
import styles from './AppShell.module.css';
import consoleStyles from '../components/ui/console.module.css';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { usePreferencesSync } from '../hooks/usePreferencesSync';
import { NotificationBell } from './NotificationBell';
import { getEnabledNavRoutes, type NavRouteItem } from '../routes/navConfig';
import {
  Button,
  CommandPalette,
  ConfirmDialog,
  DisplayMenu,
  Kbd,
  LiveIndicator,
  OfflineBanner,
  ShortcutsDialog,
  SkipLink
} from '../components/ui';
import { STRINGS } from '../strings/en';
import { SHELL_STRINGS } from '../strings/common';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** "G then X" go-to shortcuts (RESEARCH.md Theme 1); kept to four so they stay learnable. */
const GO_TO: Record<string, string> = { d: '/', b: '/batches', f: '/fefo', i: '/inspections' };
const GO_TO_WINDOW_MS = 1200;

function renderNavIcon(iconName: NavRouteItem['iconName']) {
  switch (iconName) {
    case 'home':
      return <Home size={17} aria-hidden="true" />;
    case 'shield':
      return <Shield size={17} aria-hidden="true" />;
    case 'boxes':
      return <Boxes size={17} aria-hidden="true" />;
    case 'upload':
      return <Upload size={17} aria-hidden="true" />;
    case 'truck':
      return <Truck size={17} aria-hidden="true" />;
    case 'clipboard':
      return <ClipboardCheck size={17} aria-hidden="true" />;
    case 'archive':
      return <Archive size={17} aria-hidden="true" />;
    case 'users':
      return <Users size={17} aria-hidden="true" />;
    case 'settings':
      return <Settings size={17} aria-hidden="true" />;
    case 'bell':
      return <Bell size={17} aria-hidden="true" />;
    case 'message':
      return <MessageSquare size={17} aria-hidden="true" />;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function initialsOf(name: string): string {
  const parts = name.replace(/\[[^\]]*\]/g, '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function AppShell() {
  const { user, logout, logoutAll } = useAuth();
  usePreferencesSync();
  useLiveUpdates();
  const { prefs, setSidebarCollapsed } = useTheme();
  const collapsed = prefs.sidebarCollapsed;
  const toggleSidebar = () => setSidebarCollapsed(!collapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const goPendingAt = useRef<number>(0);

  const navItems = getEnabledNavRoutes(user);
  const operationsItems = navItems.filter((item) => item.group === 'operations');
  const teamItems = navItems.filter((item) => item.group === 'team');

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Global shortcuts: Ctrl/Cmd+K or "/" search, "?" shortcut list, "G then D/B/F/I" go to a page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === '[') {
        e.preventDefault();
        setSidebarCollapsed(!collapsed);
      } else if (e.key.toLowerCase() === 'g') {
        goPendingAt.current = Date.now();
      } else if (goPendingAt.current && Date.now() - goPendingAt.current < GO_TO_WINDOW_MS) {
        const dest = GO_TO[e.key.toLowerCase()];
        goPendingAt.current = 0;
        if (dest && navItems.some((n) => n.path === dest)) {
          e.preventDefault();
          navigate(dest);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, navItems, collapsed, setSidebarCollapsed]);

  // Focus trap and Escape handling for mobile navigation drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const panel = drawerRef.current;
    if (panel) {
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawerOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  const roleLabel = user?.role ? (STRINGS.roles[user.role] ?? user.role) : '';

  /** compact: the collapsed desktop sidebar fades the labels out (CSS) and shows them as tooltips instead. */
  const renderNavGroup = (label: string, items: NavRouteItem[], compact: boolean) =>
    items.length === 0 ? null : (
      <div className={styles.navGroup}>
        <div className={`${styles.navGroupLabel} ${styles.fadeLabel}`}>{label}</div>
        <ul className={styles.navList}>
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/' || item.path === '/batches'}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                title={compact ? item.label : undefined}
              >
                {renderNavIcon(item.iconName)}
                <span className={styles.fadeLabel}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    );

  const renderNavigationLinks = (compact = false) => (
    <>
      {renderNavGroup(SHELL_STRINGS.navGroups.operations, operationsItems, compact)}
      {renderNavGroup(SHELL_STRINGS.navGroups.team, teamItems, compact)}
    </>
  );

  const renderUserSection = (scope: 'desktop' | 'mobile' = 'desktop') => {
    const compact = scope === 'desktop' && collapsed;
    return (
    <div className={styles.sidebarFooter}>
      {user ? (
        <div className={styles.userCard} data-testid={scope === 'desktop' ? 'shell-user-card' : 'mobile-shell-user-card'}>
          <span className={styles.userAvatar} aria-hidden="true" title={compact ? `${user.name}, ${roleLabel}` : undefined}>
            {initialsOf(user.name ?? '')}
          </span>
          <div className={`${styles.userText} ${styles.fadeLabel}`}>
            <div className={styles.userName} data-testid={scope === 'desktop' ? 'shell-user-name' : 'mobile-shell-user-name'}>
              {user.name}
            </div>
            <div className={styles.userMeta} data-testid={scope === 'desktop' ? 'shell-user-role' : 'mobile-shell-user-role'}>
              {roleLabel}
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.userActions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          title={compact ? STRINGS.common.signOut : undefined}
          leftIcon={<LogOut size={15} />}
          data-testid={scope === 'desktop' ? 'sign-out-btn' : 'mobile-sign-out-btn'}
        >
          <span className={styles.fadeLabel}>{STRINGS.common.signOut}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmLogoutAllOpen(true)}
          title={compact ? STRINGS.common.signOutAll : undefined}
          leftIcon={<ShieldOff size={15} />}
          data-testid={scope === 'desktop' ? 'sign-out-all-btn' : 'mobile-sign-out-all-btn'}
        >
          <span className={styles.fadeLabel}>{STRINGS.common.signOutAll}</span>
        </Button>
      </div>
      <nav aria-label={SHELL_STRINGS.legalNavLabel} className={`${styles.legalLinks} ${styles.fadeLabel}`}>
        <NavLink to="/privacy">{SHELL_STRINGS.privacy}</NavLink>
        <NavLink to="/terms">{SHELL_STRINGS.terms}</NavLink>
      </nav>
    </div>
    );
  };

  return (
    <div className={styles.shellRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <div className={styles.shellBody}>
        <aside
          className={`${styles.desktopSidebar} ${collapsed ? styles.desktopSidebarCollapsed : ''}`}
          aria-label="Sidebar"
          data-testid="desktop-sidebar"
          data-collapsed={collapsed}
        >
          <div className={styles.sidebarScroll}>
            <div className={styles.brandBlock}>
              <span className={`${styles.brandName} ${styles.fadeLabel}`}>{STRINGS.app.name}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                className={styles.collapseBtn}
                aria-label={collapsed ? SHELL_STRINGS.expandSidebar : SHELL_STRINGS.collapseSidebar}
                aria-expanded={!collapsed}
                title={`${collapsed ? SHELL_STRINGS.expandSidebar : SHELL_STRINGS.collapseSidebar} ([)`}
                onClick={toggleSidebar}
                leftIcon={collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                data-testid="sidebar-collapse-btn"
              />
            </div>
            <nav aria-label={STRINGS.nav.sidebarLabel}>{renderNavigationLinks(collapsed)}</nav>
          </div>
          {renderUserSection('desktop')}
        </aside>

        <div className={styles.mainColumn}>
          <header className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <Button
                ref={menuBtnRef}
                variant="secondary"
                size="sm"
                iconOnly
                className={styles.mobileMenuBtn}
                aria-label={STRINGS.nav.openMenu}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
                leftIcon={<Menu size={18} />}
                data-testid="mobile-menu-btn"
              />
              <span className={styles.mobileBrand}>{STRINGS.app.name}</span>
              <button
                type="button"
                className={consoleStyles.searchTrigger}
                onClick={() => setPaletteOpen(true)}
                aria-label={SHELL_STRINGS.searchHint}
                aria-haspopup="dialog"
                data-testid="command-palette-trigger"
              >
                <Search size={16} aria-hidden="true" />
                <span className={consoleStyles.searchTriggerLabel}>{SHELL_STRINGS.search}</span>
                <Kbd keys={['Ctrl', 'K']} />
              </button>
            </div>
            <div className={styles.topBarRight}>
              <LiveIndicator />
              <NotificationBell />
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                className={styles.desktopOnly}
                aria-label={SHELL_STRINGS.shortcutsOpen}
                onClick={() => setShortcutsOpen(true)}
                leftIcon={<Keyboard size={16} />}
                data-testid="shortcuts-btn"
              />
              <DisplayMenu />
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className={styles.mainContent}>
            <Outlet />
          </main>
        </div>
      </div>

      {drawerOpen ? (
        <div
          role="presentation"
          className={styles.drawerBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDrawerOpen(false);
            }
          }}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={STRINGS.nav.mobileDrawerTitle}
            className={styles.drawerPanel}
            data-testid="mobile-drawer"
          >
            <div>
              <div className={styles.drawerHeader}>
                <span className={styles.brandName}>{STRINGS.app.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={STRINGS.nav.closeMenu}
                  onClick={() => {
                    setDrawerOpen(false);
                    menuBtnRef.current?.focus();
                  }}
                  leftIcon={<X size={16} />}
                />
              </div>
              <nav aria-label={STRINGS.nav.mobileDrawerTitle}>{renderNavigationLinks()}</nav>
            </div>
            {renderUserSection('mobile')}
          </div>
        </div>
      ) : null}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        onClose={() => setConfirmLogoutAllOpen(false)}
        title={SHELL_STRINGS.signOutAllTitle}
        description={SHELL_STRINGS.signOutAllBody}
        confirmLabel={STRINGS.common.signOutAll}
        variant="danger"
        isLoading={isRevokingAll}
        onConfirm={async () => {
          setIsRevokingAll(true);
          try {
            await logoutAll();
          } finally {
            setIsRevokingAll(false);
            setConfirmLogoutAllOpen(false);
          }
        }}
      />
    </div>
  );
}
