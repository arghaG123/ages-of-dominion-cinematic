let enabled = true;

export function setHapticsEnabled(v) { enabled = !!v; }

export async function haptic(kind = 'light') {
  if (!enabled) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const style = kind === 'kill' || kind === 'ageup' ? ImpactStyle.Heavy
      : kind === 'upgrade' || kind === 'recruit' ? ImpactStyle.Medium
        : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch {
    // Web / unsupported — silent
  }
}
