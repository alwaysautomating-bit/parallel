import { UserProfile, LogEntry } from '../types';

const STORAGE_KEY = 'parallel_user_data';

export interface StorageService {
  loadProfile(): UserProfile;
  saveProfile(profile: UserProfile): void;
  addLogEntry(entry: LogEntry): void;
  deleteLogEntry(id: string): void;
  getLogEntries(): LogEntry[];
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  coParentName: '',
  childrenNames: '',
  email: '',
  decreeContext: '',
  parentingPlanContext: '',
  logs: [],
};

function loadFromStorage(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveToStorage(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export const storageService: StorageService = {
  loadProfile: loadFromStorage,

  saveProfile: saveToStorage,

  addLogEntry(entry: LogEntry) {
    const profile = loadFromStorage();
    profile.logs = [entry, ...profile.logs];
    saveToStorage(profile);
  },

  deleteLogEntry(id: string) {
    const profile = loadFromStorage();
    profile.logs = profile.logs.filter(l => l.id !== id);
    saveToStorage(profile);
  },

  getLogEntries() {
    return loadFromStorage().logs;
  },
};
