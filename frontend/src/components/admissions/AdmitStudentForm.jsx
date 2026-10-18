import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { broadcastDataChange } from '../../utils/realtimeEvents';
import confetti from 'canvas-confetti';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  UserPlus, Upload, Image as ImageIcon, CheckCircle,
  AlertCircle, RefreshCw, X, Calendar, Receipt
} from 'lucide-react';

export default function AdmitStudentForm({ schoolCode }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);
  const initialForm = {
    admissionNumber: `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    admissionDate: new Date().toISOString().split('T')[0],
    academicSession: '2025-2026',
    className: 'Class 1',
    section: 'A',
    rollNumber: '',
    fullName: '',
    gender: 'MALE',
    dob: '2016-01-01',
    bFormOrCnic: '',
    bloodGroup: 'Unknown',
    religion: 'Islam',
    address: '',
    city: 'Lahore',
    fatherName: '',
    fatherCnic: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherName: '',
    guardianEmail: '',
    emergencyContact: '',
    previousSchool: '',
    previousClass: '',
    leavingCertificateNumber: '',
    monthlyFee: 2500,
    admissionFee: 0,
    annualCharges: 0,
    monthlyDiscount: 0,
    discountReason: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Auto-sync class and section when classNames change or on initial load
  useEffect(() => {
    if (classNames && classNames.length > 0) {
      if (!formData.className || !classNames.includes(formData.className)) {
        const defaultClass = classNames[0];
        const sections = getSectionsForClass(defaultClass);
        setFormData((prev) => ({
          ...prev,
          className: defaultClass,
          section: sections[0] || 'A',
        }));
      } else {
        const availableSections = getSectionsForClass(formData.className);
        if (availableSections.length > 0 && !availableSections.includes(formData.section)) {
          setFormData((prev) => ({
            ...prev,
            section: availableSections[0],
          }));
        }
      }
    }
  }, [classNames, formData.className, getSectionsForClass]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'className') {
      const available = getSectionsForClass(value);
      setFormData((prev) => ({
        ...prev,
        className: value,
        section: available[0] || 'A',
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle Photo Selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Photo size must be less than 10MB.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const data = new FormData();
      data.append('schoolCode', schoolCode);

      // Append text fields
      Object.keys(formData).forEach((key) => {
        data.append(key, formData[key]);
      });

      // Append photo if selected
      if (photoFile) {
        data.append('photo', photoFile);
      }

      const res = await api.post('/admissions/student', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
        setMessage(res.data.message);
        // Reset form with new random admission number
        setFormData({
          ...initialForm,
          admissionNumber: `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        });
        removePhoto();
        broadcastDataChange('student');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to submit admission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-6">
      {/* Banner / Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-500" />
            <span>Student Admission Registration</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData(initialForm);
            removePhoto();
            setMessage(null);
            setError(null);
          }}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Admission Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: ACADEMIC PLACEMENT & ADMISSION DETAILS */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <span>1. Academic Placement & Admission Info</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Step 1 of 4</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Admission No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="admissionNumber"
                value={formData.admissionNumber}
                onChange={handleChange}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Academic Session <span className="text-rose-500">*</span>
              </label>
              <select
                name="academicSession"
                value={formData.academicSession}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Class <span className="text-rose-500">*</span>
              </label>
              <select
                name="className"
                value={formData.className}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {classNames.length === 0 ? (
                  <option value="">Loading classes...</option>
                ) : (
                  classNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Section <span className="text-rose-500">*</span>
              </label>
              <select
                name="section"
                value={formData.section}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {getSectionsForClass(formData.className).map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Roll Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="rollNumber"
                placeholder="e.g. 101 or 01"
                value={formData.rollNumber}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Admission Date
              </label>
              <input
                type="date"
                name="admissionDate"
                value={formData.admissionDate}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: STUDENT PERSONAL INFORMATION & PHOTO */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <span>2. Student Bio & Photograph</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Step 2 of 4</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Student Photo Uploader Box */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center relative group">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Student Preview"
                    className="w-32 h-36 object-cover rounded-lg border-2 border-amber-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700 transition"
                    title="Remove Photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="mt-2 text-[10px] text-emerald-600 font-bold">Passport Ready</div>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full py-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Upload Student Photo</span>
                  <span className="text-[10px] text-slate-400 mt-1">Passport Size (JPG, PNG)</span>
                  <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded mt-2 font-semibold">
                    Auto-WebP Cloudinary
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Student Personal Fields */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name of Student <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="e.g. Muhammad Ahmad"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MALE">Male (Boy)</option>
                  <option value="FEMALE">Female (Girl)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date of Birth (DOB) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  B-Form / CNIC No.
                </label>
                <input
                  type="text"
                  name="bFormOrCnic"
                  placeholder="e.g. 35201-XXXXXXXX-X"
                  value={formData.bFormOrCnic}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Residential Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="address"
                  placeholder="House #, Street #, Area"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: PARENT / GUARDIAN DETAILS */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <span>3. Parent & Guardian Information</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Step 3 of 4</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Father's Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="fatherName"
                placeholder="e.g. Tariq Mehmood"
                value={formData.fatherName}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Father's Mobile No. (Primary Contact) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                name="fatherPhone"
                placeholder="e.g. 03001234567"
                value={formData.fatherPhone}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Father's CNIC
              </label>
              <input
                type="text"
                name="fatherCnic"
                placeholder="35202-XXXXXXXX-X"
                value={formData.fatherCnic}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Father's Occupation
              </label>
              <input
                type="text"
                name="fatherOccupation"
                placeholder="e.g. Businessman / Govt Employee"
                value={formData.fatherOccupation}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mother's Name
              </label>
              <input
                type="text"
                name="motherName"
                value={formData.motherName}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Emergency Contact No.
              </label>
              <input
                type="tel"
                name="emergencyContact"
                placeholder="e.g. 03219876543"
                value={formData.emergencyContact}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: FEE STRUCTURE & ADMISSION AGREEMENT */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>4. Fee Structure & Admission Agreement</span>
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Step 4 of 5</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* 1. Monthly Tuition Fee */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Agreed Monthly Tuition Fee (PKR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  name="monthlyFee"
                  min="0"
                  required
                  value={formData.monthlyFee}
                  onChange={handleChange}
                  placeholder="2500"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 2. Admission Fee */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Admission Fee (One-Time PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  name="admissionFee"
                  min="0"
                  value={formData.admissionFee}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 3. Annual Charges */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Annual / Security Charges (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  name="annualCharges"
                  min="0"
                  value={formData.annualCharges}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 4. Monthly Discount */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Monthly Concession / Discount (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  name="monthlyDiscount"
                  min="0"
                  value={formData.monthlyDiscount}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 5. Discount Reason */}
            <div className="md:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">
                Concession Reason / Scholarship Remarks (if any)
              </label>
              <input
                type="text"
                name="discountReason"
                placeholder="e.g. Sibling Discount / Staff Child / Orphan Concession / Merit Scholarship"
                value={formData.discountReason}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Live Calculated Fee Summary Badge */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Agreed Monthly Fee:</span>
                <span className="font-bold">Rs. {Number(formData.monthlyFee || 0).toLocaleString()}</span>
                {Number(formData.monthlyDiscount) > 0 && (
                  <>
                    <span className="text-rose-400 font-semibold">- Rs. {Number(formData.monthlyDiscount).toLocaleString()} (Discount)</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>🔒 Private: Fee records flow into Monthly Fee Challans and will NOT appear on the printed Admission Slip.</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/80 px-4 py-2.5 rounded-lg border border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Net Monthly Fee</span>
                <span className="text-base font-black text-[#ffa000]">
                  Rs. {Math.max(0, (Number(formData.monthlyFee) || 0) - (Number(formData.monthlyDiscount) || 0)).toLocaleString()}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-700"></div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Due at Admission</span>
                <span className="text-base font-black text-emerald-400">
                  Rs. {(
                    (Number(formData.admissionFee) || 0) +
                    (Number(formData.annualCharges) || 0) +
                    Math.max(0, (Number(formData.monthlyFee) || 0) - (Number(formData.monthlyDiscount) || 0))
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: PREVIOUS SCHOOL RECORD */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <span>5. Previous Academic Record (Optional)</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Step 5 of 5</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Previous School Name</label>
              <input
                type="text"
                name="previousSchool"
                placeholder="Leave empty if first admission"
                value={formData.previousSchool}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Previous Class Completed</label>
              <input
                type="text"
                name="previousClass"
                placeholder="e.g. Prep or Class 4"
                value={formData.previousClass}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">School Leaving Certificate No.</label>
              <input
                type="text"
                name="leavingCertificateNumber"
                placeholder="e.g. SLC-9821"
                value={formData.leavingCertificateNumber}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON BAR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Ready to enroll? All data will be saved directly into MongoDB and image to Cloudinary.
          </span>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-sm px-8 py-3 rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Enrolling Student...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Confirm & Admit Student</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
