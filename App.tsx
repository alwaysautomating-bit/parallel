import React, { useState, useEffect } from 'react';
import { 
  AppState, 
  ResponseMode, 
  ClassificationType, 
  RecommendedAction,
  SafetyCheckResponse,
  LogEntry,
  InputMode
} from './types';
import { analyzeMessage, checkDraftSafety } from './services/geminiService';
import { storageService } from './services/storageService';
import {
  Button,
  Card,
  Badge,
  Tag,
  ShieldCheckIcon,
  AlertIcon,
  CopyIcon,
  CheckCircleIcon,
  UserIcon,
  HomeIcon,
  InfoIcon,
  CalendarIcon,
  SettingsIcon,
  Spinner,
  MenuIcon,
  XMarkIcon,
  Modal,
  Toast,
  RefreshIcon,
  WarningTriangleIcon,
  ParallelLogoIcon,
  LaunchScreen,
  ChevronLeftIcon,
  TrashIcon
} from './components/UIComponents';

const HOOK_DEFINITIONS: Record<string, string> = {
  'Guilt Bait': 'Attempts to make you feel responsible for their emotional state or life circumstances. The goal is to induce an emotional reaction or force compliance through shame.',
  'Character Attack': 'Direct insults or subtle slights directed at your personality, parenting, or integrity. These are meant to provoke a defensive response, pulling you into an argument.',
  'Topic Drift': 'Bringing up past relationship issues or unrelated grievances during a logistical discussion. This distracts from the child-related matter and keeps you engaged in conflict.',
  'Blame Shift': 'Avoiding accountability by portraying you as the sole cause of conflict or logistical failures. It forces you into a defensive "JADE" posture (Justify, Argue, Defend, Explain).',
  'Urgency': 'Creating an artificial sense of crisis ("I need an answer NOW") to bypass your boundaries and force an emotional decision without proper thought.',
  'Pressure': 'Using repetitive messaging or threats of consequences to wear down your boundaries and force a specific outcome.',
  'Manipulation': 'Subtle psychological tactics designed to gain control or influence over your behavior or emotions, often using the children as leverage.',
  'Passive Aggression': 'Indirect expressions of hostility through sarcasm, backhanded compliments, or deliberate failure to follow agreed-upon logistics.',
  'Gaslighting': 'Denying facts or past events to make you question your memory or reality, undermining your confidence in your own boundaries.'
};

const MODE_DESCRIPTIONS = [
  {
    title: ResponseMode.LOGISTICS_ONLY,
    desc: 'Strips away all emotional fluff. Focuses strictly on the "what, where, and when" of child-related needs. Best for general daily communication.'
  },
  {
    title: ResponseMode.SCHEDULE_ONLY,
    desc: 'Extremely restrictive. Limits the response to dates, times, and locations only. Use this when the other parent is attempting to engage in heavy baiting.'
  },
  {
    title: ResponseMode.COURT_SAFE,
    desc: 'Formal and professional. Uses complete sentences and professional tone designed to be read by a judge or attorney. Higher transparency, zero reactive language.'
  },
  {
    title: ResponseMode.PARALLEL_PARENTING,
    desc: 'Minimal contact. Strictly adheres to and references the Parenting Plan or Decree. Avoids negotiation and relies on established court orders.'
  }
];

const App: React.FC = () => {
  const [isLaunching, setIsLaunching] = useState(true);
  const [launchExiting, setLaunchExiting] = useState(false);
  const [state, setState] = useState<AppState>({
    view: 'APP',
    step: 'INPUT',
    inputMode: 'RESPOND',
    incomingMessage: '',
    selectedMode: ResponseMode.LOGISTICS_ONLY,
    analysis: null,
    currentDraft: '',
    error: null,
    userProfile: {
      name: '',
      coParentName: '',
      childrenNames: '',
      email: '',
      decreeContext: '',
      parentingPlanContext: '',
      logs: []
    }
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckResponse | null>(null);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [isModeGuideOpen, setIsModeGuideOpen] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Log form state
  const [newLog, setNewLog] = useState<Partial<LogEntry>>({
    date: new Date().toISOString().split('T')[0],
    requestor: 'Co-Parent',
    reason: '',
    notes: ''
  });

  // Launch screen — hold, then fade out
  useEffect(() => {
    const fadeTimer = setTimeout(() => setLaunchExiting(true), 1800);
    const removeTimer = setTimeout(() => setIsLaunching(false), 2400);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, []);

  // Load saved profile on mount
  useEffect(() => {
    const saved = storageService.loadProfile();
    updateUserProfile(saved);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setIsMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isMenuOpen]);

  // Helper to update state partially
  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateUserProfile = (updates: Partial<typeof state.userProfile>) => {
    setState(prev => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...updates }
    }));
  };

  const handleAnalyze = async () => {
    if (!state.incomingMessage.trim()) return;
    
    setIsLoading(true);
    updateState({ error: null, analysis: null });
    setSafetyCheck(null);

    try {
      if (state.inputMode === 'RESPOND') {
        const result = await analyzeMessage(
          state.incomingMessage, 
          state.selectedMode,
          state.userProfile.decreeContext,
          state.userProfile.parentingPlanContext
        );
        
        updateState({
          step: 'RESULT',
          analysis: result,
          currentDraft: result.draftResponse || '',
        });
      } else {
        const result = await checkDraftSafety(state.incomingMessage);
        setSafetyCheck(result);
        updateState({
          step: 'RESULT',
          currentDraft: state.incomingMessage,
        });
      }
    } catch (err) {
      updateState({ error: err instanceof Error ? err.message : "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(state.currentDraft);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const applyNeutralRewrite = () => {
    if (safetyCheck?.neutralSuggestion) {
      updateState({ currentDraft: safetyCheck.neutralSuggestion });
    }
  };

  const reset = () => {
    updateState({
      step: 'INPUT',
      incomingMessage: '', 
      analysis: null,
      currentDraft: '',
      error: null
    });
    setSafetyCheck(null);
  };

  const handleSaveProfile = () => {
    storageService.saveProfile(state.userProfile);
    setToast({ message: 'Profile saved', type: 'success' });
  };

  const handleSaveContext = () => {
    storageService.saveProfile(state.userProfile);
    setToast({ message: 'Parenting plan saved', type: 'success' });
  };

  const handleAddLogEntry = () => {
    if (!newLog.reason?.trim() || !newLog.date) return;

    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: newLog.date,
      requestor: (newLog.requestor as LogEntry['requestor']) || 'Co-Parent',
      reason: newLog.reason.trim(),
      notes: newLog.notes?.trim() || '',
      timestamp: Date.now(),
    };

    updateUserProfile({ logs: [entry, ...state.userProfile.logs] });
    storageService.addLogEntry(entry);

    setNewLog({
      date: new Date().toISOString().split('T')[0],
      requestor: 'Co-Parent',
      reason: '',
      notes: '',
    });

    setToast({ message: 'Schedule change logged', type: 'success' });
  };

  const handleDeleteLogEntry = (id: string) => {
    updateUserProfile({ logs: state.userProfile.logs.filter(l => l.id !== id) });
    storageService.deleteLogEntry(id);
  };

  // --- View title mapping ---

  const VIEW_TITLES: Record<string, string> = {
    'APP': 'Parallel',
    'PROFILE': 'Profile',
    'PARENTING_PLAN': 'Parenting Plan',
    'CHANGE_LOG': 'Schedule Change Log',
    'ABOUT': 'How It Works',
    'MODE_GUIDE': 'Mode Guide',
  };

  // --- Views ---

  const renderHeader = () => {
    const isSubView = state.view !== 'APP';

    return (
      <header className="mb-10 flex flex-col items-center relative z-50 animate-in fade-in slide-in-from-top-4 duration-500">
        {isSubView ? (
          <div className="flex items-center justify-between w-full mb-4">
            <button
              onClick={() => updateState({ view: 'APP' })}
              className="flex items-center gap-1.5 text-sm font-medium text-grey-500 hover:text-navy-900 transition-colors p-2 -ml-2 rounded-lg hover:bg-grey-50"
            >
              <ChevronLeftIcon /> Back
            </button>
            <h2 className="text-lg font-semibold text-navy-900">{VIEW_TITLES[state.view]}</h2>
            <button
              data-menu
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className="bg-navy-900 text-white p-2.5 rounded-xl shadow-[0_4px_12px_rgba(0,45,114,0.2)] hover:bg-navy-800 transition-transform active:scale-95"
            >
              {isMenuOpen ? <XMarkIcon /> : <MenuIcon />}
            </button>
          </div>
        ) : (
          <>
            <button
              data-menu
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className="bg-navy-900 text-white p-3 rounded-xl mb-4 shadow-[0_4px_12px_rgba(0,45,114,0.2)] hover:bg-navy-800 transition-transform active:scale-95"
            >
              {isMenuOpen ? <XMarkIcon /> : <MenuIcon />}
            </button>

            <img src="/logo-black.png" alt="Parallel" className="h-8" />
            <p className="text-[10px] font-bold text-grey-400 tracking-[0.2em] uppercase mt-1">Neutral Communication</p>
          </>
        )}

        {isMenuOpen && (
          <div data-menu className="absolute top-16 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-grey-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col p-2 gap-1">
              <button onClick={() => { updateState({ view: 'APP' }); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${state.view === 'APP' ? 'bg-grey-50 text-navy-900 border-l-2 border-l-navy-900' : 'text-grey-600 hover:bg-grey-50'}`}>
                <HomeIcon /> Generator
              </button>
              <button onClick={() => { updateState({ view: 'PROFILE' }); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${state.view === 'PROFILE' ? 'bg-grey-50 text-navy-900 border-l-2 border-l-navy-900' : 'text-grey-600 hover:bg-grey-50'}`}>
                <UserIcon /> Profile
              </button>
              <button onClick={() => { updateState({ view: 'PARENTING_PLAN' }); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${state.view === 'PARENTING_PLAN' ? 'bg-grey-50 text-navy-900 border-l-2 border-l-navy-900' : 'text-grey-600 hover:bg-grey-50'}`}>
                <CalendarIcon /> Parenting Plan
              </button>
              <button onClick={() => { updateState({ view: 'CHANGE_LOG' }); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${state.view === 'CHANGE_LOG' ? 'bg-grey-50 text-navy-900 border-l-2 border-l-navy-900' : 'text-grey-600 hover:bg-grey-50'}`}>
                <InfoIcon /> Schedule Change Log
              </button>
              <div className="border-t border-grey-100 my-1" />
              <button onClick={() => { updateState({ view: 'ABOUT' }); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${state.view === 'ABOUT' ? 'bg-grey-50 text-navy-900 border-l-2 border-l-navy-900' : 'text-grey-600 hover:bg-grey-50'}`}>
                <ShieldCheckIcon /> How It Works
              </button>
            </div>
          </div>
        )}
      </header>
    );
  };

  const renderInputStep = () => {
    const isRespondMode = state.inputMode === 'RESPOND';
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={`
          relative rounded-[2rem] p-6 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border overflow-hidden
          transition-all duration-1000 ease-in-out
          ${isLoading 
            ? 'bg-navy-50/50 border-navy-100 scale-[0.99] shadow-inner' 
            : 'bg-orange-50/20 border-orange-50 shadow-sm'
          }
        `}>
          <div className="flex justify-center mb-8 relative z-10">
            <div className="inline-flex p-1.5 bg-grey-100/50 rounded-2xl border border-grey-200/50 backdrop-blur-sm">
              <button 
                onClick={() => updateState({ inputMode: 'RESPOND' })}
                className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl transition-all duration-300 ${isRespondMode ? 'bg-white shadow-md text-navy-900' : 'text-grey-400'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">Respond</span>
                <span className="text-[8px] opacity-60">Analyze text</span>
              </button>
              <button 
                onClick={() => updateState({ inputMode: 'TONE_CHECK' })}
                className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl transition-all duration-300 ${!isRespondMode ? 'bg-white shadow-md text-navy-900' : 'text-grey-400'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">Tone Check</span>
                <span className="text-[8px] opacity-60">Polish draft</span>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-3 relative z-10">
            <label htmlFor="message" className={`block text-[11px] font-bold tracking-widest uppercase transition-colors duration-1000 ${isLoading ? 'text-navy-400' : 'text-grey-400'}`}>
              {isRespondMode ? 'Incoming Message' : 'My Drafted Message'}
            </label>
            {state.incomingMessage && !isLoading && (
              <button 
                onClick={() => updateState({ incomingMessage: '' })}
                className="text-[10px] font-semibold text-grey-400 hover:text-navy-900 transition-colors flex items-center gap-1"
              >
                <RefreshIcon /> Clear
              </button>
            )}
          </div>
          
          <textarea
            id="message"
            className={`w-full resize-none outline-none h-48 text-lg bg-transparent leading-relaxed transition-colors duration-1000 relative z-10 ${isLoading ? 'text-navy-900/40' : 'text-navy-900'} placeholder:text-grey-300`}
            placeholder={isRespondMode ? "Paste the text message here..." : "Type your message to see if it's too emotional..."}
            value={state.incomingMessage}
            onChange={(e) => updateState({ incomingMessage: e.target.value })}
            readOnly={isLoading}
          />
          
          {isRespondMode && (
            <div className="border-t border-grey-100/50 pt-4 mt-2 relative z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-grey-400">Response Mode</label>
                    <button 
                      onClick={() => setIsModeGuideOpen(true)}
                      className="text-grey-300 hover:text-navy-400 transition-colors p-0.5"
                      title="Explain modes"
                    >
                      <InfoIcon />
                    </button>
                  </div>
                  <select 
                    value={state.selectedMode}
                    onChange={(e) => updateState({ selectedMode: e.target.value as ResponseMode })}
                    className="text-xs bg-grey-50/50 border-none rounded-md text-navy-900 font-semibold py-1.5 pl-2 pr-8 cursor-pointer focus:ring-0"
                    disabled={isLoading}
                  >
                    {Object.values(ResponseMode).map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
            </div>
          )}
        </div>
        
        {state.error && (
          <Card className="border-l-4 border-l-red-400 bg-red-50/50">
            <div className="flex items-start gap-3">
              <div className="text-red-500 mt-0.5"><AlertIcon /></div>
              <div>
                <p className="text-sm font-semibold text-red-800">Something went wrong</p>
                <p className="text-sm text-red-600 mt-1">{state.error}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleAnalyze}
            disabled={!state.incomingMessage.trim()}
            isLoading={isLoading}
            className="rounded-2xl py-5 text-sm font-bold tracking-wider uppercase shadow-xl"
          >
            {isRespondMode ? 'Analyze Text & Generate Response' : 'Analyze My Tone'}
          </Button>
          <p className="text-center text-[10px] text-grey-400 font-medium">
            Confidential processing. Messages are not saved.
          </p>
        </div>
      </div>
    );
  };

  const renderResultStep = () => {
    const isRespondMode = state.inputMode === 'RESPOND';
    const analysis = state.analysis;
    const isNoResponse = analysis?.recommendedAction === RecommendedAction.NO_RESPONSE;
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isRespondMode && analysis && (
          <Card className="border-l-[6px] border-l-navy-900 shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-navy-900">
                <ParallelLogoIcon />
              </div>
              <h2 className="text-2xl font-bold text-navy-900">Analysis Result</h2>
            </div>
            
            <p className="text-slate-600 text-[15px] leading-relaxed mb-6">
              {analysis.reasoning}
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Badge type={analysis.classification === ClassificationType.PERSONAL_BAIT ? 'warning' : 'neutral'}>
                {analysis.classification.replace('_', ' ')}
              </Badge>
              <Badge type="gray">
                ACTION: {analysis.recommendedAction.replace('_', ' ')}
              </Badge>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                Detected Hooks <span className="text-[8px] opacity-40 lowercase">(Click to learn more)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.manipulationTags.length > 0 ? (
                  analysis.manipulationTags.map(tag => (
                    <Tag key={tag} label={tag} onClick={() => setSelectedHook(tag)} />
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No hooks detected.</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {isRespondMode && isNoResponse && (
          <div className="bg-navy-50/30 rounded-3xl border border-navy-100/50 p-10 text-center space-y-4 animate-in fade-in zoom-in-95 duration-700">
            <h2 className="text-3xl font-bold text-navy-900 leading-tight">
              No Response Recommended
            </h2>
            <p className="text-slate-600 text-lg max-w-sm mx-auto leading-relaxed">
              This message has been identified as {analysis?.classification === ClassificationType.PERSONAL_BAIT ? 'personal bait' : 'unproductive'}. Responding may lead to escalation or emotional drain.
            </p>
          </div>
        )}

        {!isNoResponse && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {isRespondMode ? 'Recommended Neutral Draft' : 'Refined Message'}
                </h3>
             </div>
             
             <div className="relative group">
                <textarea
                  className={`w-full rounded-2xl border-2 p-5 text-navy-900 focus:ring-0 focus:outline-none transition-all resize-none text-lg leading-relaxed shadow-sm ${
                    safetyCheck?.isSafe === false ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100 bg-white focus:border-navy-200'
                  }`}
                  rows={7}
                  value={state.currentDraft}
                  onChange={(e) => {
                    updateState({ currentDraft: e.target.value });
                    if (safetyCheck) setSafetyCheck(null);
                  }}
                />
                
                {safetyCheck && !safetyCheck.isSafe && (
                   <div className="absolute bottom-4 right-4 left-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-orange-100 p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                          <AlertIcon />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-navy-900">Conflict Hooks Detected</p>
                          <p className="text-xs text-slate-500 mt-0.5">Phrases: <span className="font-semibold text-orange-700">{safetyCheck.emotionalWords.join(', ')}</span></p>
                        </div>
                      </div>
                      <button 
                        onClick={applyNeutralRewrite} 
                        className="text-xs font-bold bg-navy-900 text-white py-3 px-4 rounded-lg hover:bg-navy-800 transition-colors shadow-md active:scale-95"
                      >
                        Apply Neutral Rewrite
                      </button>
                   </div>
                )}
             </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4">
           <Button variant="secondary" onClick={reset} className="rounded-xl font-bold py-4">
             {isRespondMode ? 'New Analysis' : 'Back'}
           </Button>
           {!isNoResponse && (
             <Button onClick={copyToClipboard} className="rounded-xl font-bold py-4 shadow-lg">
               {copyFeedback ? 'Copied!' : 'Copy Draft'}
             </Button>
           )}
           {isNoResponse && (
              <Button onClick={reset} className="rounded-xl font-bold py-4 shadow-lg">
                Back to Input
              </Button>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      {isLaunching && <LaunchScreen exiting={launchExiting} />}
      
      <div className="w-full max-w-xl">
        {renderHeader()}
        <main className="pb-12">
          {state.view === 'APP' && (
             <>
                {state.step === 'INPUT' && renderInputStep()}
                {state.step === 'RESULT' && renderResultStep()}
             </>
          )}
          {state.view === 'PROFILE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2"><UserIcon /> Account</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Your Name</label>
                    <input type="text" placeholder="Your Name" className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors" value={state.userProfile.name} onChange={(e) => updateUserProfile({ name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Email</label>
                    <input type="email" placeholder="Email" className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors" value={state.userProfile.email} onChange={(e) => updateUserProfile({ email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Co-Parent's Name</label>
                    <input type="text" placeholder="Co-Parent's Name" className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors" value={state.userProfile.coParentName} onChange={(e) => updateUserProfile({ coParentName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Children's Names</label>
                    <input type="text" placeholder="e.g. Emma, Liam" className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors" value={state.userProfile.childrenNames} onChange={(e) => updateUserProfile({ childrenNames: e.target.value })} />
                    <p className="text-[10px] text-grey-400 mt-1">Separate multiple names with commas</p>
                  </div>
                </div>
              </Card>
              <Button onClick={handleSaveProfile} className="rounded-2xl py-4 text-sm font-bold tracking-wider uppercase">
                Save Profile
              </Button>
            </div>
          )}

          {state.view === 'PARENTING_PLAN' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-2 flex items-center gap-2">
                  <CalendarIcon /> Parenting Plan
                </h2>
                <p className="text-sm text-grey-500 mb-6">
                  Enter details about your parenting schedule. This helps Parallel reference specific times, exchanges, and arrangements in generated responses.
                </p>
                <textarea
                  className="w-full rounded-xl border border-grey-200 bg-grey-50 p-4 text-navy-900 text-sm leading-relaxed resize-none h-64 focus:border-navy-300 focus:ring-0 outline-none transition-colors"
                  placeholder="e.g. Exchange times, pickup/drop-off locations, holiday schedule, weekly rotation..."
                  value={state.userProfile.parentingPlanContext}
                  onChange={(e) => updateUserProfile({ parentingPlanContext: e.target.value })}
                />
              </Card>
              <Button onClick={handleSaveContext} className="rounded-2xl py-4 text-sm font-bold tracking-wider uppercase">
                Save Parenting Plan
              </Button>
            </div>
          )}

          {state.view === 'CHANGE_LOG' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
                  <InfoIcon /> Log a Schedule Change
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors"
                      value={newLog.date || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Requested By</label>
                    <select
                      className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors"
                      value={newLog.requestor || 'Co-Parent'}
                      onChange={(e) => setNewLog(prev => ({ ...prev, requestor: e.target.value as LogEntry['requestor'] }))}
                    >
                      <option value="Me">Me</option>
                      <option value="Co-Parent">Co-Parent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Reason for Change</label>
                    <input
                      type="text"
                      placeholder="e.g. Work conflict, child's activity, holiday swap..."
                      className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 focus:border-navy-300 focus:ring-0 outline-none transition-colors"
                      value={newLog.reason || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-400 uppercase tracking-widest mb-1.5">Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Optional: any additional details..."
                      className="w-full rounded-lg border border-grey-200 bg-grey-50 p-2.5 text-navy-900 text-sm resize-none focus:border-navy-300 focus:ring-0 outline-none transition-colors"
                      value={newLog.notes || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddLogEntry}
                  disabled={!newLog.reason?.trim() || !newLog.date}
                  className="rounded-xl py-3 text-sm font-bold tracking-wider uppercase mt-4"
                >
                  Add Entry
                </Button>
              </Card>

              {state.userProfile.logs.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-grey-400 uppercase tracking-widest">
                    Change History ({state.userProfile.logs.length})
                  </h3>
                  {state.userProfile.logs.map(entry => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-navy-900">{entry.date}</span>
                            <Badge type={entry.requestor === 'Me' ? 'neutral' : 'warning'}>
                              {entry.requestor}
                            </Badge>
                          </div>
                          <p className="text-sm text-grey-600">{entry.reason}</p>
                          {entry.notes && (
                            <p className="text-xs text-grey-400 mt-1">{entry.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteLogEntry(entry.id)}
                          className="text-grey-300 hover:text-red-500 transition-colors p-1"
                          title="Delete entry"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-grey-400 text-sm">No schedule changes logged yet.</p>
                  <p className="text-grey-300 text-xs mt-1">Use this log to track any custody schedule modifications.</p>
                </div>
              )}
            </div>
          )}

          {state.view === 'ABOUT' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
                  <ShieldCheckIcon /> What is Parallel Parenting?
                </h2>
                <p className="text-sm text-grey-600 leading-relaxed mb-4">
                  Parallel parenting is an arrangement where each parent makes day-to-day decisions independently, with minimal direct communication between them. Unlike cooperative co-parenting, it's designed for situations where direct interaction leads to conflict.
                </p>
                <p className="text-sm text-grey-600 leading-relaxed">
                  The goal is to protect both you and your children from the effects of ongoing conflict by reducing the opportunities for disagreement. Communication is kept brief, factual, and strictly about the children's needs.
                </p>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-4">The Grey Rock Method</h2>
                <p className="text-sm text-grey-600 leading-relaxed mb-4">
                  Grey Rocking is a communication strategy where your responses become as uninteresting and unreactive as a grey rock. The idea is simple: when you stop providing emotional reactions, conflict loses its fuel.
                </p>
                <div className="space-y-3">
                  <div className="bg-grey-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-widest mb-1">Boring & Brief</h4>
                    <p className="text-sm text-grey-500">Responses are short, factual, and unemotional. No extra detail, no pleasantries, no storytelling.</p>
                  </div>
                  <div className="bg-grey-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-widest mb-1">No JADE</h4>
                    <p className="text-sm text-grey-500">Never Justify, Argue, Defend, or Explain. These reactions invite further engagement and escalation.</p>
                  </div>
                  <div className="bg-grey-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-widest mb-1">Logistics Only</h4>
                    <p className="text-sm text-grey-500">Only respond to what directly involves the children's schedule, health, or safety. Ignore everything else.</p>
                  </div>
                  <div className="bg-grey-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-widest mb-1">No Bait Taken</h4>
                    <p className="text-sm text-grey-500">Personal attacks, guilt trips, and provocations are left unanswered. If there's no logistical question, there's no reply.</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-navy-900 mb-4">How Parallel Uses This</h2>
                <p className="text-sm text-grey-600 leading-relaxed mb-4">
                  When you paste an incoming message, Parallel analyzes it for manipulation tactics — things like guilt-baiting, blame-shifting, urgency, and topic drift. It classifies the message and tells you whether it even deserves a response.
                </p>
                <p className="text-sm text-grey-600 leading-relaxed mb-4">
                  If a response is warranted, Parallel drafts one using Grey Rock principles: stripped of emotion, focused on logistics, and safe to send. You can also use Tone Check to run your own drafts through the same filter before hitting send.
                </p>
                <p className="text-sm text-grey-600 leading-relaxed">
                  The result is communication that protects your boundaries, keeps things child-focused, and avoids giving your co-parent anything to escalate with.
                </p>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Hook Definitions Modal */}
      <Modal 
        isOpen={!!selectedHook} 
        onClose={() => setSelectedHook(null)} 
        title={`Hook: ${selectedHook}`}
      >
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            {selectedHook && (HOOK_DEFINITIONS[selectedHook] || "This is a manipulative tactic designed to pull you away from logical co-parenting and into emotional engagement.")}
          </p>
          <div className="bg-navy-50 p-4 rounded-xl border border-navy-100">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">How to handle it:</h4>
            <p className="text-sm text-navy-700 italic">"Do not defend yourself against these statements. Address only the logistical question, or if there is no question, do not respond at all. This is the 'Grey Rock' method."</p>
          </div>
          <Button onClick={() => setSelectedHook(null)}>Understood</Button>
        </div>
      </Modal>

      {/* Response Mode Guide Modal */}
      <Modal
        isOpen={isModeGuideOpen}
        onClose={() => setIsModeGuideOpen(false)}
        title="Response Modes Guide"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500 italic">
            Each mode applies different 'Grey Rock' filters to your communication to minimize conflict and preserve your sanity.
          </p>
          <div className="space-y-4">
            {MODE_DESCRIPTIONS.map((item) => (
              <div key={item.title} className="border-b border-slate-50 pb-4 last:border-0">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-widest mb-1">{item.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <Button onClick={() => setIsModeGuideOpen(false)}>Close Guide</Button>
        </div>
      </Modal>

      <Toast
        message={toast?.message || ''}
        isVisible={!!toast}
        type={toast?.type || 'success'}
      />
    </div>
  );
};

export default App;