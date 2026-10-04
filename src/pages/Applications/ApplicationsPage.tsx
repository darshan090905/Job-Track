import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Filter, X, ChevronDown, ExternalLink, Edit2, Trash2,
  CheckCircle, Clock, Download, SortAsc, SortDesc, Loader2, Briefcase, FileText, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Job, Resume, JobStatus } from '../../types';
import {
  JOB_STATUS_COLORS, JOB_STATUS_LABELS, JOB_SOURCES, VISIBILITY_LABELS, VISIBILITY_COLORS
} from '../../utils/constants';
import { formatDate, downloadCSV, debounce } from '../../utils/helpers';
import JobModal from '../../components/JobModal';
import JobDetailModal from '../../components/JobDetailModal';

export default function ApplicationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(searchParams.get('add') === 'true');
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadResumes();
    loadJobs();
  }, [user]);

  async function loadResumes() {
    if (!user) return;
    const { data } = await supabase.from('resumes').select('*').eq('user_id', user.id).eq('is_archived', false).order('created_at', { ascending: false });
    setResumes((data || []) as Resume[]);
  }

  async function loadJobs() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('*, resume:resumes(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setJobs((data || []) as Job[]);
    setLoading(false);
  }

  async function viewResume(resume: Resume) {
    if (!resume.file_path) {
      toast('Resume file not found', 'error');
      return;
    }
    const { data } = await supabase.storage.from('resumes').createSignedUrl(resume.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast('Failed to open resume', 'error');
  }

  async function downloadResume(resume: Resume) {
    if (!resume.file_path) {
      toast('Resume file not found', 'error');
      return;
    }
    const { data } = await supabase.storage.from('resumes').createSignedUrl(resume.file_path, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = `${resume.name}-${resume.version}.pdf`;
      a.click();
    } else toast('Failed to download resume', 'error');
  }

  async function deleteJob(id: string) {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) toast('Failed to delete job', 'error');
    else {
      toast('Job deleted', 'success');
      setJobs(prev => prev.filter(j => j.id !== id));
    }
    setDeleteConfirm(null);
  }

  async function markApplied(job: Job) {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('jobs').update({ status: 'applied', applied_date: today }).eq('id', job.id);
    if (!error) {
      await supabase.from('application_events').insert({ job_id: job.id, user_id: user!.id, event_type: 'application_submitted', event_date: today });
      toast('Marked as applied!', 'success');
      loadJobs();
    }
  }

  function exportCSV() {
    const rows = filtered.map(j => ({
      Company: j.company,
      'Job Title': j.job_title,
      Location: j.location || '',
      URL: j.job_url,
      Source: j.source || '',
      Resume: j.resume ? `${j.resume.name} ${j.resume.version}` : '',
      Status: JOB_STATUS_LABELS[j.status],
      'Applied Date': j.applied_date ? formatDate(j.applied_date) : '',
      'Follow-up Date': j.follow_up_date ? formatDate(j.follow_up_date) : '',
      Salary: j.salary || '',
      Notes: j.notes || '',
    }));
    downloadCSV(rows, 'jobtrack-applications.csv');
  }

  // Debounced search
  const debouncedSearch = useCallback(debounce((v: string) => setSearch(v), 300), []);

  const filtered = jobs
    .filter(j => {
      const q = search.toLowerCase();
      if (q && !`${j.company} ${j.job_title} ${j.location || ''} ${j.source || ''} ${j.notes || ''} ${j.resume?.name || ''}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && j.source !== sourceFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'company_az': return a.company.localeCompare(b.company);
        case 'company_za': return b.company.localeCompare(a.company);
        case 'role_az': return a.job_title.localeCompare(b.job_title);
        case 'followup': return (a.follow_up_date || '').localeCompare(b.follow_up_date || '');
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const statuses: JobStatus[] = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-bold">My Applications</h1>
          <p className="page-subtitle mt-0.5">{jobs.length} total • {filtered.length} showing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs sm:text-sm py-2 px-3 flex-1 sm:flex-initial justify-center">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex-1 sm:flex-initial justify-center">
            <Plus className="w-4 h-4" /> Add Job
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
          <input
            type="text"
            placeholder="Search company, role, resume, notes..."
            onChange={e => debouncedSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[#171723] border border-[#2a2a3d] focus:border-indigo-500 rounded-xl text-[#f0f0ff] placeholder-[#6666a0]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-xs sm:text-sm py-2 flex-1 sm:flex-initial justify-center ${showFilters ? 'border-indigo-500 text-indigo-300' : ''}`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters {(statusFilter !== 'all' || sourceFilter !== 'all') && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-1" />}
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs sm:text-sm py-2 bg-[#1c1c28] border border-[#2a2a3d] rounded-lg text-[#f0f0ff] flex-1 sm:flex-initial"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="company_az">Company A-Z</option>
            <option value="company_za">Company Z-A</option>
            <option value="role_az">Role A-Z</option>
            <option value="followup">Follow-up Date</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="card mb-4 flex flex-wrap gap-4 p-4">
          <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
            <label className="text-xs">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs py-1.5">
              <option value="all">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
            <label className="text-xs">Source</label>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="text-xs py-1.5">
              <option value="all">All Sources</option>
              {JOB_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setStatusFilter('all'); setSourceFilter('all'); }} className="btn-secondary text-xs py-1.5">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Status tabs (quick filter) */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-[#1c1c28] text-[#9898b8] border border-[#2a2a3d] hover:border-indigo-500/40'}`}
        >
          All ({jobs.length})
        </button>
        {statuses.map(s => {
          const count = jobs.filter(j => j.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex-shrink-0 ${statusFilter === s ? JOB_STATUS_COLORS[s] : 'bg-[#1c1c28] text-[#9898b8] border-[#2a2a3d] hover:border-indigo-500/40'}`}
            >
              {JOB_STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Briefcase className="w-7 h-7" /></div>
          <div>
            <p className="text-[#f0f0ff] font-medium">{jobs.length === 0 ? 'No applications yet' : 'No matches found'}</p>
            <p className="text-[#9898b8] text-sm mt-1">{jobs.length === 0 ? 'Start tracking your job applications.' : 'Try adjusting your filters.'}</p>
          </div>
          {jobs.length === 0 && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Job
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(job => (
            <div key={job.id} className="card-hover p-4" onClick={() => setDetailJob(job)}>
              <div className="flex flex-col gap-3">
                {/* Header row: Avatar, Info, Badges & Actions */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-300 font-bold text-sm">{job.company.charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#f0f0ff] text-base leading-tight truncate">{job.company}</p>
                        <span className={`badge ${JOB_STATUS_COLORS[job.status]}`}>{JOB_STATUS_LABELS[job.status]}</span>
                        <span className={`badge ${VISIBILITY_COLORS[job.visibility]}`}>{VISIBILITY_LABELS[job.visibility]}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#9898b8] mt-0.5 truncate">{job.job_title}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {job.status === 'saved' && (
                      <button onClick={() => markApplied(job)} title="Mark Applied"
                        className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-[#9898b8] hover:text-emerald-300 transition-colors">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <a href={job.job_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-[#9898b8] hover:text-indigo-300 transition-colors"
                      title="Open Job">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => setEditJob(job)} title="Edit"
                      className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-[#9898b8] hover:text-indigo-300 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(job.id)} title="Delete"
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#9898b8] hover:text-red-300 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Pills */}
                <div className="flex flex-wrap gap-2 text-xs text-[#9898b8]">
                  {job.location && <span className="bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]">📍 {job.location}</span>}
                  {job.source && <span className="bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]">🔗 {job.source}</span>}
                  {job.applied_date && <span className="bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]">Applied: {formatDate(job.applied_date)}</span>}
                  {job.follow_up_date && <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">Follow-up: {formatDate(job.follow_up_date)}</span>}
                  {job.salary && <span className="bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]">💰 {job.salary}</span>}
                </div>

                {/* Attached Resume Bar */}
                {job.resume_id && (
                  (() => {
                    const r = resumes.find(res => res.id === job.resume_id) || (job.resume as unknown as Resume);
                    if (!r) return null;
                    return (
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#2a2a3d]/60 flex-wrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                          <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="truncate">Resume: <span className="text-[#f0f0ff] font-semibold">{r.name} ({r.version})</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => viewResume(r)}
                            className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 hover:border-indigo-500/40 text-indigo-300"
                            title="View PDF"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadResume(r)}
                            className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 hover:border-indigo-500/40 text-indigo-300"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editJob) && (
        <JobModal
          job={editJob || undefined}
          resumes={resumes}
          onClose={() => { setShowAddModal(false); setEditJob(null); }}
          onSaved={() => { setShowAddModal(false); setEditJob(null); loadJobs(); }}
        />
      )}

      {/* Detail Modal */}
      {detailJob && (
        <JobDetailModal
          job={detailJob}
          resumes={resumes}
          onClose={() => setDetailJob(null)}
          onEdit={j => { setDetailJob(null); setEditJob(j); }}
          onDeleted={() => { setDetailJob(null); loadJobs(); }}
          onUpdated={loadJobs}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-[#f0f0ff] mb-2">Delete Job</h3>
            <p className="text-[#9898b8] text-sm mb-6">Are you sure you want to delete this application? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteJob(deleteConfirm)} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

