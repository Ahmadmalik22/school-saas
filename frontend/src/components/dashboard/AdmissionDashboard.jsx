import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  Users, UserPlus, HelpCircle, FileSpreadsheet,
  ArrowRight, School, Sparkles, CheckCircle2, TrendingUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SchoolLogo from '../common/SchoolLogo';

export default function AdmissionDashboard({ schoolCode, setActiveSubModule }) {
  const { schoolName, schoolProfile, schoolLogo } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalInquiries: 0,
    openInquiries: 0,
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [studentsRes, inqRes] = await Promise.all([
          api.get('/admissions/print-forms', { params: { schoolCode } }),
          api.get('/admissions/inquiries', { params: { schoolCode } }),
        ]);

        if (studentsRes.data.success) {
          setStats((prev) => ({
            ...prev,
            totalStudents: studentsRes.data.count,
          }));
          setRecentStudents(studentsRes.data.data.slice(0, 5));
        }

        if (inqRes.data.success) {
          const inqs = inqRes.data.data;
          setStats((prev) => ({
            ...prev,
            totalInquiries: inqs.length,
            openInquiries: inqs.filter((i) => i.status === 'OPEN').length,
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [schoolCode]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#041633] to-[#0a2757] rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-4">
          <SchoolLogo
            logoUrl={schoolProfile?.logoUrl || schoolLogo}
            schoolName={schoolProfile?.schoolName || schoolName}
            schoolCode={schoolCode}
            size="lg"
            variant="gold"
            className="hidden sm:inline-flex shadow-lg shrink-0"
          />
          <div>
            <div className="flex items-center gap-2 text-[#ffa000] text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Admission Management Module</span>
            </div>
            <h2 className="text-xl font-black tracking-tight uppercase">
              {schoolProfile?.schoolName || schoolName || 'School System'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {schoolProfile?.tagline ? `${schoolProfile.tagline} • ` : ''}
              Managing <span className="text-white font-bold">School Code: {schoolCode}</span>. Enroll students, import class spreadsheets, track visitor inquiries, and print official admission forms.
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveSubModule('admit_student')}
          className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Admit New Student</span>
        </button>
      </div>

      {/* 4 Top KPI Stat Cards (Matching Akkhor Dashboard Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Enrolled */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Total Enrolled Students
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {stats.totalStudents}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active in Session 2025-2026</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Open Inquiries */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Open Inquiries (Follow-up)
            </div>
            <div className="text-3xl font-black text-amber-600 mt-1">
              {stats.openInquiries}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Total inquiries: {stats.totalInquiries}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: School Code Badge */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Active SaaS Tenant
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {schoolCode}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1">
              100% Data Isolated & Encrypted
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <School className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 4 Sub-Module Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* 1. Admit Student */}
        <button
          onClick={() => setActiveSubModule('admit_student')}
          className="bg-white hover:bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm text-left transition group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-800">1. Admit Student</div>
            <div className="text-xs text-slate-500 mt-1">
              Complete student admission form with Cloudinary passport photo.
            </div>
          </div>
          <div className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-4 group-hover:translate-x-1 transition">
            <span>Open Form</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* 2. Admit Bulk */}
        <button
          onClick={() => setActiveSubModule('admit_bulk')}
          className="bg-white hover:bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm text-left transition group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-800">2. Admit Bulk</div>
            <div className="text-xs text-slate-500 mt-1">
              Upload class Excel/CSV file to enroll hundreds of students at once.
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-4 group-hover:translate-x-1 transition">
            <span>Import Class</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* 3. Admission Inquiries */}
        <button
          onClick={() => setActiveSubModule('inquiries')}
          className="bg-white hover:bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm text-left transition group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-800">3. Inquiries</div>
            <div className="text-xs text-slate-500 mt-1">
              Record walk-in visitors with 1-click conversion to admitted students.
            </div>
          </div>
          <div className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-4 group-hover:translate-x-1 transition">
            <span>View Inquiries</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* 4. Print Admission Form */}
        <button
          onClick={() => setActiveSubModule('print_form')}
          className="bg-white hover:bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm text-left transition group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-slate-800">4. Print Slips</div>
            <div className="text-xs text-slate-500 mt-1">
              Search by Class & Section to print official A4 admission documents.
            </div>
          </div>
          <div className="text-xs font-bold text-purple-600 flex items-center gap-1 mt-4 group-hover:translate-x-1 transition">
            <span>Print Slips</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Recent Admissions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Recently Admitted Students ({schoolCode})
          </h3>
          <button
            onClick={() => setActiveSubModule('print_form')}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Admission No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Class</th>
                <th className="p-3">Father Name</th>
                <th className="p-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No students admitted yet. Use "Admit Student" or "Admit Bulk" to enroll students!
                  </td>
                </tr>
              ) : (
                recentStudents.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      {s.photo?.url ? (
                        <img
                          src={s.photo.url}
                          alt={s.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-amber-400"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {s.fullName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{s.rollNumber}</td>
                    <td className="p-3 font-mono text-slate-600">{s.admissionNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{s.fullName}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {s.className} ({s.section})
                    </td>
                    <td className="p-3 text-slate-700">{s.fatherName}</td>
                    <td className="p-3 font-mono text-slate-800">{s.fatherPhone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
