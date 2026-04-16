'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

import { isCommercial } from '@/lib/edition';
import { ErrorBoundary } from '@/components/error-boundary';

import { ReportGenerateForm } from './report-generate-form';
import { ReportJobCard } from './report-job-card';
import { ReportDownloadsTab } from './report-downloads-tab';
import { ReportSchedulesTab } from './report-schedules-tab';
import { ReportTemplatesTab } from './report-templates-tab';

const BASE_TABS = ['generate', 'downloads', 'schedules'] as const;
type ReportTab = (typeof BASE_TABS)[number] | 'templates';

const tabParsers = {
  tab: parseAsString,
};

export function ReportsView() {
  return (
    <ErrorBoundary>
      <ReportsContent />
    </ErrorBoundary>
  );
}

function ReportsContent() {
  const t = useTranslations('reports');
  const [params, setParams] = useQueryStates(tabParsers, { shallow: false });

  // Active job IDs for the generate tab (ephemeral, not URL-persisted)
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);

  const showTemplates = isCommercial();
  const tabs: ReportTab[] = useMemo(
    () => (showTemplates ? [...BASE_TABS, 'templates'] : [...BASE_TABS]),
    [showTemplates]
  );

  const activeTab: ReportTab = tabs.includes(params.tab as ReportTab)
    ? (params.tab as ReportTab)
    : 'generate';

  function handleTabChange(tab: ReportTab) {
    setParams({ tab: tab === 'generate' ? null : tab });
  }

  const handleJobCreated = useCallback((jobId: string) => {
    setActiveJobIds((prev) => [...prev, jobId]);
  }, []);

  const handleJobDismiss = useCallback((jobId: string) => {
    setActiveJobIds((prev) => prev.filter((id) => id !== jobId));
  }, []);

  const handleNavigateToGenerate = useCallback(() => {
    setParams({ tab: null });
  }, [setParams]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="type-page">{t('page.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b" role="tablist">
        {tabs.map((tab) => (
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
      {activeTab === 'generate' && (
        <div className="space-y-4">
          {/* Active job cards */}
          {activeJobIds.map((jobId) => (
            <ReportJobCard key={jobId} jobId={jobId} onDismiss={() => handleJobDismiss(jobId)} />
          ))}

          {/* Generate form */}
          <ReportGenerateForm onJobCreated={handleJobCreated} />
        </div>
      )}
      {activeTab === 'downloads' && (
        <ReportDownloadsTab onNavigateToGenerate={handleNavigateToGenerate} />
      )}
      {activeTab === 'schedules' && <ReportSchedulesTab />}
      {activeTab === 'templates' && showTemplates && <ReportTemplatesTab />}
    </div>
  );
}
