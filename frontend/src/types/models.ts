export enum UserRole {
  ADMIN = "admin",
  MANAGER = "manager",
  SALES_REP = "sales_rep",
  VIEWER = "viewer",
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  teamId: string | null;
  isActive: boolean;
  createdAt: string;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  lastActiveAt?: string | null;
  senderTitle?: string | null;
  senderPhone?: string | null;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 2: ICP Strategy & Companies ---

export enum StrategyStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export enum TravelIntensity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  VERY_HIGH = "very_high",
}

export enum CompanySource {
  MANUAL = "manual",
  DISCOVERY_AGENT = "discovery_agent",
  IMPORT = "import",
}

export interface StrategyFilters {
  industry: string[];
  city: string[];
  maxPerSearch: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  employeeMin: number | null;
  employeeMax: number | null;
  travelIntensity: string[];
  customTags: string[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  filters: StrategyFilters;
  status: StrategyStatus;
  companyCount: number;
  createdBy: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  subIndustry: string | null;
  geography: string | null;
  city: string | null;
  country: string | null;
  employeeCount: number | null;
  revenueRange: string | null;
  travelIntensity: TravelIntensity | null;
  icpScore: number | null;
  scoreBreakdown: Record<string, unknown> | null;
  source: CompanySource;
  linkedinUrl: string | null;
  website: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 3: Contacts & Enrichment ---

export enum PersonaType {
  PROCUREMENT_HEAD = "procurement_head",
  ADMIN = "admin",
  CFO = "cfo",
  TRAVEL_MANAGER = "travel_manager",
  CEO = "ceo",
  HR_HEAD = "hr_head",
  OTHER = "other",
}

export enum EnrichmentStatus {
  PENDING = "pending",
  ENRICHED = "enriched",
  FAILED = "failed",
  VERIFIED = "verified",
}

export interface Contact {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  jobTitle: string | null;
  personaType: PersonaType;
  linkedinUrl: string | null;
  confidenceScore: number | null;
  enrichmentStatus: EnrichmentStatus;
  enrichmentSource: string | null;
  enrichedAt: string | null;
  source: string;
  notes: string | null;
  isPrimary: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
}

export interface PersonaSuggestion {
  firstName: string;
  lastName: string;
  jobTitle: string;
  personaType: PersonaType;
  confidenceScore: number;
  reasoning: string;
}

// --- Phase 4: Campaigns, Sequences & Research ---

export enum CampaignType {
  INTRO = "intro",
  FOLLOW_UP = "follow_up",
  MICE = "mice",
  CORPORATE = "corporate",
  CUSTOM = "custom",
}

export enum CampaignStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

export enum TonePreset {
  FORMAL = "formal",
  FRIENDLY = "friendly",
  CONSULTATIVE = "consultative",
  AGGRESSIVE = "aggressive",
}

export enum StepType {
  EMAIL = "email",
  LINKEDIN_MESSAGE = "linkedin_message",
  MANUAL_TASK = "manual_task",
}

export enum BriefType {
  COMPANY_SUMMARY = "company_summary",
  PROSPECT_SUMMARY = "prospect_summary",
  TALKING_POINTS = "talking_points",
  INDUSTRY_BRIEF = "industry_brief",
}

export interface Campaign {
  id: string;
  strategyId: string | null;
  name: string;
  description: string | null;
  campaignType: CampaignType;
  tonePreset: TonePreset;
  status: CampaignStatus;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  contactCount: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
  strategyName?: string;
}

export interface SequenceStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  stepType: StepType;
  subjectTemplate: string;
  bodyTemplate: string;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface CampaignContact {
  contactId: string;
  contactName: string;
  contactEmail: string;
  companyName: string;
  status: string;
  currentStep: number;
  addedAt: string;
}

export interface ResearchContent {
  summary: string;
  keyFacts: string[];
  talkingPoints: string[];
  painPoints: string[];
  opportunities: string[];
  recentNews: string[];
}

export interface ResearchBrief {
  id: string;
  companyId: string | null;
  contactId: string | null;
  briefType: BriefType;
  content: ResearchContent;
  sources: string[];
  generatedBy: string;
  llmModelUsed: string;
  createdAt: string;
  expiresAt: string | null;
  companyName?: string;
  contactName?: string;
}

// --- Phase 5: Messages & Approval Workflow ---

export enum MessageStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  SENT = "sent",
  FAILED = "failed",
  REPLIED = "replied",
  BOUNCED = "bounced",
}

export interface MessageDraft {
  id: string;
  sequenceStepId: string | null;
  contactId: string;
  campaignId: string;
  subject: string;
  body: string;
  tone: TonePreset;
  variantLabel: string | null;
  contextData: Record<string, unknown> | null;
  status: MessageStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  errorMessage: string | null;
  scheduledFor: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  campaignName?: string;
}

// --- Phase 6: Campaign Execution Monitoring ---

export interface StepCompletion {
  stepNumber: number;
  completed: number;
  pending: number;
  sent: number;
}

export interface CampaignProgress {
  campaignId: string;
  totalContacts: number;
  contactsPerStatus: {
    active: number;
    replied: number;
    stopped: number;
    bounced: number;
    completed: number;
  };
  stepsCompletion: StepCompletion[];
  overallProgressPercent: number;
  messagesSent: number;
  messagesPending: number;
  repliesCount: number;
}

export interface OrchestratorStatus {
  campaignsProcessed: number;
  contactsAdvanced: number;
  messagesGenerated: number;
  messagesSent: number;
  campaignsCompleted: number;
  lastRunAt: string;
}

// --- Phase 7: Dashboard, Analytics & Exports ---

export interface DashboardKPIs {
  totalStrategies: number;
  totalCompanies: number;
  totalContacts: number;
  totalCampaigns: number;
  activeCampaigns: number;
  messagesSent: number;
  messagesPending: number;
  totalReplies: number;
  overallResponseRate: number;
  contactsEnriched: number;
  contactsPendingEnrichment: number;
}

export interface FunnelData {
  strategiesCount: number;
  companiesCount: number;
  contactsCount: number;
  enrichedContacts: number;
  campaignsCount: number;
  messagesSent: number;
  repliesCount: number;
  connectsCount: number;
  conversionRates: {
    strategiesToCompanies: number;
    companiesToContacts: number;
    contactsToEnriched: number;
    enrichedToCampaigns: number;
    campaignsToMessages: number;
    messagesToReplies: number;
    repliesToConnects: number;
  };
}

export interface CampaignPerformanceData {
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  contactsCount: number;
  messagesSent: number;
  replies: number;
  responseRate: number;
  startedAt: string | null;
}

export interface RepPerformanceData {
  userId: string;
  userName: string;
  campaignsCreated: number;
  messagesSent: number;
  repliesReceived: number;
  responseRate: number;
  companiesAdded: number;
  contactsAdded: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendData {
  metricName: string;
  dataPoints: TrendDataPoint[];
  period: "daily" | "weekly" | "monthly";
}

export interface AnalyticsInsight {
  title: string;
  description: string;
  metric: string;
  changePercent?: number;
  trend: "up" | "down" | "flat";
}

export enum ExportType {
  COMPANIES = "companies",
  CONTACTS = "contacts",
  ACTIVITIES = "activities",
  CRM_FULL = "crm_full",
  CAMPAIGN_REPORT = "campaign_report",
}

export interface ExportJob {
  id: string;
  exportType: ExportType;
  status: "pending" | "processing" | "completed" | "failed";
  filters: Record<string, unknown> | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  recordCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
