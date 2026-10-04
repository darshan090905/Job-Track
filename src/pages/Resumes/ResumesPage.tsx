import React, { useEffect, useState, useRef } from 'react';
import {
  Upload, Download, Archive, Eye, Loader2, Plus,
  FileText, Trash2, X, CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Resume } from '../../types';
import { formatDate } from '../../utils/helpers';
import ResumeViewerModal from '../../components/ResumeViewerModal';

export default function ResumesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewingResume, setViewingResume] = useState<Resume | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: '', version: '', description: '' });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    loadResumes();
  }, [user]);

  async function loadResumes() {
    setLoading(true);
    const { data } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    // Get usage counts
    const resumeData = (data || []) as Resume[];
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('resume_id')
      .eq('user_id', user!.id)
      .not('resume_id', 'is', null);

    const usageCounts: Record<string, number> = {};
    (jobsData || []).forEach(j => {
      if (j.resume_id) usageCounts[j.resume_id] = (usageCounts[j.resume_id] || 0) + 1;
    });

    setResumes(resumeData.map(r => ({ ...r, usage_count: usageCounts[r.id] || 0 })));
    setLoading(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !file) { toast('Please select a PDF file', 'error'); return; }
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file, { contentType: 'application/pdf' });
    if (uploadError) {
      toast(`Upload failed: ${uploadError.message}`, 'error');
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('resumes').insert({
      user_id: user.id,
      name: form.name,
      version: form.version,
      description: form.description,
      file_path: path,
      is_archived: false,
    });

    if (dbError) { toast('Failed to save resume record', 'error'); setUploading(false); return; }
    toast('Resume uploaded!', 'success');
    setShowAdd(false);
    setForm({ name: '', version: '', description: '' });
    setFile(null);
    setUploading(false);
    loadResumes();
  }

  function viewResume(resume: Resume) {
    if (!resume.file_path) {
      toast('Resume file not found', 'error');
      return;
    }
    setViewingResume(resume);
  }

  async function downloadResume(resume: Resume) {
    const { data } = await supabase.storage.from('resumes').createSignedUrl(resume.file_path, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = `${resume.name}-${resume.version}.pdf`;
      a.click();
    } else toast('Failed to download', 'error');
  }

  async function toggleArchive(resume: Resume) {
    const { error } = await supabase.from('resumes').update({ is_archived: !resume.is_archived }).eq('id', resume.id);
    if (error) toast('Failed to update', 'error');
    else {
      toast(resume.is_archived ? 'Resume restored!' : 'Resume archived', 'success');
      loadResumes();
    }
  }

  async function deleteResume(resume: Resume) {
    await supabase.storage.from('resumes').remove([resume.file_path]);
    const { error } = await supabase.from('resumes').delete().eq('id', resume.id);
    if (error) toast('Failed to delete', 'error');
    else { toast('Resume deleted', 'success'); loadResumes(); }
  }

  const active = resumes.filter(r => !r.is_archived);
  const archived = resumes.filter(r => r.is_archived);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Resumes</h1>
          <p className="page-subtitle mt-1">{active.length} active resume{active.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Upload Resume
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FileText className="w-7 h-7" /></div>
              <p className="text-[#f0f0ff] font-medium">No resumes yet</p>
              <p className="text-[#9898b8] text-sm">Upload your first resume to start tracking</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary"><Upload className="w-4 h-4" /> Upload Resume</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {active.map(r => <ResumeCard key={r.id} resume={r} onView={() => viewResume(r)} onDownload={() => downloadResume(r)} onArchive={() => toggleArchive(r)} onDelete={() => deleteResume(r)} />)}
            </div>
          )}

          {archived.length > 0 && (
            <div>
              <button onClick={() => setShowArchived(!showArchived)} className="text-sm text-[#9898b8] hover:text-white flex items-center gap-2 mb-3">
                <Archive className="w-4 h-4" />
                {showArchived ? 'Hide' : 'Show'} Archived ({archived.length})
              </button>
              {showArchived && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                  {archived.map(r => <ResumeCard key={r.id} resume={r} onView={() => viewResume(r)} onDownload={() => downloadResume(r)} onArchive={() => toggleArchive(r)} onDelete={() => deleteResume(r)} archived />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a3d]">
              <h2 className="text-lg font-semibold text-[#f0f0ff]">Upload Resume</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#9898b8] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="p-5 flex flex-col gap-4">
              <div className="input-group">
                <label>Resume Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="DevOps Resume" required />
              </div>
              <div className="input-group">
                <label>Version *</label>
                <input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="v3" required />
              </div>
              <div className="input-group">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="For DevOps roles at product companies" />
              </div>
              <div className="input-group">
                <label>PDF File *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#2a2a3d] hover:border-indigo-500/40 rounded-lg p-6 text-center cursor-pointer transition-colors"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-[#6666a0] mx-auto mb-2" />
                      <p className="text-sm text-[#9898b8]">Click to select PDF</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-[#2a2a3d]">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={uploading || !file} className="btn-primary flex-1 justify-center">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resume Viewer Modal */}
      {viewingResume && (
        <ResumeViewerModal
          resume={viewingResume}
          onClose={() => setViewingResume(null)}
        />
      )}
    </div>
  );
}

function ResumeCard({ resume, onView, onDownload, onArchive, onDelete, archived }: {
  resume: Resume;
  onView: () => void;
  onDownload: () => void;
  onArchive: () => void;
  onDelete: () => void;
  archived?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#f0f0ff] truncate">{resume.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="badge bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{resume.version}</span>
            {resume.usage_count !== undefined && resume.usage_count > 0 && (
              <span className="text-xs text-[#6666a0]">Used {resume.usage_count}×</span>
            )}
          </div>
        </div>
      </div>
      {resume.description && <p className="text-xs text-[#9898b8] mb-3">{resume.description}</p>}
      <p className="text-xs text-[#6666a0] mb-3">Uploaded {formatDate(resume.created_at)}</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onView} className="btn-secondary text-xs py-1 px-2.5"><Eye className="w-3.5 h-3.5" /> View</button>
        <button onClick={onDownload} className="btn-secondary text-xs py-1 px-2.5"><Download className="w-3.5 h-3.5" /> Download</button>
        <button onClick={onArchive} className="btn-secondary text-xs py-1 px-2.5">
          <Archive className="w-3.5 h-3.5" /> {archived ? 'Restore' : 'Archive'}
        </button>
        <button onClick={onDelete} className="btn-danger text-xs py-1 px-2.5 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
