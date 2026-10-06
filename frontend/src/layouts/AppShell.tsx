import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Archive,
  Boxes,
  ClipboardCheck,
  Home,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldOff,
  Truck,
  Upload,
  Users,
  X
} from 'lucide-react';
import styles from './AppShell.module.css';
import { useAuth } from '../auth/AuthContext';
import { getEnabledNavRoutes, type NavRouteItem } from '../routes/navConfig';
import {
  Button,
  ConfirmDialog,
  OfflineBanner,
  PageImagesToggle,
  SkipLink,
  StatusBadge,
  ThemeToggle
} from '../components/ui';
import { STRINGS } from '../strings/en';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  }
}

export function AppShell() {
  const { user, logout, logoutAll } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  const navItems = getEnabledNavRoutes(user);

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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

  const renderNavigationLinks = () => (
    <ul className={styles.navList}>
      {navItems.map((item) => (
        <li key={item.path}>
          <NavLink
            to={item.path}
            end={item.path === '/' || item.path === '/batches'}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            {renderNavIcon(item.iconName)}
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const renderUserSection = (scope: 'desktop' | 'mobile' = 'desktop') => (
    <div className={styles.sidebarFooter}>
      {user ? (
        <div className={styles.userCard} data-testid={scope === 'desktop' ? 'shell-user-card' : 'mobile-shell-user-card'}>
          <div className={styles.userName} data-testid={scope === 'desktop' ? 'shell-user-name' : 'mobile-shell-user-name'}>
            {user.name}
          </div>
          <div className={styles.userMeta} data-testid={scope === 'desktop' ? 'shell-user-role' : 'mobile-shell-user-role'}>
            {roleLabel}
          </div>
          <div>
            <StatusBadge status={user.active === false ? 'inactive' : 'active'} />
          </div>
        </div>
      ) : null}
      <div className={styles.userActions}>
        <PageImagesToggle
          fullWidth
          testId={scope === 'desktop' ? 'user-menu-page-images-toggle' : 'mobile-user-menu-page-images-toggle'}
        />
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={logout}
          leftIcon={<LogOut size={15} />}
          data-testid={scope === 'desktop' ? 'sign-out-btn' : 'mobile-sign-out-btn'}
        >
          {STRINGS.common.signOut}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => setConfirmLogoutAllOpen(true)}
          leftIcon={<ShieldOff size={15} />}
          data-testid={scope === 'desktop' ? 'sign-out-all-btn' : 'mobile-sign-out-all-btn'}
        >
          {STRINGS.common.signOutAll}
        </Button>
      </div>
    </div>
  );

  return (
    <div className={styles.shellRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <div className={styles.shellBody}>
        <aside className={styles.desktopSidebar} aria-label="Sidebar" data-testid="desktop-sidebar">
          <div>
            <div className={styles.brandBlock}>
              <span className={styles.brandName}>{STRINGS.app.name}</span>
              <span className={styles.brandTagline}>{STRINGS.app.tagline}</span>
            </div>
            <nav aria-label={STRINGS.nav.sidebarLabel}>{renderNavigationLinks()}</nav>
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
            </div>
            <ThemeToggle />
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

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        onClose={() => setConfirmLogoutAllOpen(false)}
        title={STRINGS.common.signOutAll}
        description="This will immediately revoke your active sessions across all browsers and devices."
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
