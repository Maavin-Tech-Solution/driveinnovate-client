import React, { useEffect, useState } from 'react';
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


/* ─────────────── SVG VEHICLES ─────────────── */
const Truck = ({ style }) => (
  <svg style={style} viewBox="0 0 160 60" fill="none">
    <rect x="30" y="12" width="100" height="34" rx="4" fill="#2563eb"/>
    <rect x="10" y="20" width="30" height="26" rx="3" fill="#1d4ed8"/>
    <rect x="13" y="23" width="22" height="14" rx="2" fill="#bfdbfe" opacity=".8"/>
    <rect x="36" y="18" width="88" height="22" rx="2" fill="#1e40af"/>
    <line x1="60" y1="18" x2="60" y2="40" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="90" y1="18" x2="90" y2="40" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="120" y1="18" x2="120" y2="40" stroke="#3b82f6" strokeWidth="1.5"/>
    <rect x="8"  y="28" width="5"  height="8" rx="1" fill="#fde68a"/>
    <rect x="130" y="28" width="4" height="8" rx="1" fill="#fca5a5"/>
    <circle cx="35"  cy="46" r="10" fill="#1e293b"/>
    <circle cx="35"  cy="46" r="5"  fill="#94a3b8" style={{animation:'wheelSpin .6s linear infinite',transformOrigin:'35px 46px'}}/>
    <circle cx="110" cy="46" r="10" fill="#1e293b"/>
    <circle cx="110" cy="46" r="5"  fill="#94a3b8" style={{animation:'wheelSpin .6s linear infinite',transformOrigin:'110px 46px'}}/>
    <circle cx="130" cy="46" r="10" fill="#1e293b"/>
    <circle cx="130" cy="46" r="5"  fill="#94a3b8" style={{animation:'wheelSpin .6s linear infinite',transformOrigin:'130px 46px'}}/>
    <text x="58" y="33" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">DRIVEINNOVATE</text>
  </svg>
);

const Car = ({ style }) => (
  <svg style={style} viewBox="0 0 100 40" fill="none">
    <rect x="10" y="18" width="78" height="16" rx="3" fill="#16a34a"/>
    <path d="M20 18 C24 8 76 8 80 18" fill="#15803d"/>
    <rect x="24" y="10" width="20" height="10" rx="2" fill="#bbf7d0" opacity=".8"/>
    <rect x="56" y="10" width="20" height="10" rx="2" fill="#bbf7d0" opacity=".8"/>
    <circle cx="26" cy="34" r="6" fill="#1e293b"/>
    <circle cx="26" cy="34" r="3" fill="#64748b" style={{animation:'wheelSpin .4s linear infinite',transformOrigin:'26px 34px'}}/>
    <circle cx="74" cy="34" r="6" fill="#1e293b"/>
    <circle cx="74" cy="34" r="3" fill="#64748b" style={{animation:'wheelSpin .4s linear infinite',transformOrigin:'74px 34px'}}/>
    <rect x="6" y="22" width="5" height="6" rx="1" fill="#fde68a"/>
    <rect x="89" y="22" width="4" height="6" rx="1" fill="#fca5a5"/>
  </svg>
);

const Bus = ({ style }) => (
  <svg style={style} viewBox="0 0 140 55" fill="none">
    <rect x="5" y="8" width="128" height="38" rx="6" fill="#f59e0b"/>
    <rect x="5" y="8" width="128" height="14" rx="6" fill="#d97706"/>
    <rect x="10" y="12" width="18" height="10" rx="2" fill="#fef3c7" opacity=".9"/>
    <rect x="32" y="12" width="18" height="10" rx="2" fill="#fef3c7" opacity=".9"/>
    <rect x="54" y="12" width="18" height="10" rx="2" fill="#fef3c7" opacity=".9"/>
    <rect x="76" y="12" width="18" height="10" rx="2" fill="#fef3c7" opacity=".9"/>
    <rect x="98" y="12" width="18" height="10" rx="2" fill="#fef3c7" opacity=".9"/>
    <rect x="4" y="20" width="6" height="10" rx="1" fill="#fde68a"/>
    <rect x="130" y="20" width="6" height="10" rx="1" fill="#fca5a5"/>
    <text x="34" y="34" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">DRIVEINNOVATE</text>
    <circle cx="28"  cy="46" r="8" fill="#1e293b"/>
    <circle cx="28"  cy="46" r="4" fill="#94a3b8" style={{animation:'wheelSpin .5s linear infinite',transformOrigin:'28px 46px'}}/>
    <circle cx="110" cy="46" r="8" fill="#1e293b"/>
    <circle cx="110" cy="46" r="4" fill="#94a3b8" style={{animation:'wheelSpin .5s linear infinite',transformOrigin:'110px 46px'}}/>
  </svg>
);

/* ─────────────── FEATURE LIST ─────────────── */
const features = [
  { icon: '📡', text: 'Real-time GPS tracking' },
  { icon: '⛽', text: 'Fuel monitoring & reports' },
  { icon: '📋', text: 'RTO compliance & renewals' },
  { icon: '⚡', text: 'Instant challan alerts' },
  { icon: '📊', text: 'Fleet analytics dashboard' },
];

/* ─────────────── THEME DEFINITIONS ─────────────── */
const THEMES = [
  { id: 'night',   label: '🌃 Night City',    accent: '#60a5fa', bg: '#0a0f1e' },
  { id: 'space',   label: '🚀 Space Mission', accent: '#a78bfa', bg: '#0d0820' },
  { id: 'sunrise', label: '🌅 Sunrise Drive', accent: '#fb923c', bg: '#fff7ed' },
];

/* ─────────────── LAYOUT DEFINITIONS ─────────────── */
const LAYOUTS = [
  { id: 'right',  icon: '▶',  label: 'Scene Left'   },
  { id: 'left',   icon: '◀',  label: 'Scene Right'  },
  { id: 'card',   icon: '⬜', label: 'Float Card'   },
  { id: 'split',  icon: '▬',  label: 'Split'        },
];

/* ═══════════════════════════════════════════
   SCENE 1 — NIGHT CITY
═══════════════════════════════════════════ */
const NightScene = () => {
  const stars = Array.from({ length: 45 }, (_, i) => ({
    x:(i*97+13)%95, y:(i*61+7)%55, r:(i%3)*.8+.5, d:(i%5)*.4,
  }));
  return (
    <div style={{ position:'absolute',inset:0, overflow:'hidden', background:'linear-gradient(180deg,#0a0f1e 0%,#0f2040 40%,#1a3a6e 70%,#1e4080 100%)' }}>
      {/* Stars */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'60%' }} preserveAspectRatio="none">
        {stars.map((s,i)=>(
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
            style={{animation:`starTwinkle ${1.5+s.d}s ease-in-out infinite`,animationDelay:`${s.d}s`}}/>
        ))}
      </svg>
      {/* Moon */}
      <div style={{position:'absolute',top:'6%',right:'18%',width:'54px',height:'54px',borderRadius:'50%',background:'radial-gradient(circle at 35% 40%,#fef9c3,#fde68a)',boxShadow:'0 0 40px 10px rgba(253,230,138,.25)',animation:'glowPulse 4s ease-in-out infinite'}}/>
      <div style={{position:'absolute',top:'5.5%',right:'16.5%',width:'54px',height:'54px',borderRadius:'50%',background:'#0f2040',transform:'translate(16px,2px)'}}/>
      {/* Clouds */}
      {[{t:'14%',l:'8%',s:1,dur:'18s'},{t:'22%',l:'55%',s:.7,dur:'24s'},{t:'10%',l:'35%',s:.5,dur:'20s'}].map((c,i)=>(
        <div key={i} style={{position:'absolute',top:c.t,left:c.l,transform:`scale(${c.s})`,transformOrigin:'left center',animation:`cloudDrift ${c.dur} ease-in-out infinite alternate`}}>
          <div style={{position:'relative',width:'120px',height:'40px'}}>
            <div style={{position:'absolute',bottom:0,left:'20px',width:'80px',height:'30px',borderRadius:'15px',background:'rgba(255,255,255,.12)'}}/>
            <div style={{position:'absolute',bottom:'14px',left:'30px',width:'50px',height:'36px',borderRadius:'50%',background:'rgba(255,255,255,.1)'}}/>
            <div style={{position:'absolute',bottom:'12px',left:'52px',width:'40px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
          </div>
        </div>
      ))}
      {/* Skyline */}
      <svg style={{position:'absolute',bottom:'140px',left:0,width:'100%'}} viewBox="0 0 800 180" preserveAspectRatio="none">
        {[[20,80,40,100],[70,50,55,130],[135,90,35,90],[180,40,60,140],[250,70,45,110],[305,55,70,125],[385,85,40,95],[435,45,55,135],[500,75,50,105],[560,50,65,130],[635,65,45,115],[690,80,50,100],[750,55,55,125]].map(([x,y,w,h],i)=>(
          <rect key={i} x={x} y={y} width={w} height={h} fill={i%2===0?'#0f2040':'#162a50'}/>
        ))}
        {[75,90,105,120,140,158].map(y=>[75,82,90,98,106,115].map(x=>(
          <rect key={`${x}${y}`} x={x} y={y} width="5" height="4" fill="rgba(253,230,138,.55)" rx=".5"/>
        )))}
        {[48,62,76,90,104,118,132,146].map(y=>[186,196,206,216,226].map(x=>(
          <rect key={`${x}${y}`} x={x} y={y} width="5" height="4" fill="rgba(253,230,138,.55)" rx=".5"/>
        )))}
        {[60,75,90,105,120].map(y=>[310,320,340,353].map(x=>(
          <rect key={`${x}${y}`} x={x} y={y} width="5" height="4" fill="rgba(147,197,253,.55)" rx=".5"/>
        )))}
        {[50,65,80,95,110,125].map(y=>[441,451,461,471].map(x=>(
          <rect key={`${x}${y}`} x={x} y={y} width="5" height="4" fill="rgba(253,230,138,.55)" rx=".5"/>
        )))}
      </svg>
      {/* Road */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:'140px',background:'linear-gradient(180deg,#1e293b 0%,#0f172a 100%)'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'rgba(255,255,255,.15)'}}/>
        <div style={{position:'absolute',top:'48%',left:0,right:0,height:'4px',backgroundImage:'repeating-linear-gradient(90deg,#fde68a 0px,#fde68a 60px,transparent 60px,transparent 120px)',animation:'dashScroll 1s linear infinite',opacity:.7}}/>
        <div style={{position:'absolute',top:'10px',left:0,right:0,height:'3px',background:'rgba(255,255,255,.3)'}}/>
        <div style={{position:'absolute',bottom:'10px',left:0,right:0,height:'3px',background:'rgba(255,255,255,.3)'}}/>
      </div>
      {/* Vehicles */}
      <div style={{position:'absolute',bottom:'80px',animation:'drive 6s linear infinite'}}>
        <Truck style={{width:'200px',height:'75px',filter:'drop-shadow(0 4px 16px rgba(37,99,235,.6))'}}/>
      </div>
      <div style={{position:'absolute',bottom:'96px',right:0,animation:'driveBack 4.5s linear infinite',animationDelay:'1s'}}>
        <Car style={{width:'110px',height:'44px',filter:'drop-shadow(0 4px 10px rgba(22,163,74,.5))'}}/>
      </div>
      {/* Street lights */}
      {[12,28,46,64,80].map((pct,i)=>(
        <div key={i} style={{position:'absolute',bottom:'136px',left:`${pct}%`}}>
          <div style={{width:'3px',height:'50px',background:'#334155',margin:'0 auto'}}/>
          <div style={{width:'24px',height:'4px',background:'#475569',borderRadius:'2px',marginLeft:'-10px'}}/>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#fde68a',margin:'-2px auto 0',boxShadow:'0 0 12px 4px rgba(253,230,138,.4)'}}/>
        </div>
      ))}
      {/* Text overlay */}
      <SceneText accent="#60a5fa" badge="🌃 Night City Mode"/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCENE 2 — SPACE MISSION
═══════════════════════════════════════════ */
const SpaceScene = () => {
  const stars = Array.from({length:60},(_,i)=>({x:(i*83+7)%98,y:(i*53+11)%95,r:(i%4)*.7+.3,d:(i%7)*.3}));
  const meteors = [
    {top:'15%',left:'70%',delay:'0s'},{top:'30%',left:'45%',delay:'2.5s'},
    {top:'8%', left:'30%',delay:'4.8s'},{top:'50%',left:'80%',delay:'7s'},
  ];
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',background:'linear-gradient(180deg,#030308 0%,#0d0820 40%,#110a30 100%)'}}>
      {/* Stars */}
      <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} preserveAspectRatio="none">
        {stars.map((s,i)=>(
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
            style={{animation:`starTwinkle ${1.2+s.d}s ease-in-out infinite`,animationDelay:`${s.d}s`}}/>
        ))}
      </svg>
      {/* Meteors */}
      {meteors.map((m,i)=>(
        <div key={i} style={{position:'absolute',top:m.top,left:m.left,width:'3px',height:'80px',background:'linear-gradient(180deg,rgba(255,255,255,.9),transparent)',borderRadius:'2px',transform:'rotate(45deg)',animation:`meteor 2.5s ease-in infinite`,animationDelay:m.delay,opacity:0}}/>
      ))}
      {/* Planet */}
      <div style={{position:'absolute',top:'12%',right:'22%',width:'80px',height:'80px',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#c084fc,#7c3aed)',boxShadow:'0 0 30px 8px rgba(124,58,237,.4)',animation:'float 4s ease-in-out infinite'}}>
        <div style={{position:'absolute',top:'30%',left:'-10%',right:'-10%',height:'14px',borderRadius:'50%',border:'3px solid rgba(196,132,252,.6)',transform:'rotateX(70deg)'}}/>
        <div style={{position:'absolute',top:'22%',left:'20%',width:'18px',height:'10px',background:'rgba(255,255,255,.12)',borderRadius:'50%'}}/>
      </div>
      {/* Moon / small planet */}
      <div style={{position:'absolute',top:'5%',left:'15%',width:'36px',height:'36px',borderRadius:'50%',background:'radial-gradient(circle at 40% 35%,#e2e8f0,#94a3b8)',animation:'float 6s ease-in-out infinite',animationDelay:'1s'}}/>
      {/* Orbiting satellite */}
      <div style={{position:'absolute',top:'22%',right:'28%',width:'0',height:'0'}}>
        <div style={{animation:'orbit 8s linear infinite',width:'16px',height:'16px',marginLeft:'-8px',marginTop:'-8px'}}>
          <div style={{width:'16px',height:'16px',background:'#cbd5e1',borderRadius:'2px',position:'relative'}}>
            <div style={{position:'absolute',top:'6px',left:'-12px',width:'12px',height:'4px',background:'#60a5fa',borderRadius:'2px'}}/>
            <div style={{position:'absolute',top:'6px',right:'-12px',width:'12px',height:'4px',background:'#60a5fa',borderRadius:'2px'}}/>
          </div>
        </div>
      </div>
      {/* Rocket */}
      <div style={{position:'absolute',bottom:'30%',left:0,animation:'rocketFly 7s ease-in-out infinite',animationDelay:'0.5s'}}>
        <svg viewBox="0 0 50 100" width="50" height="100" style={{filter:'drop-shadow(0 0 12px rgba(167,139,250,.8))'}}>
          <ellipse cx="25" cy="30" rx="14" ry="28" fill="#a78bfa"/>
          <polygon points="11,30 0,70 25,58 50,70 39,30" fill="#7c3aed"/>
          <ellipse cx="25" cy="26" rx="8" ry="12" fill="#c4b5fd"/>
          <ellipse cx="25" cy="24" rx="5" ry="7" fill="#ddd6fe" opacity=".8"/>
          <polygon points="3,68 15,62 11,78" fill="#f97316"/>
          <polygon points="0,70 12,65 10,82" fill="#fbbf24" opacity=".7"/>
          <polygon points="47,68 35,62 39,78" fill="#f97316"/>
          <polygon points="50,70 38,65 40,82" fill="#fbbf24" opacity=".7"/>
          <ellipse cx="25" cy="72" rx="8" ry="5" fill="#f97316" opacity=".8" style={{animation:'glowPulse 0.4s ease-in-out infinite'}}/>
        </svg>
      </div>
      {/* Second rocket smaller */}
      <div style={{position:'absolute',top:'60%',right:0,animation:'rocketFly 9s linear infinite',animationDelay:'3.5s',transform:'scale(0.6)'}}>
        <svg viewBox="0 0 50 100" width="50" height="100" style={{filter:'drop-shadow(0 0 8px rgba(96,165,250,.6))'}}>
          <ellipse cx="25" cy="30" rx="14" ry="28" fill="#60a5fa"/>
          <polygon points="11,30 0,70 25,58 50,70 39,30" fill="#2563eb"/>
          <ellipse cx="25" cy="26" rx="8" ry="12" fill="#93c5fd"/>
          <ellipse cx="25" cy="72" rx="8" ry="5" fill="#fbbf24" opacity=".9"/>
        </svg>
      </div>
      {/* Nebula glow */}
      <div style={{position:'absolute',bottom:'10%',left:'10%',width:'300px',height:'200px',background:'radial-gradient(ellipse,rgba(124,58,237,.12),transparent 70%)',borderRadius:'50%',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'40%',right:'5%',width:'200px',height:'200px',background:'radial-gradient(ellipse,rgba(96,165,250,.1),transparent 70%)',borderRadius:'50%',pointerEvents:'none'}}/>
      {/* Text overlay */}
      <SceneText accent="#a78bfa" badge="🚀 Space Mission"/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCENE 3 — SUNRISE DRIVE
═══════════════════════════════════════════ */
const SunriseScene = () => (
  <div style={{position:'absolute',inset:0,overflow:'hidden',background:'linear-gradient(180deg,#fed7aa 0%,#fdba74 20%,#fb923c 35%,#fbbf24 45%,#86efac 65%,#4ade80 80%,#22c55e 100%)'}}>
    {/* Sun */}
    <div style={{position:'absolute',bottom:'230px',left:'50%',transform:'translateX(-50%)',width:'70px',height:'70px',borderRadius:'50%',background:'radial-gradient(circle,#fef9c3,#fde68a)',boxShadow:'0 0 60px 20px rgba(253,230,138,.6)',animation:'glowPulse 3s ease-in-out infinite'}}/>
    {/* Sun rays */}
    {Array.from({length:12},(_,i)=>(
      <div key={i} style={{position:'absolute',bottom:'230px',left:'50%',width:'2px',height:'50px',background:'rgba(253,230,138,.4)',transformOrigin:'50% 100%',transform:`translateX(-50%) rotate(${i*30}deg) translateY(-90px)`}}/>
    ))}
    {/* Clouds */}
    {[{b:'62%',l:'8%',s:1.1},{b:'55%',l:'55%',s:.8},{b:'68%',l:'35%',s:.65}].map((c,i)=>(
      <div key={i} style={{position:'absolute',bottom:c.b,left:c.l,transform:`scale(${c.s})`,animation:`cloudDrift ${14+i*4}s ease-in-out infinite alternate`}}>
        <div style={{position:'relative',width:'130px',height:'44px'}}>
          <div style={{position:'absolute',bottom:0,left:'20px',width:'90px',height:'32px',borderRadius:'16px',background:'rgba(255,255,255,.85)'}}/>
          <div style={{position:'absolute',bottom:'16px',left:'30px',width:'55px',height:'38px',borderRadius:'50%',background:'rgba(255,255,255,.8)'}}/>
          <div style={{position:'absolute',bottom:'14px',left:'56px',width:'45px',height:'34px',borderRadius:'50%',background:'rgba(255,255,255,.75)'}}/>
        </div>
      </div>
    ))}
    {/* Hills */}
    <svg style={{position:'absolute',bottom:'130px',left:0,width:'100%'}} viewBox="0 0 800 120" preserveAspectRatio="none">
      <ellipse cx="150" cy="120" rx="220" ry="80" fill="#16a34a"/>
      <ellipse cx="500" cy="120" rx="280" ry="90" fill="#15803d"/>
      <ellipse cx="750" cy="120" rx="200" ry="70" fill="#166534"/>
      <ellipse cx="50"  cy="120" rx="150" ry="60" fill="#22c55e"/>
      {/* Trees */}
      {[60,140,220,540,620,700].map((x,i)=>(
        <g key={i} transform={`translate(${x},80)`}>
          <rect x="-3" y="15" width="6" height="20" fill="#854d0e"/>
          <ellipse cx="0" cy="12" rx="14" ry="18" fill="#15803d"/>
          <ellipse cx="0" cy="6"  rx="10" ry="14" fill="#16a34a"/>
        </g>
      ))}
    </svg>
    {/* Road */}
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'130px',background:'linear-gradient(180deg,#374151 0%,#1f2937 100%)'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'rgba(255,255,255,.2)'}}/>
      <div style={{position:'absolute',top:'46%',left:0,right:0,height:'4px',backgroundImage:'repeating-linear-gradient(90deg,#fde68a 0px,#fde68a 60px,transparent 60px,transparent 120px)',animation:'dashScroll 1.2s linear infinite',opacity:.8}}/>
      <div style={{position:'absolute',top:'10px',left:0,right:0,height:'3px',background:'rgba(255,255,255,.35)'}}/>
      <div style={{position:'absolute',bottom:'10px',left:0,right:0,height:'3px',background:'rgba(255,255,255,.35)'}}/>
    </div>
    {/* Bus */}
    <div style={{position:'absolute',bottom:'76px',animation:'drive 7s linear infinite'}}>
      <Bus style={{width:'220px',height:'80px',filter:'drop-shadow(0 4px 14px rgba(245,158,11,.5))'}}/>
    </div>
    {/* Car opposite */}
    <div style={{position:'absolute',bottom:'92px',right:0,animation:'driveBack 5s linear infinite',animationDelay:'2s'}}>
      <Car style={{width:'110px',height:'44px',filter:'drop-shadow(0 4px 8px rgba(22,163,74,.4))'}}/>
    </div>
    {/* Birds */}
    {[{b:'72%',delay:'0s',scale:1},{b:'76%',delay:'1s',scale:.7},{b:'78%',delay:'2.2s',scale:.55}].map((b,i)=>(
      <div key={i} style={{position:'absolute',bottom:b.b,left:'-80px',animation:`birdFly ${8+i*2}s linear infinite`,animationDelay:b.delay,transform:`scale(${b.scale})`}}>
        <svg viewBox="0 0 60 20" width="60" height="20">
          <path d="M10 10 Q20 0 30 10 Q40 0 50 10" stroke="#374151" strokeWidth="2.5" fill="none"/>
        </svg>
      </div>
    ))}
    {/* Fence posts */}
    {[5,12,19,26,33,40,47,54,61,68,75,82,89].map((pct,i)=>(
      <div key={i} style={{position:'absolute',bottom:'130px',left:`${pct}%`,display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:'4px',height:'22px',background:'#92400e',borderRadius:'2px'}}/>
      </div>
    ))}
    <div style={{position:'absolute',bottom:'148px',left:0,right:0,height:'3px',background:'#92400e90',borderRadius:'2px'}}/>
    {/* Text overlay */}
    <SceneText accent="#ea580c" badge="🌅 Sunrise Drive" dark/>
  </div>
);

/* ─────────────── SHARED SCENE TEXT ─────────────── */
const SceneText = ({ accent, badge, dark }) => (
  <div style={{position:'absolute',top:'28px',left:'36px',right:'36px',animation:'fadeUp 0.8s ease both',zIndex:10}}>
    <div style={{fontSize:'12px',fontWeight:700,color:accent,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:'8px',background:dark?'rgba(255,255,255,.7)':'rgba(0,0,0,.25)',display:'inline-block',padding:'3px 10px',borderRadius:'20px'}}>
      ● {badge}
    </div>
    <div style={{fontSize:'30px',fontWeight:900,color:dark?'#1e293b':'#fff',lineHeight:1.15,textShadow:dark?'none':'0 2px 8px rgba(0,0,0,.3)'}}>
      Drive<span style={{color:accent}}>Innovate</span>
    </div>
    <div style={{fontSize:'13px',color:dark?'rgba(30,41,59,.7)':'rgba(255,255,255,.7)',marginTop:'8px',lineHeight:1.6,maxWidth:'310px'}}>
      Smart fleet management — track, manage & optimise your vehicle operations in real time.
    </div>
    <div style={{marginTop:'22px',display:'flex',flexDirection:'column',gap:'9px'}}>
      {features.map(({icon,text})=>(
        <div key={text} style={{display:'flex',alignItems:'center',gap:'9px'}}>
          <span style={{fontSize:'15px'}}>{icon}</span>
          <span style={{fontSize:'13px',color:dark?'rgba(30,41,59,.8)':'rgba(255,255,255,.82)',fontWeight:500}}>{text}</span>
        </div>
      ))}
    </div>
  </div>
);


/* ═══════════════════════════════════════════
   MAIN LOGIN
═══════════════════════════════════════════ */
const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [theme] = useState('night');
  const [layout] = useState('right'); // wide side-by-side layout; switcher hidden
  const [authMode, setAuthMode] = useState('password');
  const [forgotOtpRequested, setForgotOtpRequested] = useState(false);
  const [loginOtpSentTo, setLoginOtpSentTo] = useState('');
  const [forgotOtpSentTo, setForgotOtpSentTo] = useState('');
  const [loginOtpCooldown, setLoginOtpCooldown] = useState(0);
  const [forgotOtpCooldown, setForgotOtpCooldown] = useState(0);

  useEffect(() => {
    if (loginOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setLoginOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [loginOtpCooldown]);

  useEffect(() => {
    if (forgotOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotOtpCooldown]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi({ email: form.email, password: form.password });
      if (res.success) {
        login(res.data.user, res.data.token);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLoginOtp = async () => {
    if (!form.email) {
      toast.error('Please enter your email first');
      return;
    }

    setLoading(true);
    try {
      const res = await requestLoginOtpApi({ email: form.email });
      if (res.success) {
        toast.success('OTP sent to your email');
        setAuthMode('otp');
        setLoginOtpSentTo(form.email);
        setLoginOtpCooldown(30);
        if (res.data?.devOtp) {
          toast.info(`Dev OTP: ${res.data.devOtp}`);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    if (!form.email || !form.otp) {
      toast.error('Email and OTP are required');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyLoginOtpApi({ email: form.email, otp: form.otp });
      if (res.success) {
        login(res.data.user, res.data.token);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestForgotPasswordOtp = async () => {
    if (!form.email) {
      toast.error('Please enter your email first');
      return;
    }

    setLoading(true);
    try {
      const res = await requestForgotPasswordOtpApi({ email: form.email });
      if (res.success) {
        setForgotOtpRequested(true);
        toast.success('Password reset OTP sent');
        setForgotOtpSentTo(form.email);
        setForgotOtpCooldown(30);
        if (res.data?.devOtp) {
          toast.info(`Dev OTP: ${res.data.devOtp}`);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send password reset OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordWithOtp = async (e) => {
    e.preventDefault();
    if (!form.email || !form.otp || !form.newPassword) {
      toast.error('Email, OTP and new password are required');
      return;
    }

    if (form.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithOtpApi({
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      if (res.success) {
        toast.success('Password reset successful. Please sign in.');
        setAuthMode('password');
        setForgotOtpRequested(false);
        setForm((prev) => ({ ...prev, otp: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) {
      toast.error(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    if (authMode === 'password') {
      return handlePasswordLogin(e);
    }
    if (authMode === 'otp') {
      return handleVerifyLoginOtp(e);
    }
    return handleResetPasswordWithOtp(e);
  };

  const isFloatCard = layout === 'card';
  const isSplit     = layout === 'split';
  const isLeft      = layout === 'left';

  /* -- Reusable form card -- */
  const formCard = (extraStyle = {}) => (
    <div style={{
      background: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '36px 40px', animation: 'fadeUp 0.6s ease both', overflowY: 'auto',
      ...extraStyle,
    }}>
      <div style={{ width: '100%', maxWidth: isFloatCard || isSplit ? '380px' : '100%' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isSplit ? '16px' : '28px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 12px rgba(37,99,235,.35)' }}>🚛</div>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>DriveInnovate</span>
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: isSplit ? '20px' : '23px', fontWeight: 800, color: '#1e293b' }}>Welcome back 👋</h2>
        <p style={{ margin: `0 0 ${isSplit ? '14px' : '18px'}`, fontSize: '13px', color: '#64748b' }}>
          {authMode === 'forgot' ? 'Reset your password using OTP' : 'Sign in to manage your fleet'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setForgotOtpRequested(false);
              setLoginOtpSentTo('');
              setForgotOtpSentTo('');
            }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: `1.5px solid ${authMode === 'password' ? '#2563eb' : '#e2e8f0'}`,
              background: authMode === 'password' ? '#eff6ff' : '#fff',
              color: authMode === 'password' ? '#2563eb' : '#64748b',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('otp')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: `1.5px solid ${authMode === 'otp' ? '#2563eb' : '#e2e8f0'}`,
              background: authMode === 'otp' ? '#eff6ff' : '#fff',
              color: authMode === 'otp' ? '#2563eb' : '#64748b',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Login with OTP
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>📧</span>
              <input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required
                style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
          </div>

          {authMode === 'password' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>🔒</span>
                  <input type={showPass ? 'text' : 'password'} name="password" placeholder="Enter your password" value={form.password} onChange={handleChange} required={authMode === 'password'}
                    style={{ width: '100%', padding: '10px 36px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                    onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '13px', userSelect: 'none' }}>
                    {showPass ? '🙈' : '👁️'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={handleRequestLoginOtp}
                  disabled={loading || loginOtpCooldown > 0}
                  style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: loading || loginOtpCooldown > 0 ? 'not-allowed' : 'pointer', padding: 0, opacity: loading || loginOtpCooldown > 0 ? 0.6 : 1 }}
                >
                  {loginOtpCooldown > 0 ? `Send OTP in ${loginOtpCooldown}s` : 'Send login OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setForgotOtpRequested(false); }}
                  style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {authMode === 'otp' && (
            <>
              {!!loginOtpSentTo && (
                <div style={{ marginBottom: '10px', fontSize: '12px', color: '#64748b' }}>
                  OTP sent to <strong>{loginOtpSentTo}</strong>
                </div>
              )}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>OTP</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>🔐</span>
                  <input type="text" name="otp" placeholder="Enter 6-digit OTP" value={form.otp} onChange={handleChange} required={authMode === 'otp'}
                    style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                    onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleRequestLoginOtp}
                  disabled={loading || loginOtpCooldown > 0}
                  style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: loading || loginOtpCooldown > 0 ? 'not-allowed' : 'pointer', padding: 0, opacity: loading || loginOtpCooldown > 0 ? 0.6 : 1 }}
                >
                  {loginOtpCooldown > 0 ? `Resend in ${loginOtpCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {authMode === 'forgot' && (
            <>
              {!forgotOtpRequested ? (
                <div style={{ marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={handleRequestForgotPasswordOtp}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '11px',
                      background: loading ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? '⏳ Sending OTP...' : 'Send Reset OTP'}
                  </button>
                </div>
              ) : (
                <>
                  {!!forgotOtpSentTo && (
                    <div style={{ marginBottom: '10px', fontSize: '12px', color: '#64748b' }}>
                      Reset OTP sent to <strong>{forgotOtpSentTo}</strong>
                    </div>
                  )}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>OTP</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>🔐</span>
                      <input type="text" name="otp" placeholder="Enter reset OTP" value={form.otp} onChange={handleChange} required={authMode === 'forgot'}
                        style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                        onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>🔒</span>
                      <input type={showPass ? 'text' : 'password'} name="newPassword" placeholder="Enter new password" value={form.newPassword} onChange={handleChange} required={authMode === 'forgot'}
                        style={{ width: '100%', padding: '10px 36px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                        onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                      <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '13px', userSelect: 'none' }}>
                        {showPass ? '🙈' : '👁️'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>Confirm Password</label>
                    <input type={showPass ? 'text' : 'password'} name="confirmPassword" placeholder="Confirm new password" value={form.confirmPassword} onChange={handleChange} required={authMode === 'forgot'}
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>

                  <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleRequestForgotPasswordOtp}
                      disabled={loading || forgotOtpCooldown > 0}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: loading || forgotOtpCooldown > 0 ? 'not-allowed' : 'pointer', padding: 0, opacity: loading || forgotOtpCooldown > 0 ? 0.6 : 1 }}
                    >
                      {forgotOtpCooldown > 0 ? `Resend in ${forgotOtpCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          <button type="submit" disabled={loading || (authMode === 'forgot' && !forgotOtpRequested)} style={{
            width: '100%', padding: '11px',
            background: loading ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
            cursor: loading || (authMode === 'forgot' && !forgotOtpRequested) ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,.4)', transition: 'all .2s',
          }}>
            {loading
              ? '⏳ Processing...'
              : authMode === 'password'
                ? '🚀 Sign In'
                : authMode === 'otp'
                  ? '✅ Verify OTP & Sign In'
                  : '🔁 Reset Password'}
          </button>
        </form>

        {/* Register link */}
        <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>New to DriveInnovate?</div>
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '8px 14px', background: '#fff', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#2563eb', textAlign: 'center', cursor: 'pointer' }}>
              Create a free account →
            </div>
          </Link>
        </div>

      </div>
    </div>
  );

  /* ---------- LAYOUT: FLOATING CARD ---------- */
  if (isFloatCard) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ position: 'fixed', inset: 0 }}>
          {theme === 'night'   && <NightScene />}
          {theme === 'space'   && <SpaceScene />}
          {theme === 'sunrise' && <SunriseScene />}
        </div>
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{
            width: '420px', background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(24px)',
            borderRadius: '22px', boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.4)',
            overflow: 'hidden', animation: 'fadeUp 0.5s ease both',
          }}>
            {formCard({ padding: '34px 34px' })}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- LAYOUT: SPLIT VERTICAL ---------- */
  if (isSplit) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ height: '52vh', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {theme === 'night'   && <NightScene />}
          {theme === 'space'   && <SpaceScene />}
          {theme === 'sunrise' && <SunriseScene />}
        </div>
        <div style={{
          flex: 1, background: '#fff', overflowY: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          display: 'flex', justifyContent: 'center',
          borderRadius: '22px 22px 0 0', marginTop: '-20px',
          position: 'relative', zIndex: 1,
        }}>
          {formCard({ width: '100%', padding: '24px 20px 20px', justifyContent: 'flex-start', alignItems: 'center' })}
        </div>
      </div>
    );
  }

  /* ---------- LAYOUT: SIDE LEFT / SIDE RIGHT ---------- */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: isLeft ? 'row-reverse' : 'row', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {theme === 'night'   && <NightScene />}
        {theme === 'space'   && <SpaceScene />}
        {theme === 'sunrise' && <SunriseScene />}
      </div>
      {formCard({
        width: '460px', flexShrink: 0,
        boxShadow: isLeft ? '8px 0 40px rgba(0,0,0,0.18)' : '-8px 0 40px rgba(0,0,0,0.18)',
      })}
    </div>
  );
};

export default Login;
