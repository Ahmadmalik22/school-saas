import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../config/db.js';
import SchoolProfile from '../models/SchoolProfile.js';

async function updateLogos() {
  await connectDB();

  // 1. IMCB SVG
  const imcbSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>
    <defs>
      <linearGradient id='navyGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='#041633'/>
        <stop offset='100%' stop-color='#0a2558'/>
      </linearGradient>
      <linearGradient id='goldGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='#ffb300'/>
        <stop offset='100%' stop-color='#e65100'/>
      </linearGradient>
    </defs>
    <path d='M80 8 C120 8 148 24 148 58 C148 108 98 146 80 154 C62 146 12 108 12 58 C12 24 40 8 80 8 Z' fill='url(#navyGrad)' stroke='url(#goldGrad)' stroke-width='5'/>
    <path d='M80 16 C114 16 140 29 140 58 C140 102 96 138 80 144 C64 138 20 102 20 58 C20 29 46 16 80 16 Z' fill='none' stroke='#ffa000' stroke-width='1.5' stroke-dasharray='4 2'/>
    <!-- Academic Torch & Star -->
    <circle cx='80' cy='46' r='12' fill='url(#goldGrad)' opacity='0.2'/>
    <path d='M80 34 L82.5 41 L89 41.5 L84 45.5 L86 52 L80 48 L74 52 L76 45.5 L71 41.5 L77.5 41 Z' fill='url(#goldGrad)'/>
    <!-- Open Book -->
    <path d='M80 78 C90 70 108 72 118 76 L118 98 C108 94 90 92 80 100 C70 92 52 94 42 98 L42 76 C52 72 70 70 80 78 Z' fill='#ffffff' stroke='url(#goldGrad)' stroke-width='2'/>
    <line x1='80' y1='78' x2='80' y2='100' stroke='url(#goldGrad)' stroke-width='2'/>
    <!-- Text IMCB -->
    <text x='80' y='122' font-family='Arial, sans-serif' font-weight='900' font-size='15' fill='url(#goldGrad)' text-anchor='middle' letter-spacing='2'>IMCB</text>
    <text x='80' y='134' font-family='Arial, sans-serif' font-weight='bold' font-size='7' fill='#94a3b8' text-anchor='middle' letter-spacing='1'>ESTD 1986</text>
  </svg>`;

  // 2. Beaconhouse SVG
  const bssSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>
    <defs>
      <linearGradient id='bssBlue' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='#0f172a'/>
        <stop offset='100%' stop-color='#1e3a8a'/>
      </linearGradient>
      <linearGradient id='bssFlame' x1='0%' y1='100%' x2='100%' y2='0%'>
        <stop offset='0%' stop-color='#f59e0b'/>
        <stop offset='50%' stop-color='#fbbf24'/>
        <stop offset='100%' stop-color='#ef4444'/>
      </linearGradient>
    </defs>
    <rect x='10' y='10' width='140' height='140' rx='28' fill='url(#bssBlue)' stroke='#f59e0b' stroke-width='4'/>
    <!-- Torch Flame -->
    <path d='M80 30 C86 42 98 52 96 66 C94 80 82 86 80 86 C78 86 66 80 64 66 C62 52 74 42 80 30 Z' fill='url(#bssFlame)'/>
    <path d='M80 44 C83 50 88 56 86 64 C84 72 78 74 80 74 C82 74 76 72 74 64 C72 56 77 50 80 44 Z' fill='#fffbeb'/>
    <!-- Torch Handle / Base -->
    <path d='M74 86 L86 86 L83 108 L77 108 Z' fill='#d97706'/>
    <!-- Laurel Wreath -->
    <path d='M50 78 C46 94 56 114 80 118 C104 114 114 94 110 78' fill='none' stroke='#fbbf24' stroke-width='3' stroke-linecap='round'/>
    <!-- Text BSS -->
    <text x='80' y='134' font-family='Arial, sans-serif' font-weight='900' font-size='14' fill='#fbbf24' text-anchor='middle' letter-spacing='2'>BEACONHOUSE</text>
  </svg>`;

  const imcbDataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(imcbSvg);
  const bssDataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(bssSvg);

  await SchoolProfile.findOneAndUpdate(
    { schoolCode: 'SCH-101' },
    {
      $set: {
        logoUrl: imcbDataUri,
        schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
        address: 'PAKISTAN TOWN, ISLAMABAD',
        tagline: 'Excellence in Education & Character Building',
        affiliation: 'Affiliated with Federal Board (FBISE)',
      },
    }
  );
  console.log('✅ Updated SCH-101 logo & branding in MongoDB');

  await SchoolProfile.findOneAndUpdate(
    { schoolCode: 'BSS-01' },
    {
      $set: {
        logoUrl: bssDataUri,
        schoolName: 'Beaconhouse School System',
        address: 'Main Campus, Blue Area, Islamabad',
        tagline: 'Seeking the Light',
        affiliation: 'Cambridge Assessment & Federal Board',
      },
    }
  );
  console.log('✅ Updated BSS-01 logo & branding in MongoDB');

  process.exit(0);
}

updateLogos().catch((err) => {
  console.error(err);
  process.exit(1);
});
