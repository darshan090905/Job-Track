import React, { useEffect, useState } from 'react';
import {
  Trophy, Medal, Flame, Award, Sparkles, TrendingUp,
  Briefcase, MapPin, Plus, Share2, Crown, Loader2, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Profile } from '../types';

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

interface ScoreboardProps {
  onAddJob?: () => void;
  onAddWalkin?: () => void;
}

export default function Scoreboard({ onAddJob, onAddWalkin }: ScoreboardProps) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<ContributorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCommunityJobs, setTotalCommunityJobs] = useState(0);
  const [totalCommunityWalkins, setTotalCommunityWalkins] = useState(0);

  useEffect(() => {
    loadLeaderboard();
  }, [user]);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      // 1. Fetch public & shared jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('user_id, visibility')
        .in('visibility', ['everyone', 'friends']);

      // 2. Fetch public & shared walk-in drives
      const { data: walkinsData } = await supabase
        .from('walkin_drives')
        .select('user_id, visibility')
        .in('visibility', ['everyone', 'friends']);

      const jobs = jobsData || [];
      const walkins = walkinsData || [];

      setTotalCommunityJobs(jobs.length);
      setTotalCommunityWalkins(walkins.length);

      // Count per user
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

      // Fetch profiles
      const userIdsArray = Array.from(allUserIds);
      let profileMap: Record<string, Profile> = {};

      if (userIdsArray.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', userIdsArray);

        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p as Profile]));
        }
      }

      // Calculate score: 10 pts per Job, 15 pts per Walk-in Drive
      const scores: ContributorScore[] = userIdsArray.map(id => {
        const jobsCount = userJobCounts[id] || 0;
        const walkinsCount = userWalkinCounts[id] || 0;
        const totalPoints = (jobsCount * 10) + (walkinsCount * 15);
        const p = profileMap[id];
        const name = p?.name || (id === user?.id ? 'You' : 'Anonymous Scout');

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

      // Sort by totalPoints descending, then total jobs
      scores.sort((a, b) => b.totalPoints - a.totalPoints || b.jobsCount - a.jobsCount);

      // Assign ranks
      scores.forEach((s, idx) => {
        s.rank = idx + 1;
      });

      setLeaderboard(scores);
    } catch (err) {
      console.error('Error loading scoreboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function getBadge(points: number) {
    if (points >= 100) return { title: 'Legendary Scout', icon: '👑', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' };
    if (points >= 50) return { title: 'Master Contributor', icon: '🏆', color: 'text-purple-600 dark:text-purple-300', bg: 'bg-purple-500/10 border-purple-500/30' };
    if (points >= 25) return { title: 'Community Star', icon: '⭐', color: 'text-indigo-600 dark:text-indigo-300', bg: 'bg-indigo-500/10 border-indigo-500/30' };
    if (points >= 10) return { title: 'Active Scout', icon: '🚀', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    return { title: 'New Scout', icon: '🌱', color: 'text-slate-600 dark:text-[#9898b8]', bg: 'bg-slate-100 dark:bg-[#1c1c28] border-slate-200 dark:border-[#2a2a3d]' };
  }

  const currentUserStats = leaderboard.find(s => s.userId === user?.id);
  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-[#9898b8]">Calculating community leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Motivation Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-100 dark:from-indigo-950/60 dark:via-purple-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/20 p-5 sm:p-6 shadow-sm dark:shadow-none">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                <Trophy className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#f0f0ff]">Community Job Hunters Scoreboard</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9898b8] max-w-xl">
              Help your peers find their dream jobs! Share job openings & walk-in drives in Job Feed to earn scout points, unlock badges, and top the leaderboard.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {onAddJob && (
              <button
                onClick={onAddJob}
                className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex-1 sm:flex-initial justify-center shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" /> Share a Job (+10 pts)
              </button>
            )}
            {onAddWalkin && (
              <button
                onClick={onAddWalkin}
                className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4 flex-1 sm:flex-initial justify-center"
              >
                <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Share Walk-in (+15 pts)
              </button>
            )}
          </div>
        </div>

        {/* Total stats counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-[#2a2a3d]/80">
          <div className="bg-white/90 dark:bg-[#12121a]/80 backdrop-blur rounded-xl p-3 border border-indigo-100 dark:border-[#2a2a3d] shadow-sm dark:shadow-none">
            <p className="text-xs text-slate-500 dark:text-[#9898b8]">Total Community Jobs</p>
            <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{totalCommunityJobs}</p>
          </div>
          <div className="bg-white/90 dark:bg-[#12121a]/80 backdrop-blur rounded-xl p-3 border border-indigo-100 dark:border-[#2a2a3d] shadow-sm dark:shadow-none">
            <p className="text-xs text-slate-500 dark:text-[#9898b8]">Total Walk-in Drives</p>
            <p className="text-lg sm:text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{totalCommunityWalkins}</p>
          </div>
          <div className="bg-white/90 dark:bg-[#12121a]/80 backdrop-blur rounded-xl p-3 border border-indigo-100 dark:border-[#2a2a3d] shadow-sm dark:shadow-none">
            <p className="text-xs text-slate-500 dark:text-[#9898b8]">Active Contributors</p>
            <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{leaderboard.filter(l => l.totalPoints > 0).length}</p>
          </div>
          <div className="bg-white/90 dark:bg-[#12121a]/80 backdrop-blur rounded-xl p-3 border border-indigo-100 dark:border-[#2a2a3d] shadow-sm dark:shadow-none">
            <p className="text-xs text-slate-500 dark:text-[#9898b8]">Your Current Rank</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {currentUserStats?.rank ? `#${currentUserStats.rank}` : 'Unranked'}
            </p>
          </div>
        </div>
      </div>

      {/* Your Personal Contribution Status */}
      {currentUserStats && (
        <div className="card bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white dark:from-[#171726] dark:to-[#1c1c28] border-indigo-200 dark:border-indigo-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-lg font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
              #{currentUserStats.rank}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-[#f0f0ff] text-base">{currentUserStats.name} (You)</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${currentUserStats.badge.bg} ${currentUserStats.badge.color}`}>
                  {currentUserStats.badge.icon} {currentUserStats.badge.title}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9898b8] mt-1">
                You shared <span className="text-slate-900 dark:text-[#f0f0ff] font-medium">{currentUserStats.jobsCount} jobs</span> and <span className="text-slate-900 dark:text-[#f0f0ff] font-medium">{currentUserStats.walkinsCount} walk-ins</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 dark:border-[#2a2a3d]">
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500 dark:text-[#9898b8]">Your Score</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{currentUserStats.totalPoints} <span className="text-xs font-normal text-slate-500 dark:text-[#9898b8]">pts</span></p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500 dark:text-[#9898b8]">Next Goal</p>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-1">
                {currentUserStats.totalPoints < 10 ? 'Share 1 job (+10 pts)' :
                 currentUserStats.totalPoints < 25 ? `${25 - currentUserStats.totalPoints} pts to ⭐ Star` :
                 currentUserStats.totalPoints < 50 ? `${50 - currentUserStats.totalPoints} pts to 🏆 Master` :
                 `${100 - currentUserStats.totalPoints} pts to 👑 Legendary`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && topThree.some(t => t.totalPoints > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h3 className="font-semibold text-slate-900 dark:text-[#f0f0ff] text-sm uppercase tracking-wider">Top Contributors</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topThree.map((contributor) => {
              const isFirst = contributor.rank === 1;
              const isSecond = contributor.rank === 2;
              const isThird = contributor.rank === 3;

              const borderColor = isFirst
                ? 'border-amber-300 dark:border-amber-500/50 bg-gradient-to-b from-amber-50/90 to-white dark:from-amber-950/20 dark:to-[#1c1c28]'
                : isSecond
                ? 'border-slate-300 dark:border-slate-400/40 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/40 dark:to-[#1c1c28]'
                : 'border-amber-200 dark:border-amber-700/40 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/10 dark:to-[#1c1c28]';

              const medalColor = isFirst ? 'text-amber-600 dark:text-amber-400' : isSecond ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-600';
              const rankIcon = isFirst ? '👑' : isSecond ? '🥈' : '🥉';

              return (
                <div
                  key={contributor.userId}
                  className={`card relative overflow-hidden border p-4 sm:p-5 flex flex-col justify-between shadow-sm dark:shadow-none ${borderColor}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-base text-indigo-700 dark:text-[#f0f0ff] overflow-hidden">
                          {contributor.avatarUrl ? (
                            <img src={contributor.avatarUrl} alt={contributor.name} className="w-full h-full object-cover" />
                          ) : (
                            contributor.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="absolute -bottom-1 -right-1 text-sm">{rankIcon}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-[#f0f0ff] text-sm sm:text-base flex items-center gap-1.5">
                          {contributor.name}
                          {contributor.userId === user?.id && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">(You)</span>}
                        </p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${contributor.badge.bg} ${contributor.badge.color}`}>
                          {contributor.badge.icon} {contributor.badge.title}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-black ${medalColor}`}>#{contributor.rank}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-[#2a2a3d]/60 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-[#9898b8]">Jobs</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#f0f0ff]">{contributor.jobsCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-[#9898b8]">Walk-ins</p>
                      <p className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400">{contributor.walkinsCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-[#9898b8]">Points</p>
                      <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">{contributor.totalPoints}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="card p-0 overflow-hidden shadow-sm dark:shadow-none">
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-[#2a2a3d] flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-[#f0f0ff] text-sm flex items-center gap-2">
            <Medal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> All Community Scouts
          </h3>
          <span className="text-xs text-slate-500 dark:text-[#9898b8]">{leaderboard.length} members</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-[#9898b8] text-sm">
            No community contributions yet. Be the first to share a job!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-[#171723] text-slate-600 dark:text-[#9898b8] text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#2a2a3d]">
                <tr>
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Contributor</th>
                  <th className="py-3 px-4 text-center">Jobs Shared</th>
                  <th className="py-3 px-4 text-center">Walk-ins</th>
                  <th className="py-3 px-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2a2a3d]/50">
                {leaderboard.map((item) => {
                  const isMe = item.userId === user?.id;
                  return (
                    <tr
                      key={item.userId}
                      className={`hover:bg-slate-50 dark:hover:bg-[#232334]/50 transition-colors ${isMe ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''}`}
                    >
                      <td className="py-3 px-4 font-bold">
                        {item.rank === 1 ? <span className="text-amber-600 dark:text-amber-400">👑 #1</span> :
                         item.rank === 2 ? <span className="text-slate-600 dark:text-slate-300">🥈 #2</span> :
                         item.rank === 3 ? <span className="text-amber-700 dark:text-amber-600">🥉 #3</span> :
                         <span className="text-slate-500 dark:text-[#9898b8]">#{item.rank}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-[#f0f0ff] overflow-hidden flex-shrink-0">
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              item.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-[#f0f0ff] flex items-center gap-1.5">
                              {item.name}
                              {isMe && <span className="text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.2 rounded font-normal">You</span>}
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-[#9898b8]">{item.badge.icon} {item.badge.title}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-900 dark:text-[#f0f0ff]">
                        {item.jobsCount}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-cyan-600 dark:text-cyan-400">
                        {item.walkinsCount}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                        {item.totalPoints} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
