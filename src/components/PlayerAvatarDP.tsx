import { useState } from 'react';
import type { CharacterAppearance, Gender } from '../shared/types.ts';

interface PlayerAvatarDPProps {
  displayName: string;
  photoURL?: string;
  appearance?: CharacterAppearance;
  gender?: Gender;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ringClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarDPProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
};

export function PlayerAvatarDP({
  displayName,
  photoURL,
  appearance,
  gender,
  size = 'md',
  ringClassName = 'ring-2 ring-white/20',
}: PlayerAvatarDPProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const cleanUrl = (photoURL || '').trim();
  const showPhoto = Boolean(cleanUrl && /^https?:\/\//i.test(cleanUrl) && !imgFailed);

  const skin = appearance?.skinTone || '#e8be9e';
  const hair = appearance?.hairColor || '#2c221e';
  const shirt = appearance?.shirtColor || (gender === 'female' ? '#e11d48' : '#1f7a5c');
  const resolvedGender: Gender = appearance?.gender || gender || 'male';
  const hairStyle = appearance?.hairStyle || (resolvedGender === 'female' ? 'long' : 'short');
  const accessory = appearance?.accessory || 'none';
  const initials = (displayName || 'GV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const bgFrom = resolvedGender === 'female' ? '#881337' : '#0f3d3e';
  const bgTo = resolvedGender === 'female' ? '#be185d' : '#1d4ed8';

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 select-none bg-[#101922] ${SIZE_CLASSES[size]} ${ringClassName}`}
      title={displayName}
    >
      {showPhoto ? (
        <img
          src={cleanUrl}
          alt={`${displayName} DP`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label={`${displayName} DP`}>
          <defs>
            <linearGradient id={`dp-bg-${resolvedGender}-${shirt.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={bgFrom} />
              <stop offset="100%" stopColor={bgTo} />
            </linearGradient>
          </defs>
          <rect
            width="100"
            height="100"
            fill={`url(#dp-bg-${resolvedGender}-${shirt.replace('#', '')})`}
          />
          {/* Subtle glow behind head */}
          <circle cx="50" cy="44" r="32" fill="#ffffff" fillOpacity="0.08" />

          {/* Long / Ponytail / Braids hair back layer for female styles */}
          {(hairStyle === 'long' || hairStyle === 'braids' || hairStyle === 'ponytail' || hairStyle === 'bob') && (
            <path
              d={
                hairStyle === 'bob'
                  ? 'M26 42 C26 18, 74 18, 74 42 L74 62 C68 65, 32 65, 26 62 Z'
                  : 'M24 44 C24 16, 76 16, 76 44 L78 82 C66 86, 34 86, 22 82 Z'
              }
              fill={hair}
            />
          )}

          {/* Shoulders / Outfit */}
          <path d="M16 100 C18 74, 32 68, 50 68 C68 68, 82 74, 84 100 Z" fill={shirt} />
          {/* Neck */}
          <rect x="43" y="58" width="14" height="14" rx="5" fill={skin} />

          {/* Head */}
          <ellipse cx="50" cy="44" rx={resolvedGender === 'female' ? 19 : 20} ry="21" fill={skin} />

          {/* Ears */}
          <circle cx="30" cy="45" r="3.5" fill={skin} />
          <circle cx="70" cy="45" r="3.5" fill={skin} />

          {/* Hair Top / Bangs */}
          {hairStyle === 'spiky' ? (
            <path
              d="M29 38 L33 21 L42 28 L50 16 L58 28 L67 21 L71 38 C63 31, 37 31, 29 38 Z"
              fill={hair}
            />
          ) : hairStyle === 'curly' ? (
            <g fill={hair}>
              <circle cx="34" cy="28" r="8" />
              <circle cx="44" cy="23" r="9" />
              <circle cx="56" cy="23" r="9" />
              <circle cx="66" cy="28" r="8" />
              <circle cx="31" cy="36" r="6" />
              <circle cx="69" cy="36" r="6" />
            </g>
          ) : (
            <path
              d="M29 41 C29 20, 71 20, 71 41 C64 31, 36 31, 29 41 Z"
              fill={hair}
            />
          )}

          {/* Eyes */}
          <circle cx="42" cy="45" r="2.5" fill="#111827" />
          <circle cx="58" cy="45" r="2.5" fill="#111827" />
          <circle cx="42.8" cy="44.2" r="0.8" fill="#ffffff" />
          <circle cx="58.8" cy="44.2" r="0.8" fill="#ffffff" />

          {/* Smile */}
          <path
            d="M43 53 Q50 58 57 53"
            fill="none"
            stroke={resolvedGender === 'female' ? '#be123c' : '#7c2d12'}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Accessories */}
          {accessory === 'glasses' && (
            <g stroke="#0f172a" strokeWidth="2" fill="#38bdf8" fillOpacity="0.22">
              <rect x="35" y="40.5" width="12" height="8" rx="2.5" />
              <rect x="53" y="40.5" width="12" height="8" rx="2.5" />
              <line x1="47" y1="44.5" x2="53" y2="44.5" />
            </g>
          )}
          {accessory === 'cap' && (
            <g>
              <path d="M28 33 C30 18, 70 18, 72 33 Z" fill="#0ea5e9" />
              <rect x="26" y="31" width="52" height="5" rx="2.5" fill="#0284c7" />
            </g>
          )}
          {accessory === 'headphones' && (
            <g>
              <path d="M27 44 C27 18, 73 18, 73 44" fill="none" stroke="#f59e0b" strokeWidth="3.5" />
              <rect x="24" y="38" width="6" height="14" rx="3" fill="#f59e0b" />
              <rect x="70" y="38" width="6" height="14" rx="3" fill="#f59e0b" />
            </g>
          )}

          {/* Subtle Initials Tag at bottom-right */}
          <rect x="65" y="76" width="28" height="16" rx="6" fill="#000000" fillOpacity="0.5" />
          <text
            x="79"
            y="87.5"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="system-ui, sans-serif"
          >
            {initials || 'GV'}
          </text>
        </svg>
      )}
    </div>
  );
}
