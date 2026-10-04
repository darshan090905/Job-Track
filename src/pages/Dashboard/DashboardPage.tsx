import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, CheckCircle, ClipboardList, MessageSquare,
  Award, XCircle, MapPin, Bell, Plus, ExternalLink,
  BookmarkPlus, AlertTriangle, ArrowRight, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Job, WalkinDrive } from '../../types';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '../../utils/constants';
import { formatDate, isDateToday, isDateTomorrow } from '../../utils/helpers';
import { useToast } from '../../hooks/useToast';

interface Stats {
  total: number;
  applied: number;
  assessment: number;
  interview: number;
  offer: number;
  rejected: number;
  walkins: number;
  followups: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ total: 0, applied: 0, assessment: 0, interview: 0, offer: 0, rejected: 0, walkins: 0, followups: 0 });
  const [recentShared, setRecentShared] = useState<Job[]>([]);
  const [friendJobs, setFriendJobs] = useState<Job[]>([]);
  const [upcomingWalkins, setUpcomingWalkins] = useState<WalkinDrive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    await Promise.all([loadStats(), loadSharedJobs(), loadUpcomingWalkins()]);
    setLoading(false);
  }

  async function loadStats() {
    if (!user) return;
    const { data } = await supabase.from('jobs').select('status, follow_up_date').eq('user_id', user.id);
    if (!data) return;
    const today = new Date().toISOString().split('T')[0];
    setStats({
      total: data.length,
      applied: data.filter(j => j.status === 'applied').length,
      assessment: data.filter(j => j.status === 'assessment').length,
      interview: data.filter(j => j.status === 'interview').length,
      offer: data.filter(j => j.status === 'offer').length,
      rejected: data.filter(j => j.status === 'rejected').length,
      walkins: 0,
      followups: data.filter(j => j.follow_up_date && j.follow_up_date >= today).length,
    });

    const { count } = await supabase.from('walkin_drives').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    setStats(prev => ({ ...prev, walkins: count || 0 }));
  }

  async function loadSharedJobs() {
    if (!user) return;
    // Get accepted friends first
    const { data: friendsData } = await supabase
      .from('friend_requests')
      .select('sender_user_id, receiver_user_id')
      .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const friendIds = (friendsData || []).map(f =>
      f.sender_user_id === user.id ? f.receiver_user_id : f.sender_user_id
    );

    // Get everyone jobs (excluding own)
    const { data: everyoneJobs } = await supabase
      .from('jobs')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('visibility', 'everyone')
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);

    setRecentShared((everyoneJobs || []) as Job[]);

    if (friendIds.length > 0) {
      const { data: fJobs } = await supabase
        .from('jobs')
        .select('*, profile:profiles(name, avatar_url)')
        .eq('visibility', 'friends')
        .in('user_id', friendIds)
        .order('created_at', { ascending: false })
        .limit(4);
      setFriendJobs((fJobs || []) as Job[]);
    }
  }

  async function loadUpcomingWalkins() {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('walkin_drives')
      .select('*, resume:resumes(name, version)')
      .eq('user_id', user.id)
      .gte('date', today)
      .lte('date', tomorrow)
      .order('date', { ascending: true });
    setUpcomingWalkins((data || []) as WalkinDrive[]);
  }

  async function saveJob(job: Job) {
    if (!user) return;
    const { error } = await supabase.from('jobs').insert({
      user_id: user.id,
      company: job.company,
      job_title: job.job_title,
      location: job.location,
      job_url: job.job_url,
      source: 'Friend',
      status: 'saved',
      visibility: 'private',
      source_shared_job_id: job.id,
    });
    if (error) toast('Failed to save job', 'error');
    else toast('Job saved to My Applications!', 'success');
  }

  const statCards = [
    { label: 'Total Jobs', value: stats.total, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Applied', value: stats.applied, icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Assessments', value: stats.assessment, icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Interviews', value: stats.interview, icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Offers', value: stats.offer, icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Walk-ins', value: stats.walkins, icon: MapPin, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Follow-ups', value: stats.followups, icon: Bell, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-indigo-400">{profile?.name?.split(' ')[0] || 'there'}</span> 👋
          </h1>
          <p className="page-subtitle mt-1">Here's your job search overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/applications?add=true" className="btn-primary">
            <Plus className="w-4 h-4" /> Add Job
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9898b8] font-medium">{label}</span>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link to="/applications?add=true" className="btn-secondary text-sm">
          <Plus className="w-3.5 h-3.5" /> Add Job
        </Link>
        <Link to="/walkins?add=true" className="btn-secondary text-sm">
          <MapPin className="w-3.5 h-3.5" /> Add Walk-in
        </Link>
        <Link to="/resumes" className="btn-secondary text-sm">
          <Briefcase className="w-3.5 h-3.5" /> Upload Resume
        </Link>
      </div>

      {/* Upcoming Walk-ins Banner */}
      {upcomingWalkins.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          {upcomingWalkins.map(w => (
            <div key={w.id} className={`rounded-xl p-4 border flex items-start gap-4 ${
              isDateToday(w.date)
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDateToday(w.date) ? 'text-amber-400' : 'text-red-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isDateToday(w.date) ? 'text-amber-300' : 'text-red-300'}`}>
                  🚨 WALK-IN {isDateToday(w.date) ? 'TODAY' : 'TOMORROW'}
                </p>
                <p className="text-[#f0f0ff] font-medium mt-0.5">{w.company} — {w.job_title}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-[#9898b8]">
                  {w.start_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{w.start_time}</span>}
                  {w.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{w.location}</span>}
                  {w.resume && <span>Resume: {w.resume.name}</span>}
                </div>
              </div>
              <Link to={`/walkins/${w.id}`} className="btn-secondary text-xs flex-shrink-0">View</Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Jobs from Everyone */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">🔥 Latest Jobs From Everyone</h2>
            <Link to="/job-feed" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-[#1c1c28]" />)}
            </div>
          ) : recentShared.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-[#9898b8] text-sm">No shared jobs yet.</p>
              <p className="text-[#6666a0] text-xs mt-1">Be the first to share a job!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentShared.map(job => (
                <div key={job.id} className="card-hover flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#f0f0ff] text-sm truncate">{job.company}</p>
                    <p className="text-[#9898b8] text-xs truncate">{job.job_title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {job.location && <span className="text-xs text-[#6666a0] flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                      {job.profile && <span className="text-xs text-[#6666a0]">by {(job.profile as {name:string}).name}</span>}
                      <span className="text-xs text-[#6666a0]">{formatDate(job.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <a href={job.job_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-[#232334] hover:bg-indigo-500/20 text-[#9898b8] hover:text-indigo-300 transition-colors"
                      title="Open Job">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => saveJob(job)}
                      className="p-1.5 rounded-lg bg-[#232334] hover:bg-emerald-500/20 text-[#9898b8] hover:text-emerald-300 transition-colors"
                      title="Save to My Jobs">
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Jobs from Friends */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">👥 Jobs From Friends</h2>
              <Link to="/job-feed?tab=friends" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="card h-24 animate-pulse" />
            ) : friendJobs.length === 0 ? (
              <div className="card text-center py-6">
                <p className="text-[#9898b8] text-xs">No friend jobs yet.</p>
                <Link to="/friends" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
                  Find friends →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {friendJobs.map(job => (
                  <div key={job.id} className="card-hover p-3">
                    <p className="text-xs text-[#9898b8] mb-0.5">
                      <span className="text-indigo-300">{(job.profile as {name:string})?.name}</span> shared:
                    </p>
                    <p className="text-sm font-medium text-[#f0f0ff]">{job.company} — {job.job_title}</p>
                    <div className="flex gap-1.5 mt-2">
                      <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1 px-2">
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                      <button onClick={() => saveJob(job)} className="btn-secondary text-xs py-1 px-2">
                        <BookmarkPlus className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
