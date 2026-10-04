import React, { useEffect, useState } from 'react';
import {
  X, ExternalLink, Edit2, Trash2, Plus, CheckCircle, Clock,
  MapPin, FileText, Calendar, Loader2, ChevronDown, Download, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Job, Resume, ApplicationEvent } from '../types';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, VISIBILITY_LABELS, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '../utils/constants';
import { formatDate } from '../utils/helpers';
import ResumeViewerModal from './ResumeViewerModal';

interface Props {
  job: Job;
  resumes: Resume[];
  onClose: () => void;
  onEdit: (job: Job) => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function JobDetailModal({ job, resumes, onClose, onEdit, onDeleted, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ event_type: 'custom', event_date: new Date().toISOString().split('T')[0], notes: '' });
  const [deleting, setDeleting] = useState(false);
  const [viewingResume, setViewingResume] = useState<Resume | null>(null);

  useEffect(() => {
    loadEvents();
  }, [job.id]);

  async function loadEvents() {
    setLoadingEvents(true);
    const { data } = await supabase.from('application_events').select('*')
      .eq('job_id', job.id).order('event_date', { ascending: true });
    setEvents((data || []) as ApplicationEvent[]);
    setLoadingEvents(false);
  }

  async function markApplied() {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('jobs').update({ status: 'applied', applied_date: today }).eq('id', job.id);
    await supabase.from('application_events').insert({ job_id: job.id, user_id: user!.id, event_type: 'application_submitted', event_date: today });
    toast('Marked as applied!', 'success');
    loadEvents();
    onUpdated();
  }

  async function addEvent() {
    if (!user || !newEvent.event_date) return;
    const { error } = await supabase.from('application_events').insert({
      job_id: job.id,
      user_id: user.id,
      ...newEvent,
    });
    if (error) { toast('Failed to add event', 'error'); return; }
    toast('Event added!', 'success');
    setAddingEvent(false);
    setNewEvent({ event_type: 'custom', event_date: new Date().toISOString().split('T')[0], notes: '' });
    loadEvents();
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from('application_events').delete().eq('job_id', job.id);
    await supabase.from('jobs').delete().eq('id', job.id);
    toast('Job deleted', 'success');
    setDeleting(false);
    onDeleted();
  }

  const resume = resumes.find(r => r.id === job.resume_id) || (job.resume as unknown as Resume);

  function viewResume() {
    if (!resume?.file_path) {
      toast('Resume file not found', 'error');
      return;
    }
    setViewingResume(resume);
  }

  async function downloadResume() {
    if (!resume?.file_path) {
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

  const eventTypes = [
    'job_added', 'application_submitted', 'assessment_received', 'assessment_completed',
    'interview', 'offer', 'rejected', 'custom'
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#2a2a3d]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-300 font-bold">{job.company.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#f0f0ff]">{job.company}</h2>
              <p className="text-[#9898b8] text-sm">{job.job_title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${JOB_STATUS_COLORS[job.status]}`}>{JOB_STATUS_LABELS[job.status]}</span>
            <button onClick={onClose} className="text-[#9898b8] hover:text-white transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Job details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {job.location && (
              <div className="flex items-center gap-2 text-[#9898b8]">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>{job.location}</span>
              </div>
            )}
            {job.source && (
              <div className="flex items-center gap-2 text-[#9898b8]">
                <span className="text-indigo-400">🔗</span>
                <span>{job.source}</span>
              </div>
            )}
            {job.applied_date && (
              <div className="flex items-center gap-2 text-[#9898b8]">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Applied: {formatDate(job.applied_date)}</span>
              </div>
            )}
            {job.follow_up_date && (
              <div className="flex items-center gap-2 text-amber-400">
                <Clock className="w-4 h-4" />
                <span>Follow-up: {formatDate(job.follow_up_date)}</span>
              </div>
            )}
            {job.salary && (
              <div className="flex items-center gap-2 text-[#9898b8]">
                <span>💰</span>
                <span>{job.salary}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[#9898b8]">
              <span>👁</span>
              <span>{VISIBILITY_LABELS[job.visibility]}</span>
            </div>
          </div>

          {/* Dedicated Resume Box */}
          {resume && (
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-[#9898b8]">Resume Used</p>
                  <p className="text-sm font-semibold text-[#f0f0ff]">{resume.name} <span className="text-xs text-indigo-300 font-normal">({resume.version})</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={viewResume}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-indigo-500/40 text-indigo-300"
                >
                  <Eye className="w-3.5 h-3.5" /> View PDF
                </button>
                <button
                  type="button"
                  onClick={downloadResume}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-indigo-500/40 text-indigo-300"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            </div>
          )}

          {job.notes && (
            <div className="bg-[#12121a] rounded-lg p-3 text-sm text-[#9898b8]">
              <p className="text-xs text-[#6666a0] mb-1 font-medium">NOTES</p>
              <p className="whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
              <ExternalLink className="w-3.5 h-3.5" /> Open Job
            </a>
            {job.status === 'saved' && (
              <button onClick={markApplied} className="btn-secondary text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> Mark as Applied
              </button>
            )}
            <button onClick={() => onEdit(job)} className="btn-secondary text-sm">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger text-sm ml-auto">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          </div>

          {/* Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title text-base">Timeline</h3>
              <button onClick={() => setAddingEvent(!addingEvent)} className="btn-secondary text-xs py-1 px-2.5">
                <Plus className="w-3 h-3" /> Add Event
              </button>
            </div>

            {addingEvent && (
              <div className="card mb-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="input-group">
                    <label>Event Type</label>
                    <select value={newEvent.event_type} onChange={e => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))} className="text-sm">
                      {eventTypes.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t] || t}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Date</label>
                    <input type="date" value={newEvent.event_date} onChange={e => setNewEvent(prev => ({ ...prev, event_date: e.target.value }))} className="text-sm" />
                  </div>
                </div>
                <div className="input-group">
                  <label>Notes</label>
                  <textarea value={newEvent.notes} onChange={e => setNewEvent(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="text-sm resize-none" placeholder="Optional notes..." />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingEvent(false)} className="btn-secondary text-xs flex-1 justify-center">Cancel</button>
                  <button onClick={addEvent} className="btn-primary text-xs flex-1 justify-center">Add Event</button>
                </div>
              </div>
            )}

            {loadingEvents ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            ) : events.length === 0 ? (
              <p className="text-sm text-[#9898b8] text-center py-4">No timeline events yet.</p>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#2a2a3d]" />
                {events.map((ev, i) => (
                  <div key={ev.id} className="relative flex items-start gap-3 mb-4">
                    <div className={`absolute left-0 w-3.5 h-3.5 rounded-full -translate-x-[3px] mt-0.5 ${EVENT_TYPE_COLORS[ev.event_type] || 'bg-indigo-500'}`} />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#f0f0ff]">{EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}</p>
                      <p className="text-xs text-[#9898b8]">{formatDate(ev.event_date)}</p>
                      {ev.notes && <p className="text-xs text-[#9898b8] mt-0.5 italic">{ev.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
