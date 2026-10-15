import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import SchoolLogo from './SchoolLogo';
import {
  X,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  School,
  Phone,
  Mail,
  MapPin,
  Award,
  Trash2,
  FileSignature,
} from 'lucide-react';

export default function SchoolBrandingModal({ isOpen, onClose }) {
  const { schoolCode, schoolProfile, updateSchoolProfileLocal } = useAuth();

  const [formData, setFormData] = useState({
    schoolCode: '',
    schoolName: '',
    tagline: '',
    address: '',
    phone: '',
    email: '',
    affiliation: '',
    principalTitle: 'Principal',
    logoUrl: '',
    principalSignatureUrl: '',
    activeSession: '2025-2026',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Hydrate modal from current schoolProfile
  useEffect(() => {
    if (schoolProfile) {
      setFormData({
        schoolCode: schoolProfile.schoolCode || schoolCode || '',
        schoolName: schoolProfile.schoolName || '',
        tagline: schoolProfile.tagline || '',
        address: schoolProfile.address || '',
        phone: schoolProfile.phone || '',
        email: schoolProfile.email || '',
        affiliation: schoolProfile.affiliation || '',
        principalTitle: schoolProfile.principalTitle || 'Principal',
        logoUrl: schoolProfile.logoUrl || '',
        principalSignatureUrl: schoolProfile.principalSignatureUrl || '',
        activeSession: schoolProfile.activeSession || '2025-2026',
      });
    } else if (schoolCode) {
      setFormData((prev) => ({ ...prev, schoolCode }));
    }
    setSuccessMsg('');
    setErrorMsg('');
  }, [schoolProfile, schoolCode, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  // Convert uploaded logo image file to Base64
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Logo file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logoUrl: reader.result }));
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to process image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  // Convert uploaded principal signature image file to Base64
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Signature file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, principalSignatureUrl: reader.result }));
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to process signature image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setFormData((prev) => ({ ...prev, principalSignatureUrl: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.schoolName.trim()) {
      setErrorMsg('School Name is required.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const payload = {
        ...formData,
        schoolCode: formData.schoolCode || schoolCode,
      };

      const res = await api.post('/school-profile', payload);
      if (res.data?.success) {
        setSuccessMsg('✅ School identity & branding saved successfully!');
        if (res.data.data) {
          updateSchoolProfileLocal(res.data.data);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update school profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#041633] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>School Identity & White-Label Branding</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  {formData.schoolCode}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Configure your school's official logo, crest, full title, and campus credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Logo Upload & Live Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Official School Logo / Crest
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="shrink-0 flex flex-col items-center gap-1.5">
                <SchoolLogo
                  logoUrl={formData.logoUrl}
                  schoolName={formData.schoolName}
                  schoolCode={formData.schoolCode}
                  size="xl"
                  variant="gold"
                  className="shadow-md"
                />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Live Preview
                </span>
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition shadow-xs">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>Upload Logo Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Remove uploaded logo & revert to official heraldic crest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Upload your school's PNG, JPG or SVG logo. If no image is uploaded, an ultra-luxurious collegiate heraldic crest with your school's initials will be automatically generated.
                </p>
              </div>
            </div>
          </div>

          {/* Principal Signature Upload & Live Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <FileSignature className="w-4 h-4 text-amber-600" />
              <span>Official Principal / Authority Signature Picture</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Signature Preview Box */}
              <div className="w-36 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-inner p-2 relative group">
                {formData.principalSignatureUrl ? (
                  <>
                    <img
                      src={formData.principalSignatureUrl}
                      alt="Principal Signature Preview"
                      className="max-h-11 max-w-full object-contain filter contrast-125"
                    />
                    <div className="w-20 h-0.5 bg-slate-300 rounded mt-1"></div>
                    <span className="text-[7px] text-slate-400 uppercase font-black tracking-wider block mt-0.5">
                      {formData.principalTitle || 'Principal'} Sign
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="absolute inset-0 bg-slate-950/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Remove Signature"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <span className="font-serif italic text-sm text-slate-400 block">
                      {formData.principalTitle || 'Principal'}
                    </span>
                    <div className="w-16 h-0.5 bg-slate-200 rounded mx-auto mt-0.5"></div>
                    <span className="text-[7.5px] font-bold text-slate-400 block mt-0.5">
                      No Signature File
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition shadow-xs">
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>Upload Signature Picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.principalSignatureUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Recommended: Clean PNG or JPG photo of Principal signature. Will automatically appear on all Student ID Cards, Admission Cards, and Official Vouchers.
                </p>
              </div>
            </div>
          </div>

          {/* School Name & Tagline */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                required
                placeholder="e.g. ISLAMABAD MODEL COLLEGE FOR BOYS"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motto / Tagline
              </label>
              <input
                type="text"
                name="tagline"
                value={formData.tagline}
                onChange={handleChange}
                placeholder="e.g. Excellence in Education & Character Building"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Campus Address & Board Affiliation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Campus Address / Location</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g. PAKISTAN TOWN, ISLAMABAD"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Affiliation / Board</span>
              </label>
              <input
                type="text"
                name="affiliation"
                value={formData.affiliation}
                onChange={handleChange}
                placeholder="e.g. Affiliated with Federal Board (FBISE)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Official Phone</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+92 51 9283741"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Official Email</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@school.edu.pk"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Branding...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save School Branding</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
