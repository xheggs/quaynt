// Types
export type {
  OpportunityResult,
  Opportunity,
  OpportunityFilters,
  OpportunitySummary,
  OpportunityType,
} from './opportunity.types';

// API functions
export { fetchOpportunities } from './opportunity.api';

// Hooks
export { useOpportunityQuery } from './use-opportunity-query';

// View
export { OpportunityView } from './components/opportunity-view';
