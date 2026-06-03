import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  login as loginApi,
  requestLoginOtp as requestLoginOtpApi,
  verifyLoginOtp as verifyLoginOtpApi,
  requestForgotPasswordOtp as requestForgotPasswordOtpApi,
  resetPasswordWithOtp as resetPasswordWithOtpApi,
} from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import './Login.css';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   POSTERS  â€” 10 vehicle poster panels, pure CSS + SVG
   Each has a gradient background, SVG vehicle, headline & tag
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const POSTERS = [
  {
    id: 1,
    bg: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0369a1 100%)',
    accent: '#38bdf8',
    title: 'LONG HAUL CHAMPION',
    sub: 'Built for the endless highway',
    tag: 'HEAVY TRUCKS',
    vehicle: (
      <svg viewBox="0 0 320 120" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(56,189,248,0.4))' }}>
        <rect x="60" y="20" width="220" height="70" rx="6" fill="#1e40af" opacity=".9"/>
        <rect x="20" y="34" width="52" height="56" rx="5" fill="#1d4ed8"/>
        <rect x="25" y="39" width="38" height="26" rx="3" fill="#bfdbfe" opacity=".85"/>
        <rect x="72" y="28" width="200" height="50" rx="4" fill="#1e3a8a"/>
        {[100,140,180,220].map(x => <line key={x} x1={x} y1="28" x2={x} y2="78" stroke="#3b82f6" strokeWidth="1.5" opacity=".6"/>)}
        <rect x="16" y="48" width="8" height="14" rx="2" fill="#fde68a"/>
        <rect x="282" y="52" width="7" height="10" rx="2" fill="#fca5a5"/>
        {[56,230,256].map(cx => (
          <g key={cx}><circle cx={cx} cy="92" r="16" fill="#0f172a"/><circle cx={cx} cy="92" r="9" fill="#334155"/><circle cx={cx} cy="92" r="4" fill="#64748b"/></g>
        ))}
        <text x="100" y="60" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif" opacity=".9">DRIVEINNOVATE LOGISTICS</text>
      </svg>
    ),
  },
  {
    id: 2,
    bg: 'linear-gradient(160deg,#064e3b 0%,#065f46 50%,#047857 100%)',
    accent: '#34d399',
    title: 'SILENT HIGHWAY',
    sub: 'Zero emission, maximum range',
    tag: 'ELECTRIC FLEET',
    vehicle: (
      <svg viewBox="0 0 280 90" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(52,211,153,0.4))' }}>
        <rect x="30" y="28" width="210" height="42" rx="6" fill="#065f46"/>
        <path d="M55 28 C62 10 218 10 225 28" fill="#047857" opacity=".9"/>
        <rect x="62" y="13" width="48" height="18" rx="3" fill="#a7f3d0" opacity=".8"/>
        <rect x="120" y="13" width="48" height="18" rx="3" fill="#a7f3d0" opacity=".8"/>
        <rect x="178" y="13" width="38" height="18" rx="3" fill="#a7f3d0" opacity=".6"/>
        <rect x="26" y="36" width="9" height="12" rx="2" fill="#fde68a"/>
        <rect x="245" y="36" width="7" height="12" rx="2" fill="#fca5a5"/>
        {[65,215].map(cx => (
          <g key={cx}><circle cx={cx} cy="72" r="14" fill="#022c22"/><circle cx={cx} cy="72" r="7" fill="#064e3b"/><circle cx={cx} cy="72" r="3" fill="#34d399"/></g>
        ))}
        <text x="105" y="52" fill="#a7f3d0" fontSize="9" fontWeight="bold" fontFamily="sans-serif">ELECTRIC - ZERO EMISSION</text>
      </svg>
    ),
  },
  {
    id: 3,
    bg: 'linear-gradient(160deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
    accent: '#fb923c',
    title: 'IRON TITAN',
    sub: 'Heavy-duty, built to dominate',
    tag: 'CONSTRUCTION',
    vehicle: (
      <svg viewBox="0 0 300 110" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(251,146,60,0.4))' }}>
        <rect x="40" y="50" width="220" height="40" rx="4" fill="#9a3412"/>
        <rect x="40" y="30" width="80" height="26" rx="4" fill="#b45309" opacity=".9"/>
        <rect x="46" y="35" width="62" height="16" rx="2" fill="#fef3c7" opacity=".7"/>
        <rect x="120" y="40" width="140" height="14" rx="2" fill="#92400e"/>
        <rect x="36" y="54" width="8" height="14" rx="2" fill="#fde68a"/>
        <rect x="264" y="54" width="7" height="10" rx="2" fill="#fca5a5"/>
        {[75,210,240].map(cx => (
          <g key={cx}><circle cx={cx} cy="92" r="14" fill="#1c0a00"/><circle cx={cx} cy="92" r="8" fill="#431407"/><circle cx={cx} cy="92" r="4" fill="#fb923c"/></g>
        ))}
        <text x="128" y="60" fill="#fed7aa" fontSize="9" fontWeight="bold" fontFamily="sans-serif">TITAN HEAVY MACHINERY</text>
      </svg>
    ),
  },
  {
    id: 4,
    bg: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%)',
    accent: '#a78bfa',
    title: 'MIDNIGHT RUNNER',
    sub: 'Luxury redefined, precision engineered',
    tag: 'PREMIUM SEDAN',
    vehicle: (
      <svg viewBox="0 0 240 80" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(167,139,250,0.4))' }}>
        <rect x="20" y="36" width="196" height="28" rx="5" fill="#312e81"/>
        <path d="M38 36 C46 16 194 16 202 36" fill="#3730a3" opacity=".95"/>
        <rect x="54" y="19" width="46" height="19" rx="3" fill="#c4b5fd" opacity=".75"/>
        <rect x="112" y="19" width="46" height="19" rx="3" fill="#c4b5fd" opacity=".75"/>
        <rect x="16" y="42" width="8" height="12" rx="2" fill="#fde68a"/>
        <rect x="213" y="42" width="7" height="12" rx="2" fill="#fca5a5"/>
        {[55,185].map(cx => (
          <g key={cx}><circle cx={cx} cy="66" r="12" fill="#0f0e20"/><circle cx={cx} cy="66" r="6" fill="#1e1b4b"/><circle cx={cx} cy="66" r="3" fill="#a78bfa"/></g>
        ))}
        <text x="88" y="50" fill="#ddd6fe" fontSize="9" fontWeight="bold" fontFamily="sans-serif">PREMIUM Â· 2025</text>
      </svg>
    ),
  },
  {
    id: 5,
    bg: 'linear-gradient(160deg,#0c1445 0%,#1a237e 50%,#283593 100%)',
    accent: '#60a5fa',
    title: 'CITY CONNECTOR',
    sub: 'Moving millions, every single day',
    tag: 'CITY BUS FLEET',
    vehicle: (
      <svg viewBox="0 0 300 100" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(96,165,250,0.4))' }}>
        <rect x="10" y="16" width="278" height="64" rx="8" fill="#1565c0" opacity=".9"/>
        <rect x="10" y="16" width="278" height="24" rx="8" fill="#0d47a1"/>
        {[20,56,92,128,164,200,236].map(x => (
          <rect key={x} x={x} y="20" width="28" height="18" rx="3" fill="#e3f2fd" opacity=".85"/>
        ))}
        <rect x="6"  y="32" width="8" height="16" rx="2" fill="#fde68a"/>
        <rect x="284" y="32" width="8" height="16" rx="2" fill="#fca5a5"/>
        <text x="90" y="56" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">CITY TRANSIT - DRIVEINNOVATE</text>
        {[55,245].map(cx => (
          <g key={cx}><circle cx={cx} cy="84" r="13" fill="#01002e"/><circle cx={cx} cy="84" r="7" fill="#0d47a1"/><circle cx={cx} cy="84" r="3" fill="#60a5fa"/></g>
        ))}
      </svg>
    ),
  },
  {
    id: 6,
    bg: 'linear-gradient(160deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)',
    accent: '#2dd4bf',
    title: 'LAST MILE HERO',
    sub: 'On time, every time, everywhere',
    tag: 'DELIVERY VAN',
    vehicle: (
      <svg viewBox="0 0 260 95" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(45,212,191,0.4))' }}>
        <rect x="20" y="22" width="220" height="56" rx="6" fill="#0f766e" opacity=".9"/>
        <rect x="20" y="22" width="60" height="56" rx="6" fill="#0d9488"/>
        <rect x="24" y="28" width="48" height="30" rx="3" fill="#ccfbf1" opacity=".8"/>
        <rect x="88" y="30" width="146" height="38" rx="4" fill="#0c6961"/>
        {[110,150,190].map(x => <line key={x} x1={x} y1="30" x2={x} y2="68" stroke="#14b8a6" strokeWidth="1.5" opacity=".5"/>)}
        <rect x="16" y="36" width="8" height="14" rx="2" fill="#fde68a"/>
        <rect x="242" y="40" width="7" height="10" rx="2" fill="#fca5a5"/>
        <text x="100" y="54" fill="#99f6e4" fontSize="9" fontWeight="bold" fontFamily="sans-serif">EXPRESS DELIVERY</text>
        {[52,208].map(cx => (
          <g key={cx}><circle cx={cx} cy="80" r="13" fill="#042f2e"/><circle cx={cx} cy="80" r="6" fill="#134e4a"/><circle cx={cx} cy="80" r="3" fill="#2dd4bf"/></g>
        ))}
      </svg>
    ),
  },
  {
    id: 7,
    bg: 'linear-gradient(160deg,#450a0a 0%,#7f1d1d 50%,#991b1b 100%)',
    accent: '#f87171',
    title: 'EMERGENCY RESPONSE',
    sub: 'Every second counts - we deliver',
    tag: 'AMBULANCE FLEET',
    vehicle: (
      <svg viewBox="0 0 270 90" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(248,113,113,0.4))' }}>
        <rect x="15" y="20" width="240" height="52" rx="6" fill="#fafafa" opacity=".92"/>
        <rect x="15" y="20" width="240" height="8" rx="6" fill="#ef4444"/>
        <rect x="15" y="55" width="240" height="6" fill="#ef4444"/>
        <rect x="18" y="28" width="50" height="28" rx="3" fill="#bfdbfe" opacity=".8"/>
        <text x="85" y="45" fill="#7f1d1d" fontSize="13" fontWeight="bold" fontFamily="sans-serif">+ AMBULANCE</text>
        <rect x="12" y="30" width="8" height="16" rx="2" fill="#fde68a"/>
        <rect x="254" y="30" width="7" height="14" rx="2" fill="#fca5a5"/>
        {[50,218].map(cx => (
          <g key={cx}><circle cx={cx} cy="76" r="12" fill="#450a0a"/><circle cx={cx} cy="76" r="6" fill="#7f1d1d"/><circle cx={cx} cy="76" r="3" fill="#f87171"/></g>
        ))}
      </svg>
    ),
  },
  {
    id: 8,
    bg: 'linear-gradient(160deg,#0a0a0a 0%,#1c1917 50%,#292524 100%)',
    accent: '#fbbf24',
    title: 'GOLDEN MILE',
    sub: 'Carry the load the world depends on',
    tag: 'TANKER FLEET',
    vehicle: (
      <svg viewBox="0 0 320 100" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(251,191,36,0.35))' }}>
        <rect x="50" y="30" width="60" height="46" rx="5" fill="#292524"/>
        <rect x="54" y="34" width="46" height="26" rx="3" fill="#a3a3a3" opacity=".7"/>
        <ellipse cx="185" cy="52" rx="80" ry="26" fill="#44403c"/>
        <ellipse cx="185" cy="52" rx="74" ry="20" fill="#292524" opacity=".6"/>
        {[130,160,190,220,240].map(x => <line key={x} x1={x} y1="32" x2={x} y2="72" stroke="#fbbf24" strokeWidth="1" opacity=".3"/>)}
        <rect x="44" y="44" width="8" height="14" rx="2" fill="#fde68a"/>
        <rect x="270" y="46" width="7" height="10" rx="2" fill="#fca5a5"/>
        <text x="145" y="56" fill="#fde68a" fontSize="9" fontWeight="bold" fontFamily="sans-serif">FUEL TANKER</text>
        {[78,250,278].map(cx => (
          <g key={cx}><circle cx={cx} cy="80" r="13" fill="#0c0a09"/><circle cx={cx} cy="80" r="7" fill="#1c1917"/><circle cx={cx} cy="80" r="3" fill="#fbbf24"/></g>
        ))}
      </svg>
    ),
  },
  {
    id: 9,
    bg: 'linear-gradient(160deg,#042f2e 0%,#064e3b 50%,#065f46 100%)',
    accent: '#6ee7b7',
    title: 'GREEN CORRIDORS',
    sub: 'Sustainable logistics for tomorrow',
    tag: 'CARGO TRUCK',
    vehicle: (
      <svg viewBox="0 0 320 110" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(110,231,183,0.35))' }}>
        <rect x="55" y="18" width="220" height="68" rx="6" fill="#064e3b" opacity=".9"/>
        <rect x="15" y="30" width="52" height="56" rx="5" fill="#065f46"/>
        <rect x="20" y="36" width="38" height="26" rx="3" fill="#a7f3d0" opacity=".8"/>
        <rect x="70" y="26" width="198" height="52" rx="4" fill="#047857" opacity=".8"/>
        {[100,140,180,220,255].map(x => <line key={x} x1={x} y1="26" x2={x} y2="78" stroke="#10b981" strokeWidth="1.5" opacity=".5"/>)}
        <rect x="11" y="46" width="8" height="14" rx="2" fill="#fde68a"/>
        <rect x="278" y="48" width="7" height="10" rx="2" fill="#fca5a5"/>
        <text x="120" y="58" fill="#a7f3d0" fontSize="9" fontWeight="bold" fontFamily="sans-serif">ECO CARGO - DRIVEINNOVATE</text>
        {[52,230,258].map(cx => (
          <g key={cx}><circle cx={cx} cy="90" r="14" fill="#021a17"/><circle cx={cx} cy="90" r="8" fill="#042f2e"/><circle cx={cx} cy="90" r="3" fill="#6ee7b7"/></g>
        ))}
      </svg>
    ),
  },
  {
    id: 10,
    bg: 'linear-gradient(160deg,#0c0a1e 0%,#1a1040 50%,#2e1065 100%)',
    accent: '#e879f9',
    title: 'NIGHT CRUISER',
    sub: 'Own the road after dark',
    tag: 'LUXURY SUV',
    vehicle: (
      <svg viewBox="0 0 260 85" style={{ width: '100%', filter: 'drop-shadow(0 8px 32px rgba(232,121,249,0.4))' }}>
        <rect x="20" y="30" width="218" height="36" rx="5" fill="#2e1065" opacity=".9"/>
        <path d="M38 30 C46 12 212 12 220 30" fill="#4c1d95" opacity=".95"/>
        <rect x="50" y="14" width="44" height="18" rx="3" fill="#e9d5ff" opacity=".75"/>
        <rect x="104" y="14" width="50" height="18" rx="3" fill="#e9d5ff" opacity=".75"/>
        <rect x="164" y="14" width="42" height="18" rx="3" fill="#e9d5ff" opacity=".6"/>
        <rect x="15" y="38" width="9" height="14" rx="2" fill="#fde68a"/>
        <rect x="235" y="38" width="7" height="14" rx="2" fill="#e879f9"/>
        {[57,200].map(cx => (
          <g key={cx}><circle cx={cx} cy="68" r="13" fill="#05010f"/><circle cx={cx} cy="68" r="7" fill="#2e1065"/><circle cx={cx} cy="68" r="3" fill="#e879f9"/></g>
        ))}
        <text x="88" y="48" fill="#f0abfc" fontSize="9" fontWeight="bold" fontFamily="sans-serif">LUXURY SUV Â· 2025</text>
      </svg>
    ),
  },
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   THEMES & LAYOUTS for the non-poster modes
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const THEMES = [
  { id: 'night',   label: 'Night City', dot: '#60a5fa', accent: '#60a5fa', bg: '#0a0f1e' },
  { id: 'space',   label: 'Space',      dot: '#a78bfa', accent: '#a78bfa', bg: '#0d0820' },
  { id: 'sunrise', label: 'Sunrise',    dot: '#fb923c', accent: '#fb923c', bg: '#fff7ed' },
];
const LAYOUTS = [
  { id: 'poster', icon: 'P', label: 'Poster'      },
  { id: 'right',  icon: 'R', label: 'Scene Left'  },
  { id: 'left',   icon: 'L', label: 'Scene Right' },
  { id: 'card',   icon: 'C', label: 'Float Card'  },
  { id: 'split',  icon: 'S', label: 'Split'       },
];

const NightScene = () => {
  const stars = Array.from({ length: 45 }, (_, i) => ({ x:(i*97+13)%95, y:(i*61+7)%55, r:(i%3)*.8+.5, d:(i%5)*.4 }));
  return (
    <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#020818 0%,#0a1628 60%,#0d2240 100%)', overflow:'hidden' }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
        {stars.map((s,i) => <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={0.5+s.d}><animate attributeName="opacity" values={`${0.3+s.d};1;${0.3+s.d}`} dur={`${2+s.d}s`} repeatCount="indefinite"/></circle>)}
      </svg>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'35%', background:'linear-gradient(0deg,#0d1b2a,transparent)' }}>
        <svg viewBox="0 0 400 100" style={{ width:'100%', height:'100%' }} preserveAspectRatio="none">
          {[0,40,80,120,160,200,240,280,320,360].map((x,i)=><rect key={x} x={x} y={i%3===0?30:i%3===1?50:40} width="35" height={70} fill={`hsl(${210+i*5},${40+i*3}%,${10+i*2}%)`}/>)}
          {[10,50,90,130,170,210,250,290].map((x,i)=>[...Array(3)].map((_,r)=>[...Array(4)].map((_,c)=><rect key={`${x}-${r}-${c}`} x={x+c*7} y={40+r*10} width="5" height="7" fill={Math.random()>.5?"#fbbf24":"#1e3a5f"} opacity=".9"/>)))}
        </svg>
      </div>
      <div style={{ position:'absolute', bottom:'32%', left:'5%', right:'5%', height:'6px', background:'linear-gradient(90deg,#1e3a5f,#2563eb,#1e3a5f)' }}/>
    </div>
  );
};
const SpaceScene = () => (
  <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#020010 0%,#0d0820 50%,#1a0a40 100%)', overflow:'hidden' }}>
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
      {Array.from({length:60},(_,i)=><circle key={i} cx={`${(i*73+17)%95}%`} cy={`${(i*47+9)%85}%`} r={(i%4)*.6+.3} fill={['#fff','#a78bfa','#60a5fa','#f9a8d4'][i%4]} opacity={.4+((i%3)*.2)}><animate attributeName="opacity" values={`${.3};1;${.3}`} dur={`${1.5+(i%5)*.5}s`} repeatCount="indefinite"/></circle>)}
      <ellipse cx="50%" cy="55%" rx="120" ry="90" fill="none" stroke="#a78bfa" strokeWidth="1" opacity=".15"/>
      <ellipse cx="50%" cy="55%" rx="160" ry="120" fill="none" stroke="#7c3aed" strokeWidth="1" opacity=".1"/>
    </svg>
    <div style={{ position:'absolute', left:'50%', top:'45%', transform:'translate(-50%,-50%)', width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,#3b1d8a,#1e0a5e)', boxShadow:'0 0 60px 20px rgba(139,92,246,.3)' }}/>
  </div>
);
const SunriseScene = () => (
  <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#fed7aa 0%,#fbbf24 30%,#f97316 60%,#c2410c 100%)', overflow:'hidden' }}>
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
      <circle cx="50%" cy="42%" r="14%" fill="#fef9c3" opacity=".9"/>
      <circle cx="50%" cy="42%" r="18%" fill="#fef3c7" opacity=".3"/>
      {Array.from({length:12},(_,i)=><line key={i} x1="50%" y1="42%" x2={`${50+Math.cos(i*30*Math.PI/180)*55}%`} y2={`${42+Math.sin(i*30*Math.PI/180)*55}%`} stroke="#fde68a" strokeWidth="1.5" opacity=".25"/>)}
    </svg>
    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'25%', background:'linear-gradient(0deg,#7c2d12 0%,transparent)' }}>
      <svg viewBox="0 0 400 80" style={{ width:'100%', height:'100%' }} preserveAspectRatio="none">
        <path d="M0 80 L0 40 Q50 20 100 35 Q150 50 200 30 Q250 10 300 35 Q350 55 400 30 L400 80 Z" fill="#431407" opacity=".8"/>
      </svg>
    </div>
  </div>
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const Login = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm] = useState({
    email: '', password: '', otp: '',
    newPassword: '', confirmPassword: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'otp' | 'forgot'
  const [layout,   setLayout]   = useState(() => localStorage.getItem('login-layout')  || 'poster');
  const [theme,    setTheme]    = useState(() => localStorage.getItem('login-theme')   || 'night');
  const [forgotOtpRequested,  setForgotOtpRequested]  = useState(false);
  const [loginOtpSentTo,      setLoginOtpSentTo]      = useState('');
  const [forgotOtpSentTo,     setForgotOtpSentTo]     = useState('');
  const [loginOtpCooldown,    setLoginOtpCooldown]    = useState(0);
  const [forgotOtpCooldown,   setForgotOtpCooldown]   = useState(0);

  // Poster carousel
  const [posterIdx,   setPosterIdx]   = useState(0);
  const [fading,      setFading]      = useState(false);
  const timerRef = useRef(null);

  const advancePoster = () => {
    setFading(true);
    setTimeout(() => {
      setPosterIdx(i => (i + 1) % POSTERS.length);
      setFading(false);
    }, 500);
  };

  useEffect(() => {
    timerRef.current = setInterval(advancePoster, 10000);
    return () => clearInterval(timerRef.current);
  }, []);

  const goToPoster = (idx) => {
    clearInterval(timerRef.current);
    setFading(true);
    setTimeout(() => { setPosterIdx(idx); setFading(false); }, 300);
    timerRef.current = setInterval(advancePoster, 10000);
  };

  // OTP cooldown timers
  useEffect(() => {
    if (loginOtpCooldown <= 0) return;
    const t = setInterval(() => setLoginOtpCooldown(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [loginOtpCooldown]);
  useEffect(() => {
    if (forgotOtpCooldown <= 0) return;
    const t = setInterval(() => setForgotOtpCooldown(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [forgotOtpCooldown]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi({ email: form.email, password: form.password });
      if (res.success) { login(res.data.user, res.data.token); toast.success('Welcome back!'); navigate('/dashboard'); }
    } catch (err) { toast.error(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  const handleRequestLoginOtp = async () => {
    if (!form.email) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      const res = await requestLoginOtpApi({ email: form.email });
      if (res.success) {
        toast.success('OTP sent');
        setAuthMode('otp'); setLoginOtpSentTo(form.email); setLoginOtpCooldown(30);
        if (res.data?.devOtp) toast.info(`Dev OTP: ${res.data.devOtp}`);
      }
    } catch (err) { toast.error(err.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    if (!form.email || !form.otp) { toast.error('Email and OTP required'); return; }
    setLoading(true);
    try {
      const res = await verifyLoginOtpApi({ email: form.email, otp: form.otp });
      if (res.success) { login(res.data.user, res.data.token); toast.success('Welcome back!'); navigate('/dashboard'); }
    } catch (err) { toast.error(err.message || 'OTP verification failed'); }
    finally { setLoading(false); }
  };

  const handleRequestForgotPasswordOtp = async () => {
    if (!form.email) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      const res = await requestForgotPasswordOtpApi({ email: form.email });
      if (res.success) {
        setForgotOtpRequested(true); toast.success('Reset OTP sent');
        setForgotOtpSentTo(form.email); setForgotOtpCooldown(30);
        if (res.data?.devOtp) toast.info(`Dev OTP: ${res.data.devOtp}`);
      }
    } catch (err) { toast.error(err.message || 'Failed to send reset OTP'); }
    finally { setLoading(false); }
  };

  const handleResetPasswordWithOtp = async (e) => {
    e.preventDefault();
    if (!form.email || !form.otp || !form.newPassword) { toast.error('All fields required'); return; }
    if (form.newPassword.length < 6) { toast.error('Password min 6 chars'); return; }
    if (form.newPassword !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await resetPasswordWithOtpApi({ email: form.email, otp: form.otp, newPassword: form.newPassword });
      if (res.success) {
        toast.success('Password reset. Sign in now.');
        setAuthMode('password'); setForgotOtpRequested(false);
        setForm(p => ({ ...p, otp: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) { toast.error(err.message || 'Reset failed'); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    if (authMode === 'password') return handlePasswordLogin(e);
    if (authMode === 'otp')      return handleVerifyLoginOtp(e);
    return handleResetPasswordWithOtp(e);
  };

  const poster = POSTERS[posterIdx];
  const isLeft     = layout === 'left';
  const isFloatCard = layout === 'card';
  const isSplit    = layout === 'split';
  const isPoster   = layout === 'poster';

  const inp = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s', fontFamily: 'inherit', background: '#fff',
  };
  const lbl = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
  };

  /* â”€â”€ Reusable theme+layout picker â”€â”€ */
  const themePicker = (
    <div style={{ position:'fixed', bottom:20, left:20, zIndex:9000, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:14, padding:'12px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.28)' }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.50)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:10 }}>Theme</div>
        <div style={{ display:'flex', gap:8 }}>
          {THEMES.map(t => (
            <button key={t.id} onClick={() => { setTheme(t.id); localStorage.setItem('login-theme', t.id); }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'8px 10px', borderRadius:10, cursor:'pointer', background: theme===t.id ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)', border: theme===t.id ? `1.5px solid ${t.accent}` : '1.5px solid rgba(255,255,255,0.12)', boxShadow: theme===t.id ? `0 0 10px ${t.accent}60` : 'none', transition:'all 0.18s', minWidth:52 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:t.bg, border:`3px solid ${t.accent}`, boxShadow:`0 0 6px ${t.accent}80` }} />
              <span style={{ fontSize:9, fontWeight:700, color: theme===t.id ? '#fff' : 'rgba(255,255,255,0.5)', whiteSpace:'nowrap' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:14, padding:'12px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.28)' }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.50)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:10 }}>Layout</div>
        <div style={{ display:'flex', gap:6 }}>
          {LAYOUTS.map(l => (
            <button key={l.id} onClick={() => { setLayout(l.id); localStorage.setItem('login-layout', l.id); }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'7px 9px', borderRadius:10, cursor:'pointer', background: layout===l.id ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)', border: layout===l.id ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid rgba(255,255,255,0.12)', transition:'all 0.18s', minWidth:40 }}>
              <span style={{ fontSize:12, fontWeight:800, lineHeight:1, width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, background: layout===l.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)', color:'#fff' }}>{l.icon}</span>
              <span style={{ fontSize:8, fontWeight:700, color: layout===l.id ? '#fff' : 'rgba(255,255,255,0.5)', whiteSpace:'nowrap' }}>{l.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* The formPanel JSX is shared across all layouts */
  const formPanel = (extraStyle = {}) => (
    <div style={{ background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'36px 40px', overflowY:'auto', ...extraStyle }}>
      <div style={{ width:'100%', maxWidth: isFloatCard||isSplit ? '380px' : '100%' }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: isSplit ? 16 : 28 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 12px rgba(37,99,235,.35)' }}>DI</div>
            <div><div style={{ fontSize:16, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em' }}>DriveInnovate</div><div style={{ fontSize:11, color:'#94a3b8' }}>Fleet Management Platform</div></div>
          </div>
          <h2 style={{ fontSize:24, fontWeight:900, color:'#0f172a', margin:'0 0 4px', letterSpacing:'-0.03em' }}>
            {authMode==='forgot' ? 'Reset Password' : 'Sign in'}
          </h2>
          <p style={{ fontSize:13, color:'#64748b', margin:0 }}>
            {authMode==='forgot' ? 'Enter your email to receive a reset code' : 'Welcome back to your fleet dashboard'}
          </p>
        </div>
        {authMode !== 'forgot' && (
          <div style={{ display:'flex', gap:8, marginBottom:22, background:'#f1f5f9', borderRadius:10, padding:4 }}>
            {[['password','Password'],['otp','OTP Login']].map(([m,l]) => (
              <button key={m} type="button" onClick={() => setAuthMode(m)}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background: authMode===m ? '#fff' : 'transparent', color: authMode===m ? '#2563eb' : '#64748b', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow: authMode===m ? '0 1px 6px rgba(0,0,0,0.10)' : 'none', transition:'all 0.2s', fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Email Address</label>
            <input type="email" name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} required style={inp} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
          </div>
          {authMode==='password' && (<>
            <div style={{ marginBottom:8 }}>
              <label style={lbl}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPass?'text':'password'} name="password" placeholder="Enter your password" value={form.password} onChange={handleChange} required style={{ ...inp, paddingRight:42 }} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                <span onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:15, userSelect:'none' }}>{showPass ? 'Hide' : 'Show'}</span>
              </div>
            </div>
            <div style={{ textAlign:'right', marginBottom:22 }}>
              <button type="button" onClick={() => { setAuthMode('forgot'); setForgotOtpRequested(false); }} style={{ background:'none', border:'none', color:'#2563eb', fontSize:13, cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>Forgot password?</button>
            </div>
          </>)}
          {authMode==='otp' && (<>
            {loginOtpSentTo ? (
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>OTP Code</label>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>Sent to <strong>{loginOtpSentTo}</strong></div>
                <input type="text" name="otp" placeholder="6-digit OTP" value={form.otp} onChange={handleChange} maxLength={6} required style={{ ...inp, fontFamily:'monospace', fontSize:20, letterSpacing:'0.3em', textAlign:'center' }} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                <button type="button" onClick={handleRequestLoginOtp} disabled={loginOtpCooldown>0||loading} style={{ marginTop:8, background:'none', border:'none', color:'#2563eb', fontSize:13, cursor: loginOtpCooldown>0?'not-allowed':'pointer', fontFamily:'inherit' }}>{loginOtpCooldown>0?`Resend in ${loginOtpCooldown}s`:'Resend OTP'}</button>
              </div>
            ) : (
              <div style={{ marginBottom:20 }}>
                <button type="button" onClick={handleRequestLoginOtp} disabled={loading} style={{ width:'100%', padding:'11px', background:'#f1f5f9', border:'1.5px solid #e2e8f0', borderRadius:10, color:'#2563eb', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{loading ? 'Sending...' : 'Send OTP to Email'}</button>
              </div>
            )}
          </>)}
          {authMode==='forgot' && (<>
            {!forgotOtpRequested ? (
              <div style={{ marginBottom:20 }}>
                <button type="button" onClick={handleRequestForgotPasswordOtp} disabled={loading} style={{ width:'100%', padding:'11px', background:'#f1f5f9', border:'1.5px solid #e2e8f0', borderRadius:10, color:'#2563eb', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{loading ? 'Sending...' : 'Send Reset OTP'}</button>
              </div>
            ) : (<>
              <div style={{ marginBottom:14 }}><label style={lbl}>OTP</label><div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Sent to <strong>{forgotOtpSentTo}</strong></div><input type="text" name="otp" maxLength={6} value={form.otp} onChange={handleChange} required style={{ ...inp, fontFamily:'monospace', fontSize:20, letterSpacing:'0.3em', textAlign:'center' }} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/></div>
              <div style={{ marginBottom:14 }}><label style={lbl}>New Password</label><input type="password" name="newPassword" placeholder="Min 6 characters" value={form.newPassword} onChange={handleChange} required style={inp} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/></div>
              <div style={{ marginBottom:20 }}><label style={lbl}>Confirm Password</label><input type="password" name="confirmPassword" placeholder="Repeat new password" value={form.confirmPassword} onChange={handleChange} required style={inp} onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/></div>
            </>)}
          </>)}
          {(authMode!=='forgot' || forgotOtpRequested) && (authMode!=='otp' || loginOtpSentTo) && (
            <button type="submit" disabled={loading} style={{ width:'100%', padding:'13px', background: loading?'#93c5fd':'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor: loading?'not-allowed':'pointer', boxShadow: loading?'none':'0 4px 18px rgba(37,99,235,0.38)', transition:'all 0.2s', fontFamily:'inherit', marginBottom:8 }}>
              {loading ? 'Processing...' : authMode==='password' ? 'Sign In' : authMode==='otp' ? 'Verify and Sign In' : 'Reset Password'}
            </button>
          )}
          {authMode==='forgot' && <button type="button" onClick={() => { setAuthMode('password'); setForgotOtpRequested(false); }} style={{ width:'100%', padding:'10px', background:'none', border:'1.5px solid #e2e8f0', borderRadius:12, color:'#64748b', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Back to Sign In</button>}
        </form>
        <div style={{ marginTop:24, padding:'14px', background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0', textAlign:'center' }}>
          <span style={{ fontSize:13, color:'#64748b' }}>New to DriveInnovate? </span>
          <Link to="/register" style={{ fontSize:13, fontWeight:700, color:'#2563eb', textDecoration:'none' }}>Create account</Link>
        </div>
      </div>
    </div>
  );

  /* â”€â”€ Float card layout â”€â”€ */
  if (isFloatCard) return (
    <><div style={{ minHeight:'100vh', position:'relative', fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ position:'fixed', inset:0 }}>{theme==='night'&&<NightScene/>}{theme==='space'&&<SpaceScene/>}{theme==='sunrise'&&<SunriseScene/>}</div>
      <div style={{ position:'relative', zIndex:10, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ width:'420px', background:'rgba(255,255,255,0.93)', backdropFilter:'blur(24px)', borderRadius:'22px', boxShadow:'0 24px 80px rgba(0,0,0,0.35)', overflow:'hidden' }}>{formPanel({ padding:'34px 34px' })}</div>
      </div>
    </div>{themePicker}</>
  );
  if (isSplit) return (
    <><div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ height:'52vh', position:'relative', overflow:'hidden', flexShrink:0 }}>{theme==='night'&&<NightScene/>}{theme==='space'&&<SpaceScene/>}{theme==='sunrise'&&<SunriseScene/>}</div>
      <div style={{ flex:1, background:'#fff', overflowY:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,0.15)', display:'flex', justifyContent:'center', borderRadius:'22px 22px 0 0', marginTop:'-20px', position:'relative', zIndex:1 }}>{formPanel({ width:'100%', padding:'24px 20px', alignItems:'center' })}</div>
    </div>{themePicker}</>
  );
  if (!isPoster) return (
    <><div style={{ minHeight:'100vh', display:'flex', flexDirection: isLeft?'row-reverse':'row', fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>{theme==='night'&&<NightScene/>}{theme==='space'&&<SpaceScene/>}{theme==='sunrise'&&<SunriseScene/>}</div>
      {formPanel({ width:'460px', flexShrink:0, boxShadow: isLeft?'8px 0 40px rgba(0,0,0,0.18)':'-8px 0 40px rgba(0,0,0,0.18)' })}
    </div>{themePicker}</>
  );

  /* â”€â”€ Poster layout (default) â”€â”€ */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* â”€â”€ LEFT: Poster panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: poster.bg, transition: 'background 0.8s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Animated poster content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px',
          opacity: fading ? 0 : 1, transform: fading ? 'scale(0.97)' : 'scale(1)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          {/* Tag pill */}
          <div style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 20,
            background: `${poster.accent}22`, border: `1px solid ${poster.accent}55`,
            color: poster.accent, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28,
          }}>
            {poster.tag}
          </div>

          {/* Vehicle SVG */}
          <div style={{ width: '90%', maxWidth: 440, marginBottom: 36 }}>
            {poster.vehicle}
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(24px,3.5vw,42px)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.03em', textAlign: 'center', margin: '0 0 12px',
            lineHeight: 1.1,
            textShadow: `0 0 40px ${poster.accent}60`,
          }}>
            {poster.title}
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center',
            margin: 0, maxWidth: 340, lineHeight: 1.6,
          }}>
            {poster.sub}
          </p>
        </div>

        {/* Dot nav */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          padding: '0 0 32px',
        }}>
          {POSTERS.map((_, i) => (
            <button key={i} onClick={() => goToPoster(i)}
              style={{
                width: i === posterIdx ? 24 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: i === posterIdx ? poster.accent : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease', padding: 0,
              }} />
          ))}
        </div>

        {/* Brand watermark */}
        <div style={{
          position: 'absolute', top: 24, left: 28,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', boxShadow:'0 4px 14px rgba(37,99,235,0.4)' }}>DI</div>





          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
            Drive<span style={{ color: poster.accent }}>Innovate</span>
          </span>
        </div>
      </div>

      {/* â”€â”€ RIGHT: Login form (reuses shared formPanel) â”€â”€ */}
      {formPanel({ width:'480px', flexShrink:0, boxShadow:'-8px 0 48px rgba(0,0,0,0.10)', padding:'40px 48px' })}
      {themePicker}
    </div>
  );
};

export default Login;
