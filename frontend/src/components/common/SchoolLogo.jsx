import React, { useState } from 'react';
import { GraduationCap, School, Shield, Award, Sparkles } from 'lucide-react';

/**
 * Helper to compute elegant school initials from name
 * e.g. "ISLAMABAD MODEL COLLEGE FOR BOYS" => "IMCB"
 * e.g. "Beaconhouse School System" => "BSS"
 * e.g. "Bright Moon Public High School" => "BMPH"
 */
export const getSchoolInitials = (schoolName, schoolCode) => {
  if (!schoolName && !schoolCode) return 'SCH';
  
  if (schoolName) {
    const stopWords = new Set(['FOR', 'AND', 'OF', 'THE', 'IN', 'AT', '&', 'DE']);
    const words = schoolName
      .trim()
      .split(/[\s-]+/)
      .filter((w) => w.length > 0 && !stopWords.has(w.toUpperCase()));

    if (words.length >= 2) {
      return words
        .slice(0, 4)
        .map((w) => w[0].toUpperCase())
        .join('');
    }
    if (words.length === 1 && words[0].length >= 3) {
      return words[0].slice(0, 3).toUpperCase();
    }
  }

  return (schoolCode || 'SCH').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
};

/**
 * Premium White-Label School Logo Component
 * - Renders official uploaded logo image (Base64 data or URL)
 * - If no logo image exists or fails to load, dynamically renders an ultra-luxurious
 *   Heraldic Crest / Academic Emblem with school initials and golden laurels.
 */
export default function SchoolLogo({
  logoUrl,
  schoolName = 'School Portal',
  schoolCode = 'SCH',
  size = 'md',
  className = '',
  ring = true,
  variant = 'gold', // 'gold' | 'navy' | 'light'
}) {
  const [imgError, setImgError] = useState(false);

  // Size dimensions mapping
  const sizeMap = {
    xs: { box: 'w-7 h-7', text: 'text-[9px]', icon: 'w-3 h-3', subText: 'text-[6px]' },
    sm: { box: 'w-9 h-9', text: 'text-[11px]', icon: 'w-4 h-4', subText: 'text-[7px]' },
    md: { box: 'w-11 h-11', text: 'text-xs', icon: 'w-5 h-5', subText: 'text-[8px]' },
    lg: { box: 'w-14 h-14', text: 'text-sm', icon: 'w-6 h-6', subText: 'text-[9px]' },
    xl: { box: 'w-20 h-20', text: 'text-lg', icon: 'w-9 h-9', subText: 'text-[11px]' },
    '2xl': { box: 'w-28 h-28', text: 'text-2xl', icon: 'w-12 h-12', subText: 'text-xs' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const initials = getSchoolInitials(schoolName, schoolCode);

  // If a valid image logo exists and hasn't errored
  const hasValidImage = Boolean(logoUrl && typeof logoUrl === 'string' && logoUrl.trim() && !imgError);

  if (hasValidImage) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden bg-white shadow-sm ${
          currentSize.box
        } ${ring ? 'ring-2 ring-amber-400/50 shadow-md' : ''} ${className}`}
        title={schoolName}
      >
        <img
          src={logoUrl}
          alt={schoolName}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-0.5 select-none"
        />
      </div>
    );
  }

  // Fallback: Ultra-luxurious collegiate heraldic crest
  const isGoldVariant = variant === 'gold';
  const bgClasses = isGoldVariant
    ? 'bg-gradient-to-br from-[#041633] via-[#09224f] to-[#041633] text-[#ffa000] border border-amber-500/40 shadow-lg'
    : 'bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 text-slate-950 border border-amber-300 shadow-md';

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center shrink-0 rounded-xl select-none transition-transform hover:scale-105 ${
        currentSize.box
      } ${bgClasses} ${ring ? 'ring-2 ring-amber-400/30' : ''} ${className}`}
      title={`${schoolName} Official Seal`}
    >
      {/* Decorative Heraldic Shield Crest */}
      <div className="flex flex-col items-center justify-center leading-none text-center px-1">
        <GraduationCap
          className={`${currentSize.icon} ${
            isGoldVariant ? 'text-amber-400' : 'text-slate-900'
          } drop-shadow-xs mb-0.5`}
        />
        <span
          className={`font-black tracking-wider uppercase font-mono ${currentSize.text} leading-none ${
            isGoldVariant ? 'text-white' : 'text-slate-950'
          }`}
        >
          {initials}
        </span>
      </div>

      {/* Tiny decorative star watermark */}
      <div
        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center ${
          isGoldVariant ? 'bg-amber-500 text-slate-950' : 'bg-[#041633] text-amber-400'
        } shadow-xs border border-amber-300/40`}
      >
        <Sparkles className="w-2 h-2" />
      </div>
    </div>
  );
}
