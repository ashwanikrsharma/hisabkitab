'use client';

import Link from 'next/link';

const AVATAR_COLORS = [
  'from-orange-500 to-amber-600',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-fuchsia-500 to-purple-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProfileAvatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase() || '?';

  return (
    <Link
      href="/profile"
      className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center text-white text-[10px] font-bold shadow-sm hover:scale-110 transition-transform`}
      aria-label="Profile"
    >
      {initials}
    </Link>
  );
}
