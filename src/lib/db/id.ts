import { init } from '@paralleldrive/cuid2';

const createId = init({ length: 16 });

export const PREFIXES = {
  user: 'usr',
  session: 'ses',
  account: 'acc',
  verification: 'vfy',
  workspace: 'ws',
  workspaceMember: 'wm',
  apiKey: 'key',
  webhookEndpoint: 'wh',
  webhookEvent: 'evt',
  webhookDelivery: 'whd',
  brand: 'brand',
  promptSet: 'ps',
  prompt: 'prompt',
  platformAdapter: 'adapter',
  modelRun: 'run',
  modelRunResult: 'runres',
  citation: 'cit',
  recommendationShare: 'recshare',
  sentimentAggregate: 'sentagg',
  citationSourceAggregate: 'csrcagg',
  opportunity: 'opp',
  positionAggregate: 'posagg',
  trendSnapshot: 'tsnap',
  alertRule: 'alert',
  alertEvent: 'alertevt',
  notificationPref: 'notifpref',
  notificationLog: 'notiflog',
  digestBatch: 'digestbatch',
  reportJob: 'rpt',
  reportSchedule: 'sched',
  scheduleRecipient: 'schrcpt',
  reportDelivery: 'rptdlv',
  reportTemplate: 'tmpl',
  userPreference: 'upref',
  crawlerUpload: 'crup',
  crawlerVisit: 'crvis',
  crawlerAgg: 'crag',
  trafficSiteKey: 'tsk',
  aiVisit: 'aivis',
  trafficAggregate: 'trag',
  gscConnection: 'gscconn',
  gscQueryPerformance: 'gscqp',
  queryFanoutNode: 'qfn',
  queryFanoutSimulationCache: 'qfsc',
  geoScoreSnapshot: 'geoss',
  seoScoreSnapshot: 'seoss',
} as const;

export function generatePrefixedId(model: keyof typeof PREFIXES): string {
  return `${PREFIXES[model]}_${createId()}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${createId()}`;
}
