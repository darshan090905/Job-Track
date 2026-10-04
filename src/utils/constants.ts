import { JobStatus, Visibility } from '../types';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  saved: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  applied: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  assessment: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  interview: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  offer: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  withdrawn: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  everyone: 'Everyone',
  friends: 'Friends',
  private: 'Only Me',
};

export const VISIBILITY_COLORS: Record<Visibility, string> = {
  everyone: 'bg-emerald-500/20 text-emerald-300',
  friends: 'bg-blue-500/20 text-blue-300',
  private: 'bg-gray-500/20 text-gray-400',
};

export const JOB_SOURCES = [
  'LinkedIn',
  'Naukri',
  'Indeed',
  'Company Website',
  'Referral',
  'Walk-in',
  'Friend',
  'Other',
];

export const DEFAULT_WALKIN_CHECKLIST = [
  'Resume printed',
  'Resume PDF ready',
  'ID proof',
  'Certificates',
  'Passport photos',
  'Formal clothes',
  'Registration completed',
  'Location checked',
];

export const EVENT_TYPE_LABELS: Record<string, string> = {
  job_added: 'Job Added',
  application_submitted: 'Application Submitted',
  assessment_received: 'Assessment Received',
  assessment_completed: 'Assessment Completed',
  interview: 'Interview',
  offer: 'Offer Received',
  rejected: 'Rejected',
  custom: 'Note',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  job_added: 'bg-slate-500',
  application_submitted: 'bg-blue-500',
  assessment_received: 'bg-amber-500',
  assessment_completed: 'bg-amber-400',
  interview: 'bg-purple-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-red-500',
  custom: 'bg-indigo-500',
};
