import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Resume } from '../types';
import { useToast } from '../hooks/useToast';

interface ResumeViewerModalProps {
  resume: Resume;
  onClose: () => void;
}

export default function ResumeViewerModal({ resume, onClose }: ResumeViewerModalProps) {
  const { toast } = useToast();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useFallbackViewer, setUseFallbackViewer] = useState(false);

  useEffect(() => {
    loadSignedUrl();
  }, [resume]);

  async function loadSignedUrl() {
    if (!resume.file_path) {
      toast('Resume file not found', 'error');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .createSignedUrl(resume.file_path, 3600); // 1 hour validity

      if (error || !data?.signedUrl) {
        toast('Failed to load resume document', 'error');
      } else {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error(err);
      toast('Error loading resume', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!signedUrl) return;
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = `${resume.name}-${resume.version || 'v1'}.pdf`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Google Docs viewer URL for flawless rendering on mobile devices (Android/iOS)
  const gdocsUrl = signedUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`
    : '';

  return (
    <div className="modal-overlay p-2 sm:p-4 z-50">
      <div className="modal-content max-w-4xl w-full h-[92vh] flex flex-col rounded-2xl bg-[#171723] border border-[#2a2a3d] overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#2a2a3d] bg-[#12121a]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#f0f0ff] text-sm sm:text-base truncate">
                {resume.name} {resume.version ? `(${resume.version})` : ''}
              </h3>
              <p className="text-[11px] text-[#9898b8] truncate">In-app Document Preview</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Viewer Mode toggle */}
            <button
              onClick={() => setUseFallbackViewer(!useFallbackViewer)}
              className="btn-secondary text-[11px] sm:text-xs py-1.5 px-2 text-[#9898b8] hover:text-[#f0f0ff]"
              title="Switch PDF viewer engine"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">{useFallbackViewer ? 'Direct PDF' : 'Docs View'}</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="btn-secondary text-[11px] sm:text-xs py-1.5 px-2.5 text-indigo-300"
              title="Download Resume"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9898b8] hover:text-white hover:bg-[#232334] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Body Container */}
        <div className="flex-1 bg-[#0f0f13] relative overflow-hidden flex flex-col items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-[#9898b8]">Loading resume document...</p>
            </div>
          ) : !signedUrl ? (
            <div className="text-center p-6">
              <FileText className="w-10 h-10 text-[#6666a0] mx-auto mb-2" />
              <p className="text-[#f0f0ff] font-medium text-sm">Unable to load document</p>
              <p className="text-[#9898b8] text-xs mt-1">The resume file might be missing or expired.</p>
            </div>
          ) : (
            <div className="w-full h-full relative">
              {/* If useFallbackViewer or on small mobile screens, Google Docs Viewer renders inline without prompting Android download manager */}
              {useFallbackViewer ? (
                <iframe
                  src={gdocsUrl}
                  title={resume.name}
                  className="w-full h-full border-0"
                  allow="fullscreen"
                />
              ) : (
                <object
                  data={`${signedUrl}#toolbar=0&navpanes=0`}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  {/* Fallback inside object tag if mobile browser doesn't natively render <object> PDF */}
                  <iframe
                    src={gdocsUrl}
                    title={resume.name}
                    className="w-full h-full border-0"
                  />
                </object>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
