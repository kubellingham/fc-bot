import { FormatProvider } from "@/components/format-provider";
import { MobileNav } from "@/components/shell/mobile-nav";
import { QuickActions } from "@/components/shell/quick-actions";
import { SetupRequired } from "@/components/shell/setup-required";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeSync } from "@/components/shell/theme-sync";
import { UserMenu } from "@/components/shell/user-menu";
import { Brand } from "@/components/brand";
import { requireAuth } from "@/lib/data/auth";
import { getPlayers, getSettings, getUnreadAlertCount } from "@/lib/data/queries";
import { getRequestTime } from "@/lib/data/request-time";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const { user } = await requireAuth();
  const [settings, unread, players] = await Promise.all([getSettings(), getUnreadAlertCount(), getPlayers()]);
  const prefs = { locale: settings.numberLocale, compact: settings.compactNumbers, timeZone: settings.timezone };
  const pickerPlayers = players.map(({ id, name, version, rating, position, club }) => ({ id, name, version, rating, position, club }));

  return (
    <FormatProvider prefs={prefs} now={getRequestTime()}>
      <ThemeSync theme={settings.theme} persisted={settings.persisted} />
      <div className="flex min-h-dvh">
        <Sidebar unreadAlerts={settings.alertNotifications ? unread : 0} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
            <Brand href="/dashboard" compact className="lg:hidden" />
            <div className="ml-auto flex items-center gap-2">
              <QuickActions players={pickerPlayers} taxRate={settings.taxRate} />
              <UserMenu email={user.email} displayName={settings.displayName} />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-10">
            {children}
          </main>
        </div>
      </div>
      <MobileNav unreadAlerts={settings.alertNotifications ? unread : 0} />
    </FormatProvider>
  );
}
