// Types
export type {
  UserPreference,
  UserPreferenceUpdate,
  UserProfile,
  UserProfileUpdate,
  WorkspaceDetails,
  WorkspaceUpdate,
  WorkspaceMember,
  WorkspaceRole,
  AddMemberInput,
  UpdateMemberRoleInput,
} from './settings.types';

export { WORKSPACE_ROLES, ASSIGNABLE_ROLES, SUPPORTED_LOCALES } from './settings.types';

// API
export {
  fetchUserPreferences,
  updateUserPreferences,
  fetchWorkspace,
  updateWorkspace,
  fetchMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from './settings.api';

// Validation
export {
  profileUpdateSchema,
  localePreferenceSchema,
  workspaceUpdateSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from './settings.validation';

export type {
  ProfileFormValues,
  LocalePreferenceFormValues,
  WorkspaceFormValues,
  AddMemberFormValues,
  UpdateMemberRoleFormValues,
} from './settings.validation';

// Hooks
export { useUserPreferencesQuery, useWorkspaceQuery, useMembersQuery } from './use-settings-query';

// Integration Types
export type {
  PlatformInfo,
  CredentialField,
  ConfigField,
  AdapterConfig,
  AdapterCreate,
  AdapterUpdate,
  AdapterHealthResult,
  ApiKeyScope,
  ApiKeyInfo,
  ApiKeyCreate,
  ApiKeyGenerated,
  WebhookEndpoint,
  WebhookCreate,
  WebhookUpdate,
  WebhookDelivery,
  WebhookSecretRotation,
} from './integrations.types';

export {
  API_KEY_SCOPES,
  SERP_ADAPTER_PLATFORMS,
  WEBHOOK_EVENT_CATEGORIES,
} from './integrations.types';

// Integration API
export {
  fetchPlatforms,
  fetchAdapters,
  fetchAdapter,
  createAdapter,
  updateAdapter,
  deleteAdapter,
  checkAdapterHealth,
  fetchApiKeys,
  generateApiKey,
  revokeApiKey,
  fetchWebhooks,
  fetchWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  rotateWebhookSecret,
  fetchWebhookDeliveries,
} from './integrations.api';

// Integration Validation
export {
  adapterCreateSchema,
  adapterUpdateSchema,
  apiKeyCreateSchema,
  webhookCreateSchema,
  webhookUpdateSchema,
  buildCredentialSchema,
  buildConfigSchema,
} from './integrations.validation';

export type {
  AdapterCreateFormValues,
  AdapterUpdateFormValues,
  ApiKeyCreateFormValues,
  WebhookCreateFormValues,
  WebhookUpdateFormValues,
} from './integrations.validation';

// Integration Hooks
export {
  usePlatformsQuery,
  useAdaptersQuery,
  useAdapterQuery,
  useApiKeysQuery,
  useWebhooksQuery,
  useWebhookDeliveriesQuery,
} from './use-integrations-query';

// Components
export { SettingsLayout } from './components/settings-layout';
export { ProfileView } from './components/profile-view';
export { WorkspaceSettingsView } from './components/workspace-settings-view';
export { MembersView } from './components/members-view';
export { AdaptersView } from './components/adapters/adapters-view';
export { ApiKeysView } from './components/api-keys/api-keys-view';
export { WebhooksView } from './components/webhooks/webhooks-view';
