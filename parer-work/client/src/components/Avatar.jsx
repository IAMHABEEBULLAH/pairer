import React from 'react';

export const AVATAR_CHOICES = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'initials', label: 'Initials' },
];

const SKIN = '#8d5a3b';
const HAIR = '#1c2321';
const INITIAL_COLORS = [
  ['#2e7d4e', '#f4f1e6'],
  ['#1f5a38', '#f4f1e6'],
  ['#6fa82c', '#132b22'],
  ['#e8a33d', '#132b22'],
  ['#132b22', '#8fc93f'],
];

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// The same name always gets the same colour, so a person looks consistent everywhere.
function colorsFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return INITIAL_COLORS[h % INITIAL_COLORS.length];
}

/*
  A friendly default face. The person chooses the style themselves (woman, man or initials).
  Parer never guesses from a name, because guesses are often wrong.
*/
export default function Avatar({ name, avatar = 'initials', size = 40 }) {
  const common = { className: 'avatar', width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true, 'data-avatar': avatar };

  if (avatar === 'woman') {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="32" fill="#d6e7c3" />
        <path d="M10 64C10 49 21 45 32 45s22 4 22 19z" fill="#2e7d4e" />
        <rect x="28" y="36" width="8" height="11" rx="3" fill={SKIN} />
        <path d="M15 30C15 11 49 11 49 30l2 20H13z" fill={HAIR} />
        <ellipse cx="32" cy="29" rx="10.5" ry="12.5" fill={SKIN} />
        <path d="M21 27C22 14 42 14 43 27c-5-5-17-5-22 0z" fill={HAIR} />
        <circle cx="27.5" cy="30" r="1.2" fill={HAIR} />
        <circle cx="36.5" cy="30" r="1.2" fill={HAIR} />
        <path d="M28.5 36q3.5 2.6 7 0" stroke={HAIR} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (avatar === 'man') {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="32" fill="#f1dfb4" />
        <path d="M9 64C9 49 21 45 32 45s23 4 23 19z" fill="#1f5a38" />
        <rect x="28" y="36" width="8" height="11" rx="3" fill={SKIN} />
        <ellipse cx="32" cy="29" rx="10.5" ry="12.5" fill={SKIN} />
        <path d="M21.5 26C20 12 44 12 42.5 26c-2-6-19-6-21 0z" fill={HAIR} />
        <circle cx="27.5" cy="30" r="1.2" fill={HAIR} />
        <circle cx="36.5" cy="30" r="1.2" fill={HAIR} />
        <path d="M28.5 36q3.5 2.6 7 0" stroke={HAIR} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  const [bg, fg] = colorsFor(name);
  return (
    <svg {...common}>
      <circle cx="32" cy="32" r="32" fill={bg} />
      <text x="32" y="32" textAnchor="middle" dominantBaseline="central" fontFamily="Inter, Arial, sans-serif" fontWeight="700" fontSize="26" fill={fg}>
        {initialsOf(name)}
      </text>
    </svg>
  );
}

/* Radio group for choosing an avatar. Used at sign-up and on the profile. */
export function AvatarPicker({ value, onChange, name }) {
  return (
    <fieldset className="avatar-picker">
      <legend>Choose your avatar <span className="muted">(optional, you can change it later)</span></legend>
      <div className="row" role="radiogroup" aria-label="Avatar style">
        {AVATAR_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={value === c.value}
            className={`avatar-option${value === c.value ? ' selected' : ''}`}
            onClick={() => onChange(c.value)}
          >
            <Avatar name={name || 'Parer'} avatar={c.value} size={56} />
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
