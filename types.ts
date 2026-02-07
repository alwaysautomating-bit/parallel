
export enum ClassificationType {
  CHILD_LOGISTICS = 'CHILD_LOGISTICS',
  MIXED = 'MIXED',
  PERSONAL_BAIT = 'PERSONAL_BAIT',
  UNKNOWN = 'UNKNOWN'
}

export enum RecommendedAction {
  RESPOND = 'RESPOND',
  NO_RESPONSE = 'NO_RESPONSE',
  WAIT_24_HOURS = 'WAIT_24_HOURS'
}

export enum ResponseMode {
  LOGISTICS_ONLY = 'Logistics Only',
  SCHEDULE_ONLY = 'Schedule Only',
  COURT_SAFE = 'Court Safe',
  PARALLEL_PARENTING = 'Parallel Parenting'
}

export type InputMode = 'RESPOND' | 'TONE_CHECK';

export interface AnalysisResponse {
  classification: ClassificationType;
  manipulationTags: string[];
  reasoning: string;
  recommendedAction: RecommendedAction;
  draftResponse: string | null;
}

export interface SafetyCheckResponse {
  isSafe: boolean;
  emotionalWords: string[];
  neutralSuggestion: string;
}

export interface LogEntry {
  id: string;
  date: string;
  requestor: 'Me' | 'Co-Parent' | 'Other';
  reason: string;
  notes: string;
  timestamp: number;
}

export interface UserProfile {
  name: string;
  coParentName: string;
  childrenNames: string;
  email: string;
  decreeContext: string;
  parentingPlanContext: string;
  logs: LogEntry[];
}

export interface AppState {
  view: 'APP' | 'PROFILE' | 'PARENTING_PLAN' | 'CHANGE_LOG' | 'ABOUT' | 'MODE_GUIDE';
  step: 'INPUT' | 'ANALYZING' | 'RESULT';
  inputMode: InputMode;
  incomingMessage: string;
  selectedMode: ResponseMode;
  analysis: AnalysisResponse | null;
  currentDraft: string;
  error: string | null;
  userProfile: UserProfile;
}
