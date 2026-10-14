import React, { useState } from 'react';
import api from '../../api/axios';
import confetti from 'canvas-confetti';
import {
  UserPlus, Upload, Image as ImageIcon, CheckCircle,
  AlertCircle, RefreshCw, X, Briefcase, DollarSign
} from 'lucide-react';

export default function AddStaffForm({ schoolCode }) {
  const initialForm = {
    employeeId: `EMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    joiningDate: new Date().toISOString().split('T')[0],
    role: 'Teacher',
    department: 'Science',
    fullName: '',
    gender: 'MALE',
    dob: '1995-01-01',
    cnic: '',
    phone: '',
    email: '',
    emergencyContact: '',
    address: '',
    city: 'Lahore',
    qualification: '',
    experienceYears: 0,
    basicSalary: 30000,
    bankAccountNumber: '',
    hasPortalAccess: false,
  };

  const [formData, setFormData] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const data = new FormData();
      data.append('schoolCode', schoolCode);

      Object.keys(formData).forEach((key) => {
        data.append(key, formData[key]);
      });

      if (photoFile) {
        data.append('photo', photoFile);
      }

      const res = await api.post('/staff', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
        setMessage(res.data.message);
        setFormData({
          ...initialForm,
          employeeId: `EMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        });
        removePhoto();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to add staff member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-500" />
            <span>Staff & Teacher Registration Form</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register teachers, administrative staff, accountants, and support team for <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormData(initialForm);
            removePhoto();
            setMessage(null);
            setError(null);
          }}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: ROLE & EMPLOYMENT PARTICULARS */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
              1. Designation, Department & Employment Info
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Employee ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role / Designation <span className="text-rose-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="Teacher">Teacher / Lecturer</option>
                <option value="Head Teacher / Vice Principal">Head Teacher / Vice Principal</option>
                <option value="Principal / Director">Principal / Director</option>
                <option value="Accountant">Accountant / Cashier</option>
                <option value="Admin / Clerk">Admin / Office Clerk</option>
                <option value="Librarian">Librarian</option>
                <option value="Lab Assistant">Lab Assistant</option>
                <option value="Support Staff / Peon / Guard">Support Staff / Peon / Guard</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="Science">Science (Physics/Bio/Chem)</option>
                <option value="Mathematics">Mathematics</option>
                <option value="English & Languages">English & Languages</option>
                <option value="Urdu & Islamiyat">Urdu & Islamiyat</option>
                <option value="Computer & IT">Computer & IT</option>
                <option value="Social Studies / Arts">Social Studies / Arts</option>
                <option value="Accounts & Finance">Accounts & Finance</option>
                <option value="Administration">Administration</option>
                <option value="General / Support">General / Support</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Joining Date</label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PERSONAL BIO & PHOTO */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
              2. Personal Bio & Photo
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Photo Dropzone */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center relative group">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Staff Preview"
                    className="w-32 h-36 object-cover rounded-lg border-2 border-amber-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
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
                  <span className="text-xs font-bold text-slate-700">Upload Staff Photo</span>
                  <span className="text-[10px] text-slate-400 mt-1">Passport Size (JPG, PNG)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Personal Details Fields */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="e.g. Sir Asif Mehmood"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
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
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  National CNIC No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="cnic"
                  placeholder="35202-XXXXXXXX-X"
                  value={formData.cnic}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Phone No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="03001234567"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="teacher@school.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact No.</label>
                <input
                  type="tel"
                  name="emergencyContact"
                  placeholder="03219876543"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="House #, Street #, Town"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: QUALIFICATIONS & PAYROLL */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
              3. Education Qualifications & Salary Particulars
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Highest Educational Qualification <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="qualification"
                placeholder="e.g. M.Sc Physics, B.Ed / M.Com"
                value={formData.qualification}
                onChange={handleChange}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Experience (Years)</label>
              <input
                type="number"
                name="experienceYears"
                min="0"
                value={formData.experienceYears}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Basic Monthly Salary (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="basicSalary"
                min="0"
                value={formData.basicSalary}
                onChange={handleChange}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Bank Account / IBAN (Optional)</label>
              <input
                type="text"
                name="bankAccountNumber"
                placeholder="Bank Name & Account No."
                value={formData.bankAccountNumber}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON BAR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Staff profile will be stored in database and available in staff directory immediately.
          </span>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-sm px-8 py-3 rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Registering Staff Member...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Save Staff Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
