export const BUILTIN_SOUNDS = [
  { id: 'raw:aurora_chime', name: 'Chime', desc: 'Soft rising bells' },
  { id: 'raw:aurora_pulse', name: 'Pulse', desc: 'Clear digital beeps' },
  { id: 'raw:aurora_rise', name: 'Sunrise', desc: 'Gentle rising melody' },
];

export function soundLabel(sound?: string, name?: string): string {
  if (!sound) return 'Default alarm tone';
  const b = BUILTIN_SOUNDS.find((x) => x.id === sound);
  if (b) return b.name;
  return name || 'Phone ringtone';
}
