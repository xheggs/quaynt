'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

import { ErrorBoundary } from '@/components/error-boundary';

import { AlertRulesTab } from './alert-rules-tab';
import { AlertEventsTab } from './alert-events-tab';
import { NotificationPreferencesTab } from './notification-preferences-tab';

const TABS = ['rules', 'events', 'notifications'] as const;
type AlertTab = (typeof TABS)[number];

const tabParsers = {
  tab: parseAsString,
};

export function AlertsView() {
  return (
    <ErrorBoundary>
      <AlertsContent />
    </ErrorBoundary>
  );
}

function AlertsContent() {
  const t = useTranslations('alerts');
  const [params, setParams] = useQueryStates(tabParsers, { shallow: false });

  const activeTab: AlertTab = TABS.includes(params.tab as AlertTab)
    ? (params.tab as AlertTab)
    : 'rules';

  function handleTabChange(tab: AlertTab) {
    setParams({ tab: tab === 'rules' ? null : tab });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <h1 className="type-page">{t('page.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabChange(tab)}
          >
            {t(`tabs.${tab}` as never)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'rules' && <AlertRulesTab />}
      {activeTab === 'events' && <AlertEventsTab />}
      {activeTab === 'notifications' && <NotificationPreferencesTab />}
    </div>
  );
}
