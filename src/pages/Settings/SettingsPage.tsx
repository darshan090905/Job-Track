import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { NotificationEmail } from '../../types';
import {
  User, Mail, Bell, Plus, Trash2, Loader2, Save, Camera, X, Sun, Moon
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(profile?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [emails, setEmails] = useState<NotificationEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailName, setNewEmailName] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    walkin_reminders: true,
    followup_reminders: true,
    interview_reminders: true,
  });

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    loadEmails();
  }, [user]);

  async function loadEmails() {
    if (!user) return;
    setLoading(true);
    let { data } = await supabase.from('notification_emails').select('*').eq('user_id', user.id).order('created_at');
    if ((!data || data.length === 0) && user.email) {
      await supabase.from('notification_emails').insert({
        user_id: user.id,
        email: user.email,
        name: 'Login Email (Primary)',
        enabled: true,
      });
      const res = await supabase.from('notification_emails').select('*').eq('user_id', user.id);
      data = res.data;
    }
    setEmails((data || []) as NotificationEmail[]);
    setLoading(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await updateProfile({ name });
    if (error) toast('Failed to save profile', 'error');
    else toast('Profile updated!', 'success');
    setSavingProfile(false);
  }

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const { error } = await supabase.from('notification_emails').insert({
      user_id: user!.id,
      email: newEmail.trim(),
      name: newEmailName.trim() || null,
      enabled: true,
    });
    if (error) toast('Failed to add email', 'error');
    else {
      toast('Email added!', 'success');
      setNewEmail('');
      setNewEmailName('');
      setAddingEmail(false);
      loadEmails();
    }
  }

  async function toggleEmail(em: NotificationEmail) {
    await supabase.from('notification_emails').update({ enabled: !em.enabled }).eq('id', em.id);
    setEmails(prev => prev.map(e => e.id === em.id ? { ...e, enabled: !e.enabled } : e));
  }

  async function deleteEmail(id: string) {
    const { error } = await supabase.from('notification_emails').delete().eq('id', id);
    if (error) toast('Failed to delete', 'error');
    else { toast('Email removed', 'success'); loadEmails(); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="page-title mb-6">Settings</h1>

      {/* Appearance & Theme */}
      <div className="card mb-6">
        <h2 className="section-title mb-1">Appearance & Theme</h2>
        <p className="text-xs sm:text-sm text-[#9898b8] mb-4">Choose your preferred workspace theme.</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all text-left ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/30'
                : 'border-[#2a2a3d] bg-[#12121a] hover:border-indigo-500/40'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
              <Moon className="w-5 h-5" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-[#f0f0ff]">Dark Theme</p>
              <p className="text-[11px] text-[#9898b8]">Sleek & comfortable</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all text-left ${
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/30'
                : 'border-[#2a2a3d] bg-[#12121a] hover:border-indigo-500/40'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Sun className="w-5 h-5" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-[#f0f0ff]">Light Theme</p>
              <p className="text-[11px] text-[#9898b8]">Clean white & crisp</p>
            </div>
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="card mb-6">
        <h2 className="section-title mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#9898b8]">Profile photo upload coming soon</p>
              <p className="text-xs text-[#6666a0]">{profile?.email}</p>
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="settings-name">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
              <input id="settings-name" value={name} onChange={e => setName(e.target.value)} className="w-full pl-9" placeholder="Your name" />
            </div>
          </div>
          <div className="input-group">
            <label>Email</label>
            <input value={profile?.email || ''} disabled className="opacity-60" />
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary self-start">
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </form>
      </div>

      {/* Email Notifications */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Email Notifications</h2>
          <button onClick={() => setAddingEmail(true)} className="btn-secondary text-sm">
            <Plus className="w-3.5 h-3.5" /> Add Email
          </button>
        </div>
        <p className="text-sm text-[#9898b8] mb-4">Walk-in reminders will be sent to all enabled email addresses.</p>

        {addingEmail && (
          <form onSubmit={addEmail} className="card mb-4 flex flex-col gap-3">
            <h3 className="text-sm font-medium text-[#f0f0ff]">Add Notification Email</h3>
            <div className="input-group">
              <label>Email Address *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="backup@gmail.com" required />
            </div>
            <div className="input-group">
              <label>Label (optional)</label>
              <input value={newEmailName} onChange={e => setNewEmailName(e.target.value)} placeholder="e.g. Personal, Work, Family" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddingEmail(false)} className="btn-secondary text-sm flex-1 justify-center">Cancel</button>
              <button type="submit" className="btn-primary text-sm flex-1 justify-center"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
        ) : emails.length === 0 ? (
          <div className="text-center py-6">
            <Mail className="w-8 h-8 text-[#6666a0] mx-auto mb-2" />
            <p className="text-sm text-[#9898b8]">No notification emails added yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {emails.map(em => (
              <div key={em.id} className="flex items-center gap-3 p-3 bg-[#12121a] rounded-lg">
                <input type="checkbox" checked={em.enabled} onChange={() => toggleEmail(em)} className="accent-indigo-500 w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f0f0ff] truncate">{em.email}</p>
                  {em.name && <p className="text-xs text-[#9898b8]">{em.name}</p>}
                </div>
                <button onClick={() => deleteEmail(em.id)} className="p-1.5 text-[#9898b8] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="card">
        <h2 className="section-title mb-4">Notification Preferences</h2>
        <div className="flex flex-col gap-3">
          {[
            { key: 'walkin_reminders', label: 'Walk-in reminders', desc: '1 day before walk-in drive' },
            { key: 'followup_reminders', label: 'Follow-up reminders', desc: 'On your follow-up dates' },
            { key: 'interview_reminders', label: 'Interview reminders', desc: '1 day before interview' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[#f0f0ff]">{label}</p>
                <p className="text-xs text-[#9898b8]">{desc}</p>
              </div>
              <input
                type="checkbox"
                checked={settings[key as keyof typeof settings]}
                onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                className="accent-indigo-500 w-4 h-4"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#2a2a3d]">
          <p className="text-xs text-[#6666a0]">
            Email reminders are sent via Supabase Edge Functions. Ensure your RESEND_API_KEY is configured in Supabase secrets.
          </p>
        </div>
      </div>
    </div>
  );
}
