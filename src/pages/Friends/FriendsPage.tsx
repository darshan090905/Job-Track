import React, { useEffect, useState } from 'react';
import { Search, UserPlus, UserCheck, UserX, Users, Loader2, X, Check, Copy, Share2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Profile, FriendRequest } from '../../types';
import { formatDate } from '../../utils/helpers';

export default function FriendsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<{ profile: Profile; requestId: string }[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadFriends(), loadAllUsers()]);
    setLoading(false);
  }

  async function loadAllUsers() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setAllUsers((data || []) as Profile[]);
  }

  async function loadFriends() {
    if (!user) return;
    const { data } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_user_id_fkey(*), receiver:profiles!friend_requests_receiver_user_id_fkey(*)')
      .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`);

    if (!data) return;

    const accepted: { profile: Profile; requestId: string }[] = [];
    const received: FriendRequest[] = [];
    const sent: FriendRequest[] = [];

    data.forEach((req: FriendRequest & { sender: Profile; receiver: Profile }) => {
      if (req.status === 'accepted') {
        const friendProfile = req.sender_user_id === user.id ? req.receiver as Profile : req.sender as Profile;
        if (friendProfile) accepted.push({ profile: friendProfile, requestId: req.id });
      } else if (req.status === 'pending') {
        if (req.receiver_user_id === user.id) received.push(req);
        else sent.push(req);
      }
    });

    setFriends(accepted);
    setPendingReceived(received);
    setPendingSent(sent);
  }

  async function sendRequest(toUserId: string) {
    if (!user) return;
    setActionLoading(toUserId);

    const { error } = await supabase.from('friend_requests').insert({
      sender_user_id: user.id,
      receiver_user_id: toUserId,
      status: 'pending',
    });

    setActionLoading(null);
    if (error) {
      toast('Failed to send request: ' + error.message, 'error');
    } else {
      toast('Friend request sent!', 'success');
      loadFriends();
    }
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    setActionLoading(requestId);
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', requestId);
    setActionLoading(null);

    if (error) {
      toast('Failed to update request', 'error');
    } else {
      toast(accept ? 'Friend request accepted!' : 'Request rejected', accept ? 'success' : 'info');
      loadFriends();
    }
  }

  async function removeFriend(requestId: string) {
    setActionLoading(requestId);
    const { error } = await supabase.from('friend_requests').delete().eq('id', requestId);
    setActionLoading(null);
    if (error) toast('Failed to remove friend', 'error');
    else { toast('Friend removed', 'success'); loadFriends(); }
  }

  async function cancelRequest(requestId: string) {
    setActionLoading(requestId);
    await supabase.from('friend_requests').delete().eq('id', requestId);
    setActionLoading(null);
    toast('Request cancelled', 'info');
    loadFriends();
  }

  function copyInviteLink() {
    const signupUrl = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(signupUrl);
    toast('Signup link copied to clipboard! Share it with your friends.', 'success');
  }

  // Filter users by search query (Name or Email)
  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const friendIds = new Set(friends.map(f => f.profile.id));
  const pendingSentIds = new Set(pendingSent.map(r => r.receiver_user_id));
  const pendingReceivedMap = new Map(pendingReceived.map(r => [r.sender_user_id, r]));

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Friends & Job Sharing</h1>
          <p className="page-subtitle mt-1">Connect with peers to share job postings and walk-in drives</p>
        </div>
        <button onClick={copyInviteLink} className="btn-secondary self-start sm:self-auto text-sm">
          <Share2 className="w-4 h-4 text-indigo-400" /> Invite Friends
        </button>
      </div>

      {/* Pending Requests Received */}
      {pendingReceived.length > 0 && (
        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 animate-slide-up">
          <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4" /> Pending Friend Requests ({pendingReceived.length})
          </h2>
          <div className="flex flex-col gap-2">
            {pendingReceived.map(req => {
              const sender = req.sender as unknown as Profile;
              return (
                <div key={req.id} className="card bg-white dark:bg-[#1a1a28] border border-slate-200 dark:border-[#2a2a3d] flex items-center justify-between gap-3 p-3 shadow-sm dark:shadow-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {sender?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-[#f0f0ff] text-sm truncate">{sender?.name}</p>
                      <p className="text-xs text-slate-600 dark:text-[#9898b8] truncate">{sender?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button 
                      onClick={() => respondToRequest(req.id, true)} 
                      disabled={actionLoading === req.id}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button 
                      onClick={() => respondToRequest(req.id, false)} 
                      disabled={actionLoading === req.id}
                      className="btn-danger text-xs py-1.5 px-3"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Friends List */}
      <div className="card shadow-sm dark:shadow-none">
        <h2 className="section-title mb-4 flex items-center justify-between">
          <span>My Friends ({friends.length})</span>
        </h2>

        {friends.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-[#9898b8]">
            <Users className="w-9 h-9 text-slate-400 dark:text-[#6666a0] mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-slate-900 dark:text-[#f0f0ff]">No friends added yet</p>
            <p className="text-xs text-slate-500 dark:text-[#6666a0] mt-1">Connect with registered users below or invite friends to join!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {friends.map(({ profile, requestId }) => (
              <div key={profile.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#12121a] border border-slate-200 dark:border-[#2a2a3d] flex items-center justify-between gap-3 hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover rounded-full" alt={profile.name} />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-[#f0f0ff] text-sm truncate">{profile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-[#9898b8] truncate">{profile.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => removeFriend(requestId)} 
                  disabled={actionLoading === requestId}
                  className="p-1.5 text-slate-400 dark:text-[#6666a0] hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" 
                  title="Remove friend"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discover / Add Registered Users */}
      <div className="card shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Discover & Add Users
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#9898b8] mt-0.5">Search or send friend requests to members registered on JobTrack</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#6666a0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-9 py-1.5 text-xs rounded-lg"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-[#9898b8]">
            <p className="text-sm">No registered users found matching "{searchQuery}"</p>
            <p className="text-xs text-slate-400 dark:text-[#6666a0] mt-1">When friends create an account, they will automatically show up here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredUsers.map(targetUser => {
              const isFriend = friendIds.has(targetUser.id);
              const isPendingSent = pendingSentIds.has(targetUser.id);
              const receivedReq = pendingReceivedMap.get(targetUser.id);

              return (
                <div key={targetUser.id} className="p-3 rounded-xl bg-slate-50 dark:bg-[#12121a] border border-slate-200 dark:border-[#2a2a3d] flex items-center justify-between gap-3 shadow-sm dark:shadow-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-[#2a2a3d] flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                      {targetUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-[#f0f0ff] text-sm truncate">{targetUser.name}</p>
                      <p className="text-xs text-slate-500 dark:text-[#9898b8] truncate">{targetUser.email}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isFriend ? (
                      <span className="badge bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 text-xs py-1 px-2 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Friends
                      </span>
                    ) : isPendingSent ? (
                      <span className="badge bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-xs py-1 px-2">
                        Pending
                      </span>
                    ) : receivedReq ? (
                      <button
                        onClick={() => respondToRequest(receivedReq.id, true)}
                        className="btn-primary text-xs py-1 px-2.5"
                      >
                        Accept
                      </button>
                    ) : (
                      <button
                        onClick={() => sendRequest(targetUser.id)}
                        disabled={actionLoading === targetUser.id}
                        className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                      >
                        {actionLoading === targetUser.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Add Friend
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Sent Requests */}
      {pendingSent.length > 0 && (
        <div className="card shadow-sm dark:shadow-none">
          <h2 className="section-title mb-3 text-xs uppercase tracking-wider text-slate-500 dark:text-[#6666a0]">
            Sent Friend Requests ({pendingSent.length})
          </h2>
          <div className="flex flex-col gap-2">
            {pendingSent.map(req => {
              const receiver = req.receiver as unknown as Profile;
              return (
                <div key={req.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#12121a] border border-slate-200 dark:border-[#2a2a3d]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-[#2a2a3d] flex items-center justify-center text-xs font-semibold text-indigo-700 dark:text-white">
                      {receiver?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-[#f0f0ff] truncate">{receiver?.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#6666a0] truncate">{receiver?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelRequest(req.id)}
                    disabled={actionLoading === req.id}
                    className="btn-secondary text-xs py-1 px-2 text-slate-500 dark:text-[#9898b8] hover:text-red-500 dark:hover:text-red-400"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
