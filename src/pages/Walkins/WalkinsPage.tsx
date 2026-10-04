import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, MapPin, Calendar, Clock, Edit2, Trash2,
  ExternalLink, CheckSquare, Loader2, ChevronDown, AlertTriangle, X, Download, Eye, FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { WalkinDrive, Resume, WalkinChecklist } from '../../types';
import { VISIBILITY_LABELS, DEFAULT_WALKIN_CHECKLIST } from '../../utils/constants';
import { formatDate, downloadCSV, isDateToday, isDateTomorrow } from '../../utils/helpers';
import WalkinModal from '../../components/WalkinModal';

export default function WalkinsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [walkins, setWalkins] = useState<WalkinDrive[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(searchParams.get('add') === 'true');
  const [editWalkin, setEditWalkin] = useState<WalkinDrive | null>(null);
  const [detailWalkin, setDetailWalkin] = useState<WalkinDrive | null>(null);
  const [checklist, setChecklist] = useState<WalkinChecklist[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadWalkins(), loadResumes()]);
    setLoading(false);
  }

  async function loadWalkins() {
    if (!user) return;
    const { data } = await supabase
      .from('walkin_drives')
      .select('*, resume:resumes(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    setWalkins((data || []) as WalkinDrive[]);
  }

  async function loadResumes() {
    if (!user) return;
    const { data } = await supabase.from('resumes').select('*').eq('user_id', user.id).eq('is_archived', false);
    setResumes((data || []) as Resume[]);
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

  async function openDetail(w: WalkinDrive) {
    setDetailWalkin(w);
    const { data } = await supabase.from('walkin_checklist').select('*').eq('walkin_id', w.id);
    if (data && data.length > 0) {
      setChecklist(data as WalkinChecklist[]);
    } else {
      // Create default checklist
      const items = DEFAULT_WALKIN_CHECKLIST.map(item => ({ walkin_id: w.id, item, completed: false }));
      const { data: created } = await supabase.from('walkin_checklist').insert(items).select();
      setChecklist((created || []) as WalkinChecklist[]);
    }
  }

  async function toggleChecklistItem(item: WalkinChecklist) {
    await supabase.from('walkin_checklist').update({ completed: !item.completed }).eq('id', item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c));
  }

  async function addChecklistItem(walkinId: string, text: string) {
    const { data } = await supabase.from('walkin_checklist').insert({ walkin_id: walkinId, item: text, completed: false }).select().single();
    if (data) setChecklist(prev => [...prev, data as WalkinChecklist]);
  }

  async function deleteWalkin(id: string) {
    await supabase.from('walkin_checklist').delete().eq('walkin_id', id);
    const { error } = await supabase.from('walkin_drives').delete().eq('id', id);
    if (error) toast('Failed to delete', 'error');
    else {
      toast('Walk-in deleted', 'success');
      setWalkins(prev => prev.filter(w => w.id !== id));
      setDetailWalkin(null);
    }
    setDeleteConfirm(null);
  }

  function exportCSV() {
    const rows = walkins.map(w => ({
      Company: w.company,
      'Job Title': w.job_title,
      Date: formatDate(w.date),
      'Start Time': w.start_time || '',
      'End Time': w.end_time || '',
      Location: w.location || '',
      Address: w.address || '',
      'Registration URL': w.registration_url || '',
      Status: w.status,
      Notes: w.notes || '',
    }));
    downloadCSV(rows, 'jobtrack-walkins.csv');
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const filtered = walkins.filter(w => {
    const q = search.toLowerCase();
    return !q || `${w.company} ${w.job_title} ${w.location || ''}`.toLowerCase().includes(q);
  });

  const todayWalkins = filtered.filter(w => w.date === today);
  const tomorrowWalkins = filtered.filter(w => w.date === tomorrow);
  const upcomingWalkins = filtered.filter(w => w.date > tomorrow);
  const pastWalkins = filtered.filter(w => w.date < today).reverse();

  const Section = ({ title, items, icon }: { title: string; items: WalkinDrive[]; icon?: React.ReactNode }) => (
    items.length > 0 ? (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h2 className="section-title text-base sm:text-lg">{title}</h2>
          <span className="text-xs text-[#9898b8] bg-[#1c1c28] border border-[#2a2a3d] px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="flex flex-col gap-3">
          {items.map(w => (
            <div key={w.id} className="card-hover p-4" onClick={() => openDetail(w)}>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#f0f0ff] text-base leading-tight truncate">{w.company}</p>
                        <span className="badge bg-cyan-500/20 text-cyan-300 border-cyan-500/30">{VISIBILITY_LABELS[w.visibility]}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#9898b8] mt-0.5 truncate">{w.job_title}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {w.registration_url && (
                      <a href={w.registration_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-[#9898b8] hover:text-indigo-300 transition-colors"
                        title="Open Registration">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => setEditWalkin(w)} className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-[#9898b8] hover:text-indigo-300 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#9898b8] hover:text-red-300 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-[#9898b8]">
                  <span className="flex items-center gap-1 bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]"><Calendar className="w-3 h-3 text-cyan-400" />{formatDate(w.date)}</span>
                  {w.start_time && <span className="flex items-center gap-1 bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]"><Clock className="w-3 h-3" />{w.start_time}{w.end_time ? ` – ${w.end_time}` : ''}</span>}
                  {w.location && <span className="flex items-center gap-1 bg-[#12121a] px-2 py-0.5 rounded border border-[#2a2a3d]"><MapPin className="w-3 h-3" />{w.location}</span>}
                </div>

                {w.resume_id && (
                  (() => {
                    const r = resumes.find(res => res.id === w.resume_id) || (w.resume as unknown as Resume);
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
      </div>
    ) : null
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-bold">My Walk-ins</h1>
          <p className="page-subtitle mt-0.5">{walkins.length} total walk-in drives</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs sm:text-sm py-2 px-3 flex-1 sm:flex-initial justify-center">Export CSV</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex-1 sm:flex-initial justify-center">
            <Plus className="w-4 h-4" /> Add Walk-in
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
        <input
          type="text"
          placeholder="Search company, role, location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[#171723] border border-[#2a2a3d] focus:border-indigo-500 rounded-xl text-[#f0f0ff] placeholder-[#6666a0] max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : walkins.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MapPin className="w-7 h-7" /></div>
          <p className="text-[#f0f0ff] font-medium">No walk-in drives yet</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs sm:text-sm mt-2"><Plus className="w-4 h-4" /> Add Walk-in</button>
        </div>
      ) : (
        <>
          <Section title="Today" items={todayWalkins} icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} />
          <Section title="Tomorrow" items={tomorrowWalkins} icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} />
          <Section title="Upcoming" items={upcomingWalkins} icon={<Calendar className="w-4 h-4 text-indigo-400" />} />
          <Section title="Past" items={pastWalkins} icon={<Clock className="w-4 h-4 text-[#9898b8]" />} />
        </>
      )}


      {/* Detail Sidebar/Modal */}
      {detailWalkin && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a3d]">
              <div>
                <h2 className="text-lg font-semibold text-[#f0f0ff]">{detailWalkin.company}</h2>
                <p className="text-sm text-[#9898b8]">{detailWalkin.job_title}</p>
              </div>
              <button onClick={() => setDetailWalkin(null)} className="text-[#9898b8] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-[#9898b8]"><Calendar className="w-4 h-4 text-indigo-400" />{formatDate(detailWalkin.date)}</div>
                {detailWalkin.start_time && <div className="flex items-center gap-2 text-[#9898b8]"><Clock className="w-4 h-4 text-indigo-400" />{detailWalkin.start_time}{detailWalkin.end_time ? ` – ${detailWalkin.end_time}` : ''}</div>}
                {detailWalkin.location && <div className="flex items-center gap-2 text-[#9898b8]"><MapPin className="w-4 h-4 text-indigo-400" />{detailWalkin.location}</div>}
                {detailWalkin.contact_details && <div className="flex items-center gap-2 text-[#9898b8]">Contact: {detailWalkin.contact_details}</div>}
              </div>
              {detailWalkin.address && (
                <div className="bg-[#12121a] p-3 rounded-lg text-sm text-[#9898b8]">
                  <p className="text-xs font-medium text-[#6666a0] mb-1">FULL ADDRESS</p>
                  {detailWalkin.address}
                </div>
              )}
              {detailWalkin.notes && (
                <div className="bg-[#12121a] p-3 rounded-lg text-sm text-[#9898b8]">
                  <p className="text-xs font-medium text-[#6666a0] mb-1">NOTES</p>
                  {detailWalkin.notes}
                </div>
              )}

              {/* Checklist */}
              <div>
                <h3 className="section-title text-base mb-3">Preparation Checklist</h3>
                <div className="flex flex-col gap-2">
                  {checklist.map(item => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer text-sm">
                      <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(item)} className="accent-indigo-500 w-4 h-4" />
                      <span className={item.completed ? 'line-through text-[#6666a0]' : 'text-[#f0f0ff]'}>{item.item}</span>
                    </label>
                  ))}
                </div>
                <NewChecklistItemInput onAdd={(text) => addChecklistItem(detailWalkin.id, text)} />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#2a2a3d]">
                {detailWalkin.registration_url && (
                  <a href={detailWalkin.registration_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex-1 justify-center">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Registration
                  </a>
                )}
                <button onClick={() => { setDetailWalkin(null); setEditWalkin(detailWalkin); }} className="btn-secondary text-sm flex-1 justify-center">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(showAdd || editWalkin) && (
        <WalkinModal
          walkin={editWalkin || undefined}
          resumes={resumes}
          onClose={() => { setShowAdd(false); setEditWalkin(null); }}
          onSaved={() => { setShowAdd(false); setEditWalkin(null); loadAll(); }}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-[#f0f0ff] mb-2">Delete Walk-in</h3>
            <p className="text-[#9898b8] text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteWalkin(deleteConfirm)} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewChecklistItemInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  }
  return (
    <div className="flex gap-2 mt-3">
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Add custom item..." className="flex-1 text-sm py-1.5"
        onKeyDown={e => e.key === 'Enter' && submit()} />
      <button onClick={submit} className="btn-secondary text-sm py-1.5 px-3">Add</button>
    </div>
  );
}
