export function tabletGreeting(date: Date): string {
  // Show the greeting for ten seconds each minute, keeping the clock visible throughout.
  if (date.getSeconds() >= 10) return ''
  const hour = date.getHours()
  if (hour >= 6 && hour < 8) return '早安'
  if (hour >= 22 || hour < 4) return '晚安'
  return ''
}
