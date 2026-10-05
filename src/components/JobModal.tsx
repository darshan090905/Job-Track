import React, { useState, useRef } from 'react';
import { X, Loader2, AlertTriangle, ExternalLink, Upload, FileText, Plus, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Job, Resume, JobStatus, Visibility } from '../types';
import { JOB_STATUS_LABELS, JOB_SOURCES, VISIBILITY_LABELS } from '../utils/constants';
import { normalizeJobUrl } from '../utils/helpers';

interface Props {
  job?: Job;
  resumes: Resume[];
  onClose: () => void;
  onSaved: () => void;
}

interface DuplicateMatch {
  job: Job;
  isCommunity: boolean;
  authorName?: string;
}

const statuses: JobStatus[] = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'];
const visibilities: Visibility[] = ['private', 'friends', 'everyone'];

export default function JobModal({ job, resumes: initialResumes, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [resumes, setResumes] = useState<Resume[]>(initialResumes);

  // Resume upload state
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState('');
  const [resumeVersion, setResumeVersion] = useState('v1');
  const [uploadingResume, setUploadingResume] = useState(false);

  const [form, setForm] = useState({
    company: job?.company || '',
    job_title: job?.job_title || '',
    job_url: job?.job_url || '',
    location: job?.location || '',
    source: job?.source || '',
    status: (job?.status || 'saved') as JobStatus,
    resume_id: job?.resume_id || '',
    salary: job?.salary || '',
    notes: job?.notes || '',
    applied_date: job?.applied_date || '',
    follow_up_date: job?.follow_up_date || '',
    visibility: (job?.visibility || 'private') as Visibility,
  });

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;
    setResumeFile(selectedFile);
    if (!resumeName) {
      // Auto-populate name from company/role or filename
      const defaultName = form.company 
        ? `${form.company} Resume` 
        : selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setResumeName(defaultName);
    }
  }

  async function checkDuplicate(): Promise<DuplicateMatch | null> {
    if (!user || job) return null;
    const targetNormUrl = normalizeJobUrl(form.job_url);

    // 1. Check user's own applications first
    if (form.job_url) {
      const { data: myJobs } = await supabase.from('jobs').select('*').eq('user_id', user.id);
      if (myJobs) {
        const found = myJobs.find(j => normalizeJobUrl(j.job_url) === targetNormUrl);
        if (found) return { job: found as Job, isCommunity: false };
      }
    }
    if (form.company && form.job_title) {
      const { data } = await supabase.from('jobs').select('*')
        .eq('user_id', user.id).ilike('company', form.company.trim()).ilike('job_title', form.job_title.trim()).single();
      if (data) return { job: data as Job, isCommunity: false };
    }

    // 2. Check community if sharing publicly (visibility !== 'private')
    if (form.visibility !== 'private' && form.job_url) {
      const { data: publicJobs } = await supabase.from('jobs')
        .select('*')
        .neq('user_id', user.id)
        .in('visibility', ['everyone', 'friends'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (publicJobs) {
        const found = publicJobs.find(j => normalizeJobUrl(j.job_url) === targetNormUrl);
        if (found) {
          // Fetch author name
          let authorName = 'Another member';
          const { data: authorProf } = await supabase.from('profiles').select('name').eq('id', found.user_id).single();
          if (authorProf?.name) authorName = authorProf.name;
          return { job: found as Job, isCommunity: true, authorName };
        }
      }
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent, forceAdd = false, overrideVisibility?: Visibility) {
    e.preventDefault();
    if (!user) return;

    if (!job && !forceAdd && !overrideVisibility) {
      const dup = await checkDuplicate();
      if (dup) {
        setDuplicate(dup);
        return;
      }
    }

    setLoading(true);

    let activeResumeId: string | null = form.resume_id || null;

    // If user selected a new resume file directly in this modal, upload it first
    if (resumeFile) {
      setUploadingResume(true);
      try {
        const ext = resumeFile.name.split('.').pop() || 'pdf';
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from('resumes').upload(path, resumeFile, {
          contentType: resumeFile.type || 'application/pdf',
          upsert: true
        });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast(`Resume upload failed: ${uploadError.message}`, 'error');
          setLoading(false);
          setUploadingResume(false);
          return;
        }

        const finalName = resumeName.trim() || `${form.company || 'Custom'} Resume`;
        const finalVer = resumeVersion.trim() || 'v1';

        const { data: newResume, error: dbError } = await supabase.from('resumes').insert({
          user_id: user.id,
          name: finalName,
          version: finalVer,
          description: `Used for ${form.company || 'job application'}`,
          file_path: path,
          is_archived: false,
        }).select().single();

        if (dbError) {
          toast(`Failed to save resume record: ${dbError.message}`, 'error');
          setLoading(false);
          setUploadingResume(false);
          return;
        }

        if (newResume) {
          activeResumeId = (newResume as Resume).id;
          setResumes(prev => [newResume as Resume, ...prev]);
        }
      } catch (err) {
        console.error('Resume upload error:', err);
      } finally {
        setUploadingResume(false);
      }
    }

    const payload = {
      user_id: user.id,
      company: form.company.trim(),
      job_title: form.job_title.trim(),
      job_url: form.job_url.trim(),
      location: form.location.trim() || null,
      source: form.source || null,
      status: form.status,
      resume_id: activeResumeId,
      salary: form.salary.trim() || null,
      notes: form.notes.trim() || null,
      applied_date: form.applied_date || null,
      follow_up_date: form.follow_up_date || null,
      visibility: overrideVisibility || form.visibility,
    };

    if (job) {
      const { error } = await supabase.from('jobs').update(payload).eq('id', job.id);
      if (error) { toast('Failed to update job', 'error'); setLoading(false); return; }
      toast('Job updated!', 'success');
    } else {
      const { data, error } = await supabase.from('jobs').insert(payload).select().single();
      if (error) { toast('Failed to add job', 'error'); setLoading(false); return; }
      // Add job_added event
      await supabase.from('application_events').insert({
        job_id: (data as Job).id,
        user_id: user.id,
        event_type: 'job_added',
        event_date: new Date().toISOString().split('T')[0],
      });
      if (form.status === 'applied' && form.applied_date) {
        await supabase.from('application_events').insert({
          job_id: (data as Job).id,
          user_id: user.id,
          event_type: 'application_submitted',
          event_date: form.applied_date,
        });
      }
      toast(overrideVisibility === 'private' ? 'Saved to My Applications as Private (duplicate in community)' : 'Job added!', 'success');
    }
    setLoading(false);
    onSaved();
  }

  if (duplicate) {
    return (
      <div className="modal-overlay">
        <div className="modal-content p-6 max-w-md">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#f0f0ff]">
                {duplicate.isCommunity ? 'Job Link Already in Community Feed' : 'Possible Duplicate Job'}
              </h3>
              <p className="text-xs sm:text-sm text-[#9898b8] mt-1">
                {duplicate.isCommunity
                  ? `This job link was already shared by ${duplicate.authorName || 'another community member'}.`
                  : 'This job might already be in your applications list:'}
              </p>
            </div>
          </div>
          <div className="card mb-4 bg-[#12121a] border-[#2a2a3d]">
            <p className="font-semibold text-[#f0f0ff] text-sm">{duplicate.job.company}</p>
            <p className="text-xs text-[#9898b8] mt-0.5">{duplicate.job.job_title}</p>
            {duplicate.isCommunity && (
              <span className="text-[11px] text-indigo-400 mt-2 block">
                Shared in Community • Avoids duplicate feed posts
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-col">
            {duplicate.isCommunity ? (
              <>
                <button
                  onClick={e => handleSubmit(e as React.FormEvent, true, 'private')}
                  className="btn-primary justify-center text-xs sm:text-sm py-2"
                >
                  Save as Private Application
                </button>
                <a href="/job-feed" className="btn-secondary justify-center text-xs sm:text-sm py-2">
                  <ExternalLink className="w-3.5 h-3.5" /> View in Job Feed
                </a>
              </>
            ) : (
              <>
                <a href="/applications" className="btn-secondary justify-center text-xs sm:text-sm py-2">
                  <ExternalLink className="w-3.5 h-3.5" /> View in Applications
                </a>
                <button
                  onClick={e => handleSubmit(e as React.FormEvent, true)}
                  className="btn-primary justify-center text-xs sm:text-sm py-2"
                >
                  Add Anyway
                </button>
              </>
            )}
            <button onClick={() => setDuplicate(null)} className="text-xs text-[#9898b8] hover:text-[#f0f0ff] text-center py-1.5 mt-1">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a3d]">
          <h2 className="text-lg font-semibold text-[#f0f0ff]">{job ? 'Edit Job' : 'Add Job'}</h2>
          <button onClick={onClose} className="text-[#9898b8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Required fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Company *</label>
              <input value={form.company} onChange={e => update('company', e.target.value)} placeholder="TCS" required />
            </div>
            <div className="input-group">
              <label>Job Title *</label>
              <input value={form.job_title} onChange={e => update('job_title', e.target.value)} placeholder="DevOps Engineer" required />
            </div>
          </div>

          <div className="input-group">
            <label>Job URL *</label>
            <input type="url" value={form.job_url} onChange={e => update('job_url', e.target.value)} placeholder="https://..." required />
          </div>

          {/* Location & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Location</label>
              <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Bangalore" />
            </div>
            <div className="input-group">
              <label>Source</label>
              <select value={form.source} onChange={e => update('source', e.target.value)}>
                <option value="">Select source</option>
                {JOB_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Status & Resume Used (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)}>
                {statuses.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5">
                  Resume Used 
                  <span className="text-xs text-[#6666a0] font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowResumeUpload(!showResumeUpload)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {showResumeUpload ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {showResumeUpload ? 'Select existing' : '+ Upload new'}
                </button>
              </div>

              {!showResumeUpload ? (
                <select 
                  value={form.resume_id} 
                  onChange={e => update('resume_id', e.target.value)}
                  className="w-full"
                >
                  <option value="">No resume selected</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.version})
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          {/* Inline Resume Upload Section */}
          {showResumeUpload && (
            <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col gap-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload Resume for this Job (PDF)
                </span>
                {resumeFile && (
                  <button 
                    type="button" 
                    onClick={() => { setResumeFile(null); setResumeName(''); }} 
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove file
                  </button>
                )}
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-indigo-500/30 hover:border-indigo-400/60 rounded-lg p-3 text-center cursor-pointer transition-colors bg-[#171723]/60"
              >
                {resumeFile ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-medium">
                    <CheckCircle className="w-4 h-4" />
                    <span>{resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-[#9898b8] text-xs">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Click to browse PDF resume</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                />
              </div>

              {resumeFile && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={resumeName}
                      onChange={e => setResumeName(e.target.value)}
                      placeholder="Resume Name (e.g. DevOps Resume)"
                      className="text-xs py-1.5 px-2.5 w-full"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={resumeVersion}
                      onChange={e => setResumeVersion(e.target.value)}
                      placeholder="Version (e.g. v1)"
                      className="text-xs py-1.5 px-2.5 w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Applied Date</label>
              <input type="date" value={form.applied_date} onChange={e => update('applied_date', e.target.value)} />
            </div>
            <div className="input-group">
              <label>Follow-up Date</label>
              <input type="date" value={form.follow_up_date} onChange={e => update('follow_up_date', e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>Salary</label>
            <input value={form.salary} onChange={e => update('salary', e.target.value)} placeholder="e.g. ₹8 LPA" />
          </div>

          <div className="input-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
              placeholder="Any notes about this job..." rows={2} className="resize-none" />
          </div>

          {/* Visibility */}
          <div className="input-group">
            <label>Who can see this job?</label>
            <div className="flex flex-col gap-2 mt-1">
              {visibilities.map(v => (
                <label key={v} className="flex items-center gap-2.5 cursor-pointer text-sm text-[#f0f0ff]">
                  <input type="radio" name="visibility" value={v} checked={form.visibility === v}
                    onChange={() => update('visibility', v)} className="accent-indigo-500" />
                  <span className="font-medium">{VISIBILITY_LABELS[v]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#2a2a3d] mt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading || uploadingResume} className="btn-primary flex-1 justify-center">
              {loading || uploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {uploadingResume ? 'Uploading resume...' : loading ? 'Saving...' : job ? 'Save Changes' : 'Add Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
