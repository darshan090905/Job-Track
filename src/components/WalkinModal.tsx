import React, { useState, useRef } from 'react';
import { X, Loader2, Upload, Plus, CheckCircle, ChevronUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { WalkinDrive, Resume, Visibility } from '../types';
import { VISIBILITY_LABELS } from '../utils/constants';
import { normalizeJobUrl } from '../utils/helpers';

interface Props {
  walkin?: WalkinDrive;
  resumes: Resume[];
  onClose: () => void;
  onSaved: () => void;
}

interface DuplicateWalkinMatch {
  walkin: WalkinDrive;
  isCommunity: boolean;
  authorName?: string;
}

const visibilities: Visibility[] = ['private', 'friends', 'everyone'];

export default function WalkinModal({ walkin, resumes: initialResumes, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateWalkinMatch | null>(null);
  const [resumes, setResumes] = useState<Resume[]>(initialResumes);

  // Resume upload state
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState('');
  const [resumeVersion, setResumeVersion] = useState('v1');
  const [uploadingResume, setUploadingResume] = useState(false);

  const [form, setForm] = useState({
    company: walkin?.company || '',
    job_title: walkin?.job_title || '',
    date: walkin?.date || '',
    start_time: walkin?.start_time || '',
    end_time: walkin?.end_time || '',
    location: walkin?.location || '',
    address: walkin?.address || '',
    registration_url: walkin?.registration_url || '',
    resume_id: walkin?.resume_id || '',
    contact_details: walkin?.contact_details || '',
    notes: walkin?.notes || '',
    status: walkin?.status || 'upcoming',
    visibility: (walkin?.visibility || 'private') as Visibility,
    reminder_enabled: walkin?.reminder_enabled ?? true,
    reminder_days_before: walkin?.reminder_days_before ?? 1,
    email_reminder: walkin?.email_reminder ?? false,
  });

  function update(field: string, value: string | boolean | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;
    setResumeFile(selectedFile);
    if (!resumeName) {
      const defaultName = form.company 
        ? `${form.company} Walkin Resume` 
        : selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setResumeName(defaultName);
    }
  }

  async function checkDuplicate(): Promise<DuplicateWalkinMatch | null> {
    if (!user || walkin) return null;
    const targetNormUrl = form.registration_url ? normalizeJobUrl(form.registration_url) : '';

    // 1. Check user's own walk-in drives
    const { data: myWalkins } = await supabase.from('walkin_drives').select('*').eq('user_id', user.id);
    if (myWalkins) {
      if (targetNormUrl) {
        const found = myWalkins.find(w => w.registration_url && normalizeJobUrl(w.registration_url) === targetNormUrl);
        if (found) return { walkin: found as WalkinDrive, isCommunity: false };
      }
      const foundByDetails = myWalkins.find(w =>
        w.company.trim().toLowerCase() === form.company.trim().toLowerCase() &&
        w.job_title.trim().toLowerCase() === form.job_title.trim().toLowerCase() &&
        w.date === form.date
      );
      if (foundByDetails) return { walkin: foundByDetails as WalkinDrive, isCommunity: false };
    }

    // 2. Check community if sharing publicly
    if (form.visibility !== 'private') {
      const { data: publicWalkins } = await supabase.from('walkin_drives')
        .select('*')
        .neq('user_id', user.id)
        .in('visibility', ['everyone', 'friends'])
        .gte('date', new Date().toISOString().split('T')[0])
        .limit(100);

      if (publicWalkins) {
        let found: WalkinDrive | undefined;
        if (targetNormUrl) {
          found = publicWalkins.find(w => w.registration_url && normalizeJobUrl(w.registration_url) === targetNormUrl);
        }
        if (!found && form.company && form.job_title && form.date) {
          found = publicWalkins.find(w =>
            w.company.trim().toLowerCase() === form.company.trim().toLowerCase() &&
            w.job_title.trim().toLowerCase() === form.job_title.trim().toLowerCase() &&
            w.date === form.date
          );
        }
        if (found) {
          let authorName = 'Another community member';
          const { data: authorProf } = await supabase.from('profiles').select('name').eq('id', found.user_id).single();
          if (authorProf?.name) authorName = authorProf.name;
          return { walkin: found as WalkinDrive, isCommunity: true, authorName };
        }
      }
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent, forceAdd = false, overrideVisibility?: Visibility) {
    e.preventDefault();
    if (!user) return;

    if (!walkin && !forceAdd && !overrideVisibility) {
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

        const finalName = resumeName.trim() || `${form.company || 'Walk-in'} Resume`;
        const finalVer = resumeVersion.trim() || 'v1';

        const { data: newResume, error: dbError } = await supabase.from('resumes').insert({
          user_id: user.id,
          name: finalName,
          version: finalVer,
          description: `Used for ${form.company || 'walk-in drive'}`,
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
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      address: form.address.trim() || null,
      registration_url: form.registration_url.trim() || null,
      resume_id: activeResumeId,
      contact_details: form.contact_details.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      visibility: overrideVisibility || form.visibility,
      reminder_enabled: form.reminder_enabled,
      reminder_days_before: form.reminder_days_before,
      email_reminder: form.email_reminder,
      reminder_sent: false,
    };

    if (walkin) {
      const { error } = await supabase.from('walkin_drives').update(payload).eq('id', walkin.id);
      if (error) { toast('Failed to update walk-in', 'error'); setLoading(false); return; }
      toast('Walk-in updated!', 'success');
    } else {
      const { error } = await supabase.from('walkin_drives').insert(payload);
      if (error) { toast('Failed to add walk-in', 'error'); setLoading(false); return; }
      toast(overrideVisibility === 'private' ? 'Saved to My Walk-ins as Private (duplicate in community)' : 'Walk-in added!', 'success');
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
                {duplicate.isCommunity ? 'Walk-in Already in Community Feed' : 'Possible Duplicate Walk-in'}
              </h3>
              <p className="text-xs sm:text-sm text-[#9898b8] mt-1">
                {duplicate.isCommunity
                  ? `This walk-in drive was already shared by ${duplicate.authorName || 'another community member'}.`
                  : 'This walk-in drive might already be in your walk-ins list:'}
              </p>
            </div>
          </div>
          <div className="card mb-4 bg-[#12121a] border-[#2a2a3d]">
            <p className="font-semibold text-[#f0f0ff] text-sm">{duplicate.walkin.company}</p>
            <p className="text-xs text-[#9898b8] mt-0.5">{duplicate.walkin.job_title}</p>
            <span className="text-xs text-cyan-300 mt-1 block">📅 Drive Date: {duplicate.walkin.date}</span>
            {duplicate.isCommunity && (
              <span className="text-[11px] text-cyan-400 mt-2 block">
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
                  Save as Private Walk-in
                </button>
                <a href="/job-feed?tab=walkins" className="btn-secondary justify-center text-xs sm:text-sm py-2">
                  <ExternalLink className="w-3.5 h-3.5" /> View in Community Feed
                </a>
              </>
            ) : (
              <>
                <a href="/walkins" className="btn-secondary justify-center text-xs sm:text-sm py-2">
                  <ExternalLink className="w-3.5 h-3.5" /> View in My Walk-ins
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
          <h2 className="text-lg font-semibold text-[#f0f0ff]">{walkin ? 'Edit Walk-in' : 'Add Walk-in Drive'}</h2>
          <button onClick={onClose} className="text-[#9898b8] hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Company *</label>
              <input value={form.company} onChange={e => update('company', e.target.value)} placeholder="TCS" required />
            </div>
            <div className="input-group">
              <label>Job Role *</label>
              <input value={form.job_title} onChange={e => update('job_title', e.target.value)} placeholder="Software Engineer" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="input-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Start Time</label>
              <input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} />
            </div>
            <div className="input-group">
              <label>End Time</label>
              <input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} />
            </div>
          </div>

          {/* Location & Resume Used (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Location</label>
              <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Bangalore" />
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5">
                  Resume
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
                  <Upload className="w-3.5 h-3.5" /> Upload Resume for this Walk-in (PDF)
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
                      placeholder="Resume Name (e.g. Walkin Resume)"
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

          <div className="input-group">
            <label>Full Address</label>
            <textarea value={form.address} onChange={e => update('address', e.target.value)} rows={2} className="resize-none" placeholder="Full venue address..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Registration URL</label>
              <input type="url" value={form.registration_url} onChange={e => update('registration_url', e.target.value)} placeholder="https://..." />
            </div>
            <div className="input-group">
              <label>Contact / HR</label>
              <input value={form.contact_details} onChange={e => update('contact_details', e.target.value)} placeholder="HR name or phone" />
            </div>
          </div>
          <div className="input-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} className="resize-none" placeholder="Any notes..." />
          </div>

          {/* Visibility */}
          <div className="input-group">
            <label>Who can see this walk-in?</label>
            <div className="flex flex-col gap-2 mt-1">
              {visibilities.map(v => (
                <label key={v} className="flex items-center gap-2.5 cursor-pointer text-sm text-[#f0f0ff]">
                  <input type="radio" name="walkin-visibility" value={v} checked={form.visibility === v} onChange={() => update('visibility', v)} className="accent-indigo-500" />
                  <span className="font-medium">{VISIBILITY_LABELS[v]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reminders */}
          <div className="bg-[#12121a] rounded-xl p-3.5 border border-[#2a2a3d] flex flex-col gap-3">
            <p className="text-sm font-semibold text-[#f0f0ff]">Reminders & Notifications</p>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#f0f0ff]">
              <input type="checkbox" checked={form.reminder_enabled} onChange={e => update('reminder_enabled', e.target.checked)} className="accent-indigo-500 w-4 h-4" />
              Enable walk-in reminder
            </label>
            {form.reminder_enabled && (
              <>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#f0f0ff]">
                  <input type="checkbox" checked={form.email_reminder} onChange={e => update('email_reminder', e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                  <span>Send reminder to login email <span className="text-indigo-400 font-medium">({user?.email})</span></span>
                </label>
                <div className="input-group mt-1">
                  <label>Notify me</label>
                  <select value={form.reminder_days_before} onChange={e => update('reminder_days_before', parseInt(e.target.value))} className="text-sm">
                    <option value={1}>1 day before the drive</option>
                    <option value={2}>2 days before the drive</option>
                    <option value={3}>3 days before the drive</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#2a2a3d] mt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading || uploadingResume} className="btn-primary flex-1 justify-center">
              {loading || uploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {uploadingResume ? 'Uploading resume...' : loading ? 'Saving...' : walkin ? 'Save Changes' : 'Add Walk-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
