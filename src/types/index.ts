export type JobStatus = 'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
export type Visibility = 'everyone' | 'friends' | 'private';
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type WalkinStatus = 'upcoming' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  version: string;
  description?: string;
  file_path: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface Job {
  id: string;
  user_id: string;
  company: string;
  job_title: string;
  location?: string;
  job_url: string;
  source?: string;
  status: JobStatus;
  resume_id?: string;
  salary?: string;
  notes?: string;
  applied_date?: string;
  follow_up_date?: string;
  visibility: Visibility;
  source_shared_job_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  resume?: Resume;
  profile?: Profile;
}

export interface ApplicationEvent {
  id: string;
  job_id: string;
  user_id: string;
  event_type: string;
  event_date: string;
  notes?: string;
  created_at: string;
}

export interface WalkinDrive {
  id: string;
  user_id: string;
  company: string;
  job_title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  address?: string;
  registration_url?: string;
  resume_id?: string;
  contact_details?: string;
  notes?: string;
  status: WalkinStatus;
  visibility: Visibility;
  reminder_enabled: boolean;
  reminder_days_before: number;
  email_reminder: boolean;
  reminder_sent: boolean;
  source_shared_walkin_id?: string;
  created_at: string;
  updated_at: string;
  // Joined
  resume?: Resume;
  profile?: Profile;
}

export interface WalkinChecklist {
  id: string;
  walkin_id: string;
  item: string;
  completed: boolean;
}

export interface NotificationEmail {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  enabled: boolean;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
  // Joined
  sender?: Profile;
  receiver?: Profile;
}

export interface UserSettings {
  walkin_reminders: boolean;
  followup_reminders: boolean;
  interview_reminders: boolean;
  reminder_days_before: number;
}
