import React, { useState, useEffect } from 'react';
import { Trophy, Plus, MapPin, Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Scoreboard from '../../components/Scoreboard';
import JobModal from '../../components/JobModal';
import WalkinModal from '../../components/WalkinModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Resume } from '../../types';

export default function ScoreboardPage() {
  const { user } = useAuth();
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showAddWalkinModal, setShowAddWalkinModal] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);

  useEffect(() => {
    if (!user) return;
    loadResumes();
  }, [user]);

  async function loadResumes() {
    if (!user) return;
    const { data } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false);
    setResumes((data || []) as Resume[]);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Trophy className="w-5 h-5 text-amber-400" />
            </span>
            <h1 className="page-title text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span>Community Scoreboard & Ranks</span>
            </h1>
          </div>
          <p className="page-subtitle">
            Earn scout points, unlock contributor badges, and climb the community hunter leaderboard!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddJobModal(true)}
            className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Share Job (+10 pts)
          </button>
          <button
            onClick={() => setShowAddWalkinModal(true)}
            className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4 text-cyan-300 border-cyan-500/30"
          >
            <MapPin className="w-4 h-4 text-cyan-400" /> Share Walk-in (+15 pts)
          </button>
        </div>
      </div>

      {/* Main Scoreboard Component */}
      <Scoreboard
        onAddJob={() => setShowAddJobModal(true)}
        onAddWalkin={() => setShowAddWalkinModal(true)}
      />

      {/* Share Job Modal */}
      {showAddJobModal && (
        <JobModal
          onClose={() => setShowAddJobModal(false)}
          onSaved={() => {
            setShowAddJobModal(false);
            window.location.reload();
          }}
          resumes={resumes}
        />
      )}

      {/* Share Walk-in Modal */}
      {showAddWalkinModal && (
        <WalkinModal
          onClose={() => setShowAddWalkinModal(false)}
          onSaved={() => {
            setShowAddWalkinModal(false);
            window.location.reload();
          }}
          resumes={resumes}
        />
      )}
    </div>
  );
}
