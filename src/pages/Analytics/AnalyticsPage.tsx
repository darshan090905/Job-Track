import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { Loader2, BarChart2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JOB_STATUS_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    statusDist: [] as { name: string; value: number }[],
    bySource: [] as { source: string; count: number }[],
    byRole: [] as { role: string; count: number }[],
    overTime: [] as { date: string; count: number }[],
    resumeUsage: [] as { resume: string; count: number }[],
    savedFromFeed: 0,
  });

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  async function loadAnalytics() {
    setLoading(true);
    const { data: jobs } = await supabase
      .from('jobs')
      .select('status, source, job_title, applied_date, created_at, resume_id, source_shared_job_id, resume:resumes(name, version)')
      .eq('user_id', user!.id);

    if (!jobs) { setLoading(false); return; }

    // Status distribution
    const statusCounts: Record<string, number> = {};
    jobs.forEach(j => { statusCounts[j.status] = (statusCounts[j.status] || 0) + 1; });
    const statusDist = Object.entries(statusCounts).map(([k, v]) => ({ name: JOB_STATUS_LABELS[k as keyof typeof JOB_STATUS_LABELS] || k, value: v }));

    // By source
    const sourceCounts: Record<string, number> = {};
    jobs.forEach(j => { const s = j.source || 'Unknown'; sourceCounts[s] = (sourceCounts[s] || 0) + 1; });
    const bySource = Object.entries(sourceCounts).sort(([,a],[,b]) => b - a).map(([source, count]) => ({ source, count }));

    // By role (top 10)
    const roleCounts: Record<string, number> = {};
    jobs.forEach(j => { roleCounts[j.job_title] = (roleCounts[j.job_title] || 0) + 1; });
    const byRole = Object.entries(roleCounts).sort(([,a],[,b]) => b - a).slice(0, 10).map(([role, count]) => ({ role, count }));

    // Over time (last 30 days)
    const dateCounts: Record<string, number> = {};
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    jobs.filter(j => j.created_at >= cutoff).forEach(j => {
      const d = j.created_at.split('T')[0];
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });
    const overTime = Object.entries(dateCounts).sort(([a],[b]) => a.localeCompare(b)).map(([date, count]) => ({ date: date.slice(5), count }));

    // Resume usage
    const resumeCounts: Record<string, number> = {};
    jobs.forEach(j => {
      if (j.resume) {
        const resumeObj = Array.isArray(j.resume) ? (j.resume as unknown as Array<{ name?: string; version?: string }>)[0] : (j.resume as unknown as { name?: string; version?: string });
        if (resumeObj?.name) {
          const key = `${resumeObj.name} ${resumeObj.version || ''}`.trim();
          resumeCounts[key] = (resumeCounts[key] || 0) + 1;
        }
      }
    });
    const resumeUsage = Object.entries(resumeCounts).sort(([,a],[,b]) => b - a).map(([resume, count]) => ({ resume, count }));

    // Saved from feed
    const savedFromFeed = jobs.filter(j => j.source_shared_job_id).length;

    setStats({ total: jobs.length, statusDist, bySource, byRole, overTime, resumeUsage, savedFromFeed });
    setLoading(false);
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {value:number;name:string}[]; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[#1c1c28] border border-[#2a2a3d] rounded-lg px-3 py-2 text-xs">
          <p className="text-[#9898b8]">{label}</p>
          {payload.map((p, i) => <p key={i} className="text-[#f0f0ff] font-medium">{p.name}: {p.value}</p>)}
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  if (stats.total === 0) return (
    <div className="p-6">
      <h1 className="page-title mb-6">Analytics</h1>
      <div className="empty-state">
        <div className="empty-state-icon"><BarChart2 className="w-7 h-7" /></div>
        <p className="text-[#f0f0ff] font-medium">No data yet</p>
        <p className="text-[#9898b8] text-sm">Add some job applications to see analytics.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="page-title mb-6">Analytics</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="stat-card"><span className="text-xs text-[#9898b8]">Total Applications</span><p className="text-2xl font-bold text-indigo-400">{stats.total}</p></div>
        <div className="stat-card"><span className="text-xs text-[#9898b8]">Saved from Feed</span><p className="text-2xl font-bold text-cyan-400">{stats.savedFromFeed}</p></div>
        <div className="stat-card"><span className="text-xs text-[#9898b8]">Offers</span><p className="text-2xl font-bold text-emerald-400">{stats.statusDist.find(s => s.name === 'Offer')?.value || 0}</p></div>
        <div className="stat-card"><span className="text-xs text-[#9898b8]">Resumes Used</span><p className="text-2xl font-bold text-purple-400">{stats.resumeUsage.length}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        {stats.statusDist.length > 0 && (
          <div className="card">
            <h2 className="section-title mb-4">Application Status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.statusDist} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {stats.statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By Source */}
        {stats.bySource.length > 0 && (
          <div className="card">
            <h2 className="section-title mb-4">Applications by Source</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.bySource} layout="vertical">
                <XAxis type="number" tick={{ fill: '#9898b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="source" width={80} tick={{ fill: '#9898b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Over Time */}
        {stats.overTime.length > 1 && (
          <div className="card lg:col-span-2">
            <h2 className="section-title mb-4">Applications Over Time (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
                <XAxis dataKey="date" tick={{ fill: '#9898b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9898b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Applications" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Resume Usage */}
        {stats.resumeUsage.length > 0 && (
          <div className="card">
            <h2 className="section-title mb-4">Resume Usage</h2>
            <div className="flex flex-col gap-2">
              {stats.resumeUsage.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#f0f0ff] truncate">{r.resume}</p>
                    <div className="h-1.5 bg-[#2a2a3d] rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.count / stats.resumeUsage[0].count) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-indigo-400 flex-shrink-0">{r.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Roles */}
        {stats.byRole.length > 0 && (
          <div className="card">
            <h2 className="section-title mb-4">Top Job Roles</h2>
            <div className="flex flex-col gap-2">
              {stats.byRole.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-sm text-[#f0f0ff] truncate flex-1">{r.role}</p>
                  <span className="badge bg-indigo-500/20 text-indigo-300 border-indigo-500/30 ml-2">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
