import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err.message || 'Invalid email or password.');
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f13]"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 glow-indigo">
            <Briefcase className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#f0f0ff]">Welcome back</h1>
          <p className="text-[#9898b8] text-sm mt-1">Sign in to JobTrack</p>
        </div>

        <div className="card border-[#2a2a3d]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div className="input-group">
              <label htmlFor="login-email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6666a0]" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="w-full pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6666a0] hover:text-[#9898b8]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary justify-center mt-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#9898b8] text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
