import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, CheckCircle, ClipboardList, MessageSquare,
  Award, XCircle, MapPin, Bell, Plus, ExternalLink,
  BookmarkPlus, AlertTriangle, ArrowRight, Clock,
  Trophy, Medal, Sparkles, Star, ChevronRight, FileText,
  BarChart3, UserCheck, Flame
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Job, WalkinDrive, Profile } from '../../types';
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

export interface ContributorScore {
  userId: string;
  name: string;
  avatarUrl?: string;
  jobsCount: number;
  walkinsCount: number;
  totalPoints: number;
  rank: number;
  badge: {
    title: string;
    icon: string;
    color: string;
    bg: string;
  };
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ total: 0, applied: 0, assessment: 0, interview: 0, offer: 0, rejected: 0, walkins: 0, followups: 0 });
  const [upcomingWalkins, setUpcomingWalkins] = useState<WalkinDrive[]>([]);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'jobs' | 'walkins'>('all');
  const [leaderboard, setLeaderboard] = useState<ContributorScore[]>([]);
  const [loading, setLoading] = useState(true);

  interface CommunityNotification {
    id: string;
    type: 'job' | 'walkin';
    title: string;
    company: string;
    location?: string;
    url?: string;
    date?: string;
    startTime?: string;
    createdAt: string;
    authorName: string;
    authorAvatar?: string;
    originalItem: Job | WalkinDrive;
  }

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    await Promise.all([loadStats(), loadSharedJobs(), loadUpcomingWalkins(), loadLeaderboard()]);
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

  function getBadge(points: number) {
    if (points >= 100) return { title: 'Legendary Scout', icon: '👑', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
    if (points >= 50) return { title: 'Master Contributor', icon: '🏆', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' };
    if (points >= 25) return { title: 'Community Star', icon: '⭐', color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/30' };
    if (points >= 10) return { title: 'Active Scout', icon: '🚀', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
    return { title: 'New Scout', icon: '🌱', color: 'text-[#9898b8]', bg: 'bg-[#1c1c28] border-[#2a2a3d]' };
  }

  async function loadLeaderboard() {
    try {
      const [jobsRes, walkinsRes] = await Promise.all([
        supabase.from('jobs').select('user_id').in('visibility', ['everyone', 'friends']),
        supabase.from('walkin_drives').select('user_id').in('visibility', ['everyone', 'friends'])
      ]);

      const jobs = jobsRes.data || [];
      const walkins = walkinsRes.data || [];

      const userJobCounts: Record<string, number> = {};
      const userWalkinCounts: Record<string, number> = {};
      const allUserIds = new Set<string>();

      jobs.forEach(j => {
        if (j.user_id) {
          userJobCounts[j.user_id] = (userJobCounts[j.user_id] || 0) + 1;
          allUserIds.add(j.user_id);
        }
      });

      walkins.forEach(w => {
        if (w.user_id) {
          userWalkinCounts[w.user_id] = (userWalkinCounts[w.user_id] || 0) + 1;
          allUserIds.add(w.user_id);
        }
      });

      if (user && !allUserIds.has(user.id)) {
        allUserIds.add(user.id);
      }

      const userIdsArray = Array.from(allUserIds);
      let profileMap: Record<string, Profile> = {};

      if (userIdsArray.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIdsArray);

        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p as Profile]));
        }
      }

      const scores: ContributorScore[] = userIdsArray.map(id => {
        const jobsCount = userJobCounts[id] || 0;
        const walkinsCount = userWalkinCounts[id] || 0;
        const totalPoints = (jobsCount * 10) + (walkinsCount * 15);
        const p = profileMap[id];
        const name = p?.name || (id === user?.id ? (profile?.name || 'You') : 'Anonymous Scout');

        return {
          userId: id,
          name,
          avatarUrl: p?.avatar_url,
          jobsCount,
          walkinsCount,
          totalPoints,
          rank: 0,
          badge: getBadge(totalPoints),
        };
      });

      scores.sort((a, b) => b.totalPoints - a.totalPoints || b.jobsCount - a.jobsCount);
      scores.forEach((s, idx) => {
        s.rank = idx + 1;
      });

      setLeaderboard(scores);
    } catch (err) {
      console.error('loadLeaderboard error:', err);
    }
  }

  async function loadSharedJobs() {
    if (!user) return;
    try {
      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs')
        .select('*')
        .in('visibility', ['everyone', 'friends'])
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobsErr) console.error('Dashboard jobs fetch error:', jobsErr);

      const { data: walkinsData, error: wErr } = await supabase
        .from('walkin_drives')
        .select('*')
        .in('visibility', ['everyone', 'friends'])
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (wErr) console.error('Dashboard walkins fetch error:', wErr);

      const jobs = jobsData || [];
      const walkins = walkinsData || [];

      const userIds = new Set<string>();
      jobs.forEach(j => userIds.add(j.user_id));
      walkins.forEach(w => userIds.add(w.user_id));

      let profileMap: Record<string, { name: string; avatar_url?: string }> = {};
      if (userIds.size > 0) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', Array.from(userIds));

        if (profData) {
          profileMap = Object.fromEntries(profData.map(p => [p.id, p]));
        }
      }

      const feedItems: CommunityNotification[] = [
        ...jobs.map(j => ({
          id: `job-${j.id}`,
          type: 'job' as const,
          title: j.job_title,
          company: j.company,
          location: j.location,
          url: j.job_url,
          createdAt: j.created_at,
          authorName: profileMap[j.user_id]?.name || 'JobTrack Member',
          authorAvatar: profileMap[j.user_id]?.avatar_url,
          originalItem: j as Job,
        })),
        ...walkins.map(w => ({
          id: `walkin-${w.id}`,
          type: 'walkin' as const,
          title: w.job_title,
          company: w.company,
          location: w.location,
          url: w.registration_url,
          date: w.date,
          startTime: w.start_time,
          createdAt: w.created_at,
          authorName: profileMap[w.user_id]?.name || 'JobTrack Member',
          authorAvatar: profileMap[w.user_id]?.avatar_url,
          originalItem: w as WalkinDrive,
        })),
      ];

      feedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(feedItems);
    } catch (err) {
      console.error('loadSharedJobs error:', err);
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
    const { data: existing } = await supabase.from('jobs').select('id').eq('user_id', user.id).eq('job_url', job.job_url).single();
    if (existing) {
      toast('This job is already in My Applications.', 'info');
      return;
    }
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

  async function saveWalkin(w: WalkinDrive) {
    if (!user) return;
    const { error } = await supabase.from('walkin_drives').insert({
      user_id: user.id,
      company: w.company,
      job_title: w.job_title,
      date: w.date,
      start_time: w.start_time,
      end_time: w.end_time,
      location: w.location,
      address: w.address,
      registration_url: w.registration_url,
      notes: w.notes,
      status: 'upcoming',
      visibility: 'private',
      reminder_enabled: true,
      reminder_days_before: 1,
      email_reminder: false,
      reminder_sent: false,
      source_shared_walkin_id: w.id,
    });
    if (error) toast('Failed to save walk-in', 'error');
    else toast('Walk-in saved to My Walk-ins!', 'success');
  }

  const filteredNotifications = notifications.filter(n => {
    if (notificationFilter === 'jobs') return n.type === 'job';
    if (notificationFilter === 'walkins') return n.type === 'walkin';
    return true;
  });

  // Top 5 items displayed to keep Dashboard clean and prevent overflow
  const topNotifications = filteredNotifications.slice(0, 5);

  const currentUserScore = leaderboard.find(s => s.userId === user?.id) || {
    userId: user?.id || '',
    name: profile?.name || 'You',
    avatarUrl: profile?.avatar_url,
    jobsCount: 0,
    walkinsCount: 0,
    totalPoints: 0,
    rank: leaderboard.length > 0 ? leaderboard.length + 1 : 1,
    badge: getBadge(0),
  };

  const topLeaders = leaderboard.slice(0, 4);
  const isUserInTop = topLeaders.some(l => l.userId === user?.id);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-bold">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-indigo-400">{profile?.name?.split(' ')[0] || 'there'}</span> 👋
          </h1>
          <p className="page-subtitle mt-0.5">Here's your job search & community overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/scoreboard" className="btn-secondary text-xs sm:text-sm py-2 text-amber-300 border-amber-500/30">
            🏆 Scoreboard
          </Link>
          <Link to="/applications?add=true" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4">
            <Plus className="w-4 h-4" /> Add Job
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-[#9898b8] font-medium">{label}</span>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${color}`}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1">
        <Link to="/applications?add=true" className="btn-secondary text-xs sm:text-sm py-2 flex-shrink-0">
          <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Job
        </Link>
        <Link to="/walkins?add=true" className="btn-secondary text-xs sm:text-sm py-2 flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Add Walk-in
        </Link>
        <Link to="/scoreboard" className="btn-secondary text-xs sm:text-sm py-2 flex-shrink-0 text-amber-300 border-amber-500/30">
          🏆 Community Leaderboard
        </Link>
        <Link to="/resumes" className="btn-secondary text-xs sm:text-sm py-2 flex-shrink-0">
          <Briefcase className="w-3.5 h-3.5 text-purple-400" /> Resumes
        </Link>
      </div>

      {/* Upcoming Walk-ins Banner */}
      {upcomingWalkins.length > 0 && (
        <div className="mb-6 sm:mb-8 flex flex-col gap-3">
          {upcomingWalkins.map(w => (
            <div key={w.id} className={`rounded-xl p-3 sm:p-4 border flex items-start gap-3 sm:gap-4 ${
              isDateToday(w.date)
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDateToday(w.date) ? 'text-amber-400' : 'text-red-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-xs sm:text-sm ${isDateToday(w.date) ? 'text-amber-300' : 'text-red-300'}`}>
                  🚨 WALK-IN {isDateToday(w.date) ? 'TODAY' : 'TOMORROW'}
                </p>
                <p className="text-[#f0f0ff] font-medium mt-0.5 text-sm sm:text-base truncate">{w.company} — {w.job_title}</p>
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[#9898b8]">
                  {w.start_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{w.start_time}</span>}
                  {w.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{w.location}</span>}
                </div>
              </div>
              <Link to="/walkins" className="btn-secondary text-xs flex-shrink-0 py-1.5 px-2.5">View</Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Opportunities & Notifications (Limited to Top 5) */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
            <div>
              <h2 className="section-title text-base sm:text-lg flex items-center gap-2">
                <span>🔥 Latest Community Updates</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-semibold">
                  {filteredNotifications.length > 5 ? `Top 5 of ${filteredNotifications.length}` : `${filteredNotifications.length}`}
                </span>
              </h2>
              <p className="text-xs text-[#9898b8]">Top 5 newly updated jobs and walk-in drives shared by community members</p>
            </div>

            <Link to="/job-feed" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium flex-shrink-0">
              View all in Job Feed <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 mb-3.5 overflow-x-auto pb-1">
            <button
              onClick={() => setNotificationFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                notificationFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[#1c1c28] text-[#9898b8] border border-[#2a2a3d] hover:border-indigo-500/40 hover:text-[#f0f0ff]'
              }`}
            >
              All Updates ({notifications.length})
            </button>
            <button
              onClick={() => setNotificationFilter('jobs')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                notificationFilter === 'jobs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[#1c1c28] text-[#9898b8] border border-[#2a2a3d] hover:border-indigo-500/40 hover:text-[#f0f0ff]'
              }`}
            >
              <Briefcase className="w-3 h-3" /> Jobs ({notifications.filter(n => n.type === 'job').length})
            </button>
            <button
              onClick={() => setNotificationFilter('walkins')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                notificationFilter === 'walkins'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-[#1c1c28] text-[#9898b8] border border-[#2a2a3d] hover:border-indigo-500/40 hover:text-[#f0f0ff]'
              }`}
            >
              <MapPin className="w-3 h-3 text-cyan-400" /> Walk-ins ({notifications.filter(n => n.type === 'walkin').length})
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="card h-24 animate-pulse bg-[#1c1c28]" />)}
            </div>
          ) : topNotifications.length === 0 ? (
            <div className="card text-center py-10">
              <Briefcase className="w-10 h-10 text-[#6666a0] mx-auto mb-2" />
              <p className="text-[#f0f0ff] font-medium text-sm">No community updates yet</p>
              <p className="text-[#9898b8] text-xs mt-1">Be the first to share an opportunity with the community!</p>
              <Link to="/job-feed" className="btn-primary text-xs mx-auto mt-3 self-center inline-flex">
                <Plus className="w-3.5 h-3.5" /> Share Opportunity
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {topNotifications.map(item => (
                <div
                  key={item.id}
                  className="card-hover p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.type === 'job'
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                        : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                    }`}>
                      {item.type === 'job' ? <Briefcase className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          item.type === 'job'
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {item.type === 'job' ? '💼 Job Opening' : '📍 Walk-in Drive'}
                        </span>
                        <span className="text-[11px] text-[#9898b8]">
                          Shared by <strong className="text-[#f0f0ff]">{item.authorName}</strong>
                        </span>
                        <span className="text-[11px] text-[#6666a0]">
                          • {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <p className="font-semibold text-[#f0f0ff] text-sm sm:text-base leading-tight truncate">
                        {item.company} — <span className="text-[#9898b8] font-normal">{item.title}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#9898b8]">
                        {item.location && <span>📍 {item.location}</span>}
                        {item.date && <span className="text-cyan-300 font-medium">📅 Drive Date: {formatDate(item.date)}</span>}
                        {item.startTime && <span>🕐 {item.startTime}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2a2a3d]">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-xs py-1.5 px-3 flex-1 sm:flex-initial justify-center"
                        title="Open Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{item.type === 'walkin' ? 'Register' : 'Open'}</span>
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (item.type === 'job') saveJob(item.originalItem as Job);
                        else saveWalkin(item.originalItem as WalkinDrive);
                      }}
                      className="btn-secondary text-xs py-1.5 px-3 flex-1 sm:flex-initial justify-center hover:border-emerald-500/40 hover:text-emerald-300"
                      title="Save to your list"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Overflow notice & View More in Job Feed */}
              {filteredNotifications.length > 5 && (
                <div className="card bg-gradient-to-r from-[#1c1c28] to-[#161622] border-dashed border-[#2a2a3d] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mt-1">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-[#f0f0ff] flex items-center justify-center sm:justify-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Showing top 5 newly updated community opportunities
                    </p>
                    <p className="text-[11px] sm:text-xs text-[#9898b8] mt-0.5">
                      {filteredNotifications.length - 5} more updates available in Job Feed
                    </p>
                  </div>
                  <Link
                    to="/job-feed"
                    className="btn-primary text-xs py-2 px-3.5 flex-shrink-0 flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                  >
                    <span>View All {filteredNotifications.length} in Job Feed</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Integrated Scoreboard & Ranks Side Layout + Handy Tools */}
        <div className="flex flex-col gap-5">
          {/* Live Scoreboard & Rank Card */}
          <div className="card bg-gradient-to-br from-indigo-950/40 via-[#1c1c28] to-[#1c1c28] border-indigo-500/30 p-4 sm:p-5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Trophy className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-[#f0f0ff] text-sm sm:text-base leading-tight">Scoreboard & Ranks</h3>
                  <p className="text-[11px] text-[#9898b8]">Live community hunter ranks</p>
                </div>
              </div>
              <Link
                to="/scoreboard"
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
              >
                Full Board <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Current User Status Banner */}
            <div className="rounded-xl bg-[#12121a]/90 border border-[#2a2a3d] p-3 mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-black text-xs text-indigo-300 flex-shrink-0">
                    {currentUserScore.rank === 1 ? '👑' : currentUserScore.rank === 2 ? '🥈' : currentUserScore.rank === 3 ? '🥉' : `#${currentUserScore.rank}`}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-[#f0f0ff] truncate">
                      {profile?.name || 'You'} <span className="text-[10px] text-indigo-400 font-normal">(You)</span>
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md border ${currentUserScore.badge.bg} ${currentUserScore.badge.color}`}>
                      {currentUserScore.badge.icon} {currentUserScore.badge.title}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-base font-black text-amber-400">{currentUserScore.totalPoints}</span>
                  <span className="text-[10px] text-[#9898b8] ml-0.5">pts</span>
                </div>
              </div>

              {/* Point stats chips */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#9898b8] pt-2 border-t border-[#2a2a3d]/80">
                <span className="truncate">💼 {currentUserScore.jobsCount} Jobs (+10 pts)</span>
                <span className="truncate text-cyan-300">📍 {currentUserScore.walkinsCount} Walk-ins (+15)</span>
              </div>
            </div>

            {/* Top Leaders Mini List */}
            <div className="mb-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#9898b8] uppercase tracking-wider mb-2 px-1">
                <span>Top Scouts</span>
                <span>Score</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {topLeaders.length === 0 ? (
                  <p className="text-xs text-[#9898b8] text-center py-2">No contributions recorded yet.</p>
                ) : (
                  topLeaders.map(item => {
                    const isMe = item.userId === user?.id;
                    return (
                      <div
                        key={item.userId}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                          isMe
                            ? 'bg-indigo-500/15 border border-indigo-500/30'
                            : 'bg-[#12121a]/60 hover:bg-[#12121a] border border-[#2a2a3d]/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-center font-bold text-[11px]">
                            {item.rank === 1 ? '👑' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                          </span>
                          <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px] text-[#f0f0ff] overflow-hidden flex-shrink-0">
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              item.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#f0f0ff] text-[11px] truncate flex items-center gap-1">
                              {item.name}
                              {isMe && <span className="text-[9px] text-indigo-400 font-normal">(You)</span>}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-amber-400 text-xs flex-shrink-0">{item.totalPoints} pts</span>
                      </div>
                    );
                  })
                )}

                {/* Show current user row at bottom if not in top 4 */}
                {!isUserInTop && currentUserScore && (
                  <div className="flex items-center justify-between p-2 rounded-lg text-xs bg-indigo-500/15 border border-indigo-500/40 mt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-center font-bold text-[11px] text-indigo-300">#{currentUserScore.rank}</span>
                      <div className="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-[10px] text-[#f0f0ff] flex-shrink-0">
                        {profile?.name ? profile.name.charAt(0).toUpperCase() : 'Y'}
                      </div>
                      <p className="font-bold text-[#f0f0ff] text-[11px] truncate">
                        {profile?.name || 'You'} <span className="text-[9px] text-indigo-400 font-normal">(You)</span>
                      </p>
                    </div>
                    <span className="font-bold text-amber-400 text-xs flex-shrink-0">{currentUserScore.totalPoints} pts</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Share to Earn Points & View Scoreboard */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#2a2a3d]">
              <Link
                to="/scoreboard"
                className="btn-primary text-xs py-2 w-full justify-center shadow-md shadow-indigo-600/20"
              >
                🏆 Open Full Leaderboard & Badges
              </Link>
              <div className="flex items-center gap-1.5">
                <Link
                  to="/applications?add=true"
                  className="btn-secondary text-[11px] py-1.5 flex-1 justify-center hover:border-indigo-500/40"
                  title="Share a job to earn 10 points"
                >
                  + Share Job (+10)
                </Link>
                <Link
                  to="/walkins?add=true"
                  className="btn-secondary text-[11px] py-1.5 flex-1 justify-center text-cyan-300 hover:border-cyan-500/40"
                  title="Share a walk-in to earn 15 points"
                >
                  + Walk-in (+15)
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Resumes & Shortcuts (Handy downside option) */}
          <div className="card p-4 border-[#2a2a3d]">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-[#9898b8] mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Handy Shortcuts & Resumes
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                to="/resumes"
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#12121a] hover:bg-[#1c1c28] border border-[#2a2a3d] hover:border-purple-500/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#f0f0ff] leading-tight">ATS Resumes</p>
                    <p className="text-[10px] text-[#9898b8]">Manage versions & tailored CVs</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#6666a0]" />
              </Link>

              <Link
                to="/analytics"
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#12121a] hover:bg-[#1c1c28] border border-[#2a2a3d] hover:border-indigo-500/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#f0f0ff] leading-tight">Analytics & Funnel</p>
                    <p className="text-[10px] text-[#9898b8]">Interviews, status & conversion</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#6666a0]" />
              </Link>
            </div>
          </div>

          {/* Walk-in Drive Reminders */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-[#f0f0ff] mb-1.5 flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" /> Walk-in Drive Reminders
            </h3>
            <p className="text-xs text-[#9898b8] mb-3">
              Get automated notifications sent straight to your email before upcoming walk-ins.
            </p>
            <Link to="/walkins" className="btn-secondary text-xs py-2 w-full justify-center">
              Manage My Walk-ins
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


