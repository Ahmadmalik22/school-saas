import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import SchoolLogo from '../common/SchoolLogo';
import {
  GraduationCap,
  Lock,
  Mail,
  School,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Building,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    schoolCode: '',
    email: '',
    password: '',
  });

  const [previewProfile, setPreviewProfile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fetch branding preview when a valid school code is entered
  useEffect(() => {
    const code = formData.schoolCode?.trim().toUpperCase();
    if (!code || code === 'SYSTEM') {
      setPreviewProfile(null);
      return;
    }
    let isCancelled = false;
    const fetchPreview = async () => {
      try {
        const res = await api.get(`/school-profile?schoolCode=${code}`);
        if (!isCancelled && res.data?.success && res.data.data) {
          setPreviewProfile(res.data.data);
        }
      } catch {
        if (!isCancelled) setPreviewProfile(null);
      }
    };
    const t = setTimeout(fetchPreview, 300);
    return () => {
      isCancelled = true;
      clearTimeout(t);
    };
  }, [formData.schoolCode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'schoolCode' ? value.toUpperCase() : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await login({
        email: formData.email.trim(),
        password: formData.password,
        schoolCode: formData.schoolCode.trim() || undefined,
      });

      if (res?.user?.role === 'SUPER_ADMIN') {
        navigate('/developer/schools');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Autofill helpers
  const handleQuickFill = async (schoolCode, email, password) => {
    setFormData({ schoolCode, email, password });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020b18] via-[#041633] to-[#072454] flex flex-col justify-center items-center px-4 py-8 select-none font-sans relative overflow-hidden">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl shadow-xl shadow-amber-500/20 mb-4 ring-4 ring-amber-500/20">
            <GraduationCap className="w-9 h-9 text-slate-950" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>Akkhor</span>
            <span className="text-amber-400 font-extrabold">SaaS</span>
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-1 tracking-wide">
            Next-Gen Multi-Tenant School ERP & Administrative Suite
          </p>
        </div>

        {/* Main Login Box */}
        <div className="bg-[#0b1e3f]/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-7 text-slate-200">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white">System Sign In</h2>
              <p className="text-[11px] text-slate-400">Enter your credentials to access your portal</p>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full">
              Enterprise v2.6
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Dynamic School Identity Preview Banner */}
          {previewProfile && (
            <div className="mb-5 p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-slate-900 border border-amber-500/40 rounded-xl flex items-center gap-3 animate-fadeIn">
              <SchoolLogo
                logoUrl={previewProfile.logoUrl}
                schoolName={previewProfile.schoolName}
                schoolCode={previewProfile.schoolCode}
                size="sm"
                variant="gold"
                className="shrink-0 shadow-md"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-amber-300 uppercase tracking-tight truncate">
                  {previewProfile.schoolName}
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  {previewProfile.tagline || previewProfile.address || `Official Portal (${previewProfile.schoolCode})`}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* School Code (Optional for Dev, specific for tenant) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>School Code</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional for Developer / Auto-match</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <School className="w-4 h-4 text-amber-400/80" />
                </div>
                <input
                  type="text"
                  name="schoolCode"
                  value={formData.schoolCode}
                  onChange={handleChange}
                  placeholder="e.g. SCH-101, BSS-01"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4 text-amber-400/80" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@school.edu.pk or developer@akkhor.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-amber-400/80" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs tracking-wide shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Authenticate & Enter Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mb-2.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick 1-Click Demo Accounts</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {/* 1. Developer */}
              <button
                type="button"
                onClick={() => handleQuickFill('SYSTEM', 'developer@akkhor.com', 'dev123456')}
                className="w-full text-left p-2.5 bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">
                      Master Developer (Super Admin)
                    </div>
                    <div className="text-[10px] text-slate-400">developer@akkhor.com • All Schools Control</div>
                  </div>
                </div>
                <span className="text-[10px] text-amber-400/80 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Full SaaS
                </span>
              </button>

              {/* 2. School Admin (SCH-101) */}
              <button
                type="button"
                onClick={() => handleQuickFill('SCH-101', 'admin@imcb.edu.pk', 'admin123')}
                className="w-full text-left p-2.5 bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg group-hover:bg-blue-500 group-hover:text-slate-950 transition">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                      Principal Admin (SCH-101 IMCB)
                    </div>
                    <div className="text-[10px] text-slate-400">admin@imcb.edu.pk • All Campus Modules</div>
                  </div>
                </div>
                <span className="text-[10px] text-blue-400/80 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  School Admin
                </span>
              </button>

              {/* 3. Bright Moon Public High School (With Uploaded Logo) */}
              <button
                type="button"
                onClick={() => handleQuickFill('BPHS', 'ahmimalik.2811@gmail.com', '123456')}
                className="w-full text-left p-2.5 bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">
                      Bright Moon Public High School (BPHS)
                    </div>
                    <div className="text-[10px] text-slate-400">ahmimalik.2811@gmail.com • Uploaded Logo</div>
                  </div>
                </div>
                <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Custom Logo
                </span>
              </button>

              {/* 4. Beaconhouse School System (BSS-01) */}
              <button
                type="button"
                onClick={() => handleQuickFill('BSS-01', 'principal@bss.edu.pk', 'admin123')}
                className="w-full text-left p-2.5 bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                      Beaconhouse Principal (BSS-01)
                    </div>
                    <div className="text-[10px] text-slate-400">principal@bss.edu.pk • Cambridge & FBISE</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  BSS Portal
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-slate-500 text-[11px]">
          Akkhor Education Technology • Enterprise Multi-Tenant Architecture
        </div>
      </div>
    </div>
  );
}
