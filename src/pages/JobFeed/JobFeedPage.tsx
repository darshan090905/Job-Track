import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Filter, X, ExternalLink, BookmarkPlus, Loader2,
  Briefcase, MapPin, Users, Building2, Rss, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Job, WalkinDrive, Profile } from '../../types';
import { JOB_SOURCES } from '../../utils/constants';
import { formatDate, debounce } from '../../utils/helpers';

type FeedTab = 'jobs' | 'walkins';
type VisibilityTab = 'everyone' | 'friends';

export default function JobFeedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [feedTab, setFeedTab] = useState<FeedTab>('jobs');
  const [visTab, setVisTab] = useState<VisibilityTab>(searchParams.get('tab') === 'friends' ? 'friends' : 'everyone');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [walkins, setWalkins] = useState<WalkinDrive[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterFriend, setFilterFriend] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    if (!user) return;
    loadFriendsFirst();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadFeed();
  }, [user, visTab, friendIds]);

  async function loadFriendsFirst() {
    if (!user) return;
    const { data } = await supabase
      .from('friend_requests')
      .select('sender_user_id, receiver_user_id, sender:profiles!friend_requests_sender_user_id_fkey(id, name), receiver:profiles!friend_requests_receiver_user_id_fkey(id, name)')
      .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const ids: string[] = [];
    const profiles: Profile[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data || []).forEach((r: any) => {
      const friendId = r.sender_user_id === user.id ? r.receiver_user_id : r.sender_user_id;
      const rawProfile = r.sender_user_id === user.id ? r.receiver : r.sender;
      const friendProfile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
      ids.push(friendId);
      if (friendProfile) profiles.push(friendProfile as Profile);
    });
    setFriendIds(ids);
    setFriends(profiles);
  }

  async function loadFeed() {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch public / friends' jobs
      let jobsQuery = supabase
        .from('jobs')
        .select('*')
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (visTab === 'everyone') {
        jobsQuery = jobsQuery.eq('visibility', 'everyone');
      } else {
        if (friendIds.length === 0) {
          setJobs([]);
          setWalkins([]);
          setLoading(false);
          return;
        }
        jobsQuery = jobsQuery.eq('visibility', 'friends').in('user_id', friendIds);
      }

      const { data: jobsData, error: jobsErr } = await jobsQuery.limit(100);
      if (jobsErr) {
        console.error('Error fetching feed jobs:', jobsErr);
      }

      // 2. Fetch public / friends' walk-ins
      let wQuery = supabase
        .from('walkin_drives')
        .select('*')
        .neq('user_id', user.id)
        .order('date', { ascending: true })
        .gte('date', new Date().toISOString().split('T')[0]);

      if (visTab === 'everyone') {
        wQuery = wQuery.eq('visibility', 'everyone');
      } else {
        if (friendIds.length === 0) {
          setWalkins([]);
          setLoading(false);
          return;
        }
        wQuery = wQuery.eq('visibility', 'friends').in('user_id', friendIds);
      }
      const { data: wData, error: wErr } = await wQuery.limit(50);
      if (wErr) {
        console.error('Error fetching feed walkins:', wErr);
      }

      // 3. Collect author user IDs and fetch profiles
      const userIds = new Set<string>();
      (jobsData || []).forEach(j => userIds.add(j.user_id));
      (wData || []).forEach(w => userIds.add(w.user_id));

      let profileMap: Record<string, Profile> = {};
      if (userIds.size > 0) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', Array.from(userIds));

        if (profData) {
          profileMap = Object.fromEntries(profData.map(p => [p.id, p as Profile]));
        }
      }

      // Merge profile objects
      const mergedJobs = (jobsData || []).map(j => ({
        ...j,
        profile: profileMap[j.user_id] || { id: j.user_id, name: 'JobTrack Member', email: '' }
      }));

      const mergedWalkins = (wData || []).map(w => ({
        ...w,
        profile: profileMap[w.user_id] || { id: w.user_id, name: 'JobTrack Member', email: '' }
      }));

      setJobs(mergedJobs as Job[]);
      setWalkins(mergedWalkins as WalkinDrive[]);
    } catch (err) {
      console.error('loadFeed error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFeed(); }, [feedTab]);

  const debouncedSearch = useCallback(debounce((v: string) => setSearch(v), 300), []);

  function clearFilters() {
    setFilterFriend(''); setFilterCompany(''); setFilterRole('');
    setFilterLocation(''); setFilterSource(''); setFilterDate('');
  }

  const hasFilters = filterFriend || filterCompany || filterRole || filterLocation || filterSource || filterDate;

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const filteredJobs = jobs.filter(j => {
    const q = search.toLowerCase();
    const profile = j.profile as Profile | undefined;
    if (q && !`${j.company} ${j.job_title} ${j.location || ''} ${j.source || ''} ${profile?.name || ''}`.toLowerCase().includes(q)) return false;
    if (filterFriend && (j as {user_id: string}).user_id !== filterFriend) return false;
    if (filterCompany && j.company.toLowerCase() !== filterCompany.toLowerCase()) return false;
    if (filterRole && j.job_title.toLowerCase() !== filterRole.toLowerCase()) return false;
    if (filterLocation && j.location?.toLowerCase() !== filterLocation.toLowerCase()) return false;
    if (filterSource && j.source !== filterSource) return false;
    if (filterDate === 'today' && j.created_at.split('T')[0] !== today) return false;
    if (filterDate === 'week' && j.created_at.split('T')[0] < weekAgo) return false;
    if (filterDate === 'month' && j.created_at.split('T')[0] < monthAgo) return false;
    return true;
  });

  const filteredWalkins = walkins.filter(w => {
    const q = search.toLowerCase();
    const profile = w.profile as Profile | undefined;
    if (q && !`${w.company} ${w.job_title} ${w.location || ''} ${profile?.name || ''}`.toLowerCase().includes(q)) return false;
    if (filterFriend && (w as {user_id: string}).user_id !== filterFriend) return false;
    if (filterCompany && w.company.toLowerCase() !== filterCompany.toLowerCase()) return false;
    if (filterRole && w.job_title.toLowerCase() !== filterRole.toLowerCase()) return false;
    if (filterLocation && w.location?.toLowerCase() !== filterLocation.toLowerCase()) return false;
    return true;
  });

  // Dynamic filter options from jobs
  const companies = [...new Set(jobs.map(j => j.company))].sort();
  const roles = [...new Set(jobs.map(j => j.job_title))].sort();
  const locations = [...new Set(jobs.map(j => j.location).filter(Boolean))].sort();

  async function saveJobToMyApps(job: Job) {
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

  async function saveWalkinToMine(w: WalkinDrive) {
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
    else toast('Walk-in saved!', 'success');
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">🔥 Job Feed</h1>
          <p className="page-subtitle mt-1">Discover jobs shared by the community</p>
        </div>
      </div>

      {/* Feed Tabs (Jobs/Walk-ins) */}
      <div className="flex gap-2 mb-4">
        {(['jobs', 'walkins'] as FeedTab[]).map(t => (
          <button key={t} onClick={() => setFeedTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${feedTab === t ? 'bg-indigo-600 text-white' : 'bg-[#1c1c28] text-[#9898b8] border border-[#2a2a3d] hover:border-indigo-500/40'}`}>
            {t === 'jobs' ? <><Briefcase className="w-3.5 h-3.5 inline mr-1.5" />Jobs</> : <><MapPin className="w-3.5 h-3.5 inline mr-1.5" />Walk-ins</>}
          </button>
        ))}
      </div>

      {/* Visibility Tabs */}
      <div className="flex gap-2 mb-4">
        {(['everyone', 'friends'] as VisibilityTab[]).map(t => (
          <button key={t} onClick={() => setVisTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${visTab === t ? 'bg-[#232334] text-[#f0f0ff] border border-indigo-500/40' : 'text-[#9898b8] hover:text-[#f0f0ff]'}`}>
            {t === 'friends' ? <><Users className="w-3.5 h-3.5 inline mr-1" />Friends</> : t === 'everyone' ? <><Rss className="w-3.5 h-3.5 inline mr-1" />Everyone</> : t}
          </button>
        ))}
      </div>

      {/* Search & Quick Role Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
            <input
              type="text"
              placeholder="Search by role (DevOps, Software Engineer...), company, location, or friend..."
              onChange={e => debouncedSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#171723] border border-[#2a2a3d] focus:border-indigo-500 rounded-xl text-[#f0f0ff] placeholder-[#6666a0]"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? 'border-indigo-500 text-indigo-300' : ''}`}>
            <Filter className="w-3.5 h-3.5" /> More Filters {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-1" />}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm text-red-400 hover:text-red-300">
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>

        {/* Quick Role Tags */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#6666a0] font-medium flex-shrink-0">Quick Roles:</span>
          {['DevOps', 'Software', 'Frontend', 'Backend', 'Full Stack', 'Cloud', 'Data', 'QA'].map(tag => {
            const active = search.toLowerCase() === tag.toLowerCase() || filterRole.toLowerCase().includes(tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (active) {
                    setFilterRole('');
                    setSearch('');
                  } else {
                    setFilterRole('');
                    setSearch(tag);
                  }
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex-shrink-0 border ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-[#171723] text-[#9898b8] border-[#2a2a3d] hover:border-indigo-500/40 hover:text-[#f0f0ff]'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {showFilters && (
        <div className="card mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {visTab === 'friends' && friends.length > 0 && (
            <div className="input-group">
              <label>Friend</label>
              <select value={filterFriend} onChange={e => setFilterFriend(e.target.value)} className="text-sm">
                <option value="">All Friends</option>
                {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          <div className="input-group">
            <label>Company</label>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="text-sm">
              <option value="">All</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Role</label>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-sm">
              <option value="">All</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Location</label>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="text-sm">
              <option value="">All</option>
              {locations.map(l => <option key={l} value={l!}>{l}</option>)}
            </select>
          </div>
          {feedTab === 'jobs' && (
            <div className="input-group">
              <label>Source</label>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="text-sm">
                <option value="">All</option>
                {JOB_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="input-group">
            <label>Date</label>
            <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="text-sm">
              <option value="">Any time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : feedTab === 'jobs' ? (
        filteredJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Briefcase className="w-7 h-7" /></div>
            <p className="text-[#f0f0ff] font-medium">No shared jobs available</p>
            <p className="text-[#9898b8] text-sm">{visTab === 'friends' ? 'No friends have shared jobs yet.' : 'Be the first to share a job!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredJobs.map(job => {
              const profile = job.profile as Profile | undefined;
              return (
                <div key={job.id} className="card flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-300 font-bold">{job.company.charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#f0f0ff] truncate">{job.company}</p>
                      <p className="text-sm text-[#9898b8] truncate">{job.job_title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[#9898b8]">
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                    {job.source && <span>🔗 {job.source}</span>}
                    {job.salary && <span>💰 {job.salary}</span>}
                  </div>
                  <div className="text-xs text-[#6666a0]">
                    {profile && <span>Shared by <span className="text-indigo-400">{profile.name}</span> • </span>}
                    {formatDate(job.created_at)}
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-[#2a2a3d]">
                    <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs flex-1 justify-center">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Job
                    </a>
                    <button onClick={() => saveJobToMyApps(job)} className="btn-secondary text-xs flex-1 justify-center">
                      <BookmarkPlus className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        filteredWalkins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin className="w-7 h-7" /></div>
            <p className="text-[#f0f0ff] font-medium">No shared walk-ins</p>
            <p className="text-[#9898b8] text-sm">No upcoming walk-in drives have been shared yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredWalkins.map(w => {
              const profile = w.profile as Profile | undefined;
              return (
                <div key={w.id} className="card flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#f0f0ff] truncate">{w.company}</p>
                      <p className="text-sm text-[#9898b8] truncate">{w.job_title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[#9898b8]">
                    <span>📅 {formatDate(w.date)}</span>
                    {w.start_time && <span>🕐 {w.start_time}</span>}
                    {w.location && <span><MapPin className="w-3 h-3 inline" /> {w.location}</span>}
                  </div>
                  {profile && <p className="text-xs text-[#6666a0]">Shared by <span className="text-indigo-400">{profile.name}</span></p>}
                  <div className="flex gap-2 pt-1 border-t border-[#2a2a3d]">
                    {w.registration_url && (
                      <a href={w.registration_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs flex-1 justify-center">
                        <ExternalLink className="w-3.5 h-3.5" /> Register
                      </a>
                    )}
                    <button onClick={() => saveWalkinToMine(w)} className="btn-secondary text-xs flex-1 justify-center">
                      <BookmarkPlus className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
