/** Years of service as people say it: "8 mo", "2 yr", "2 yr 3 mo". */
export function formatService(years: number): string {
  const fullYears = Math.floor(years);
  const months = Math.round((years - fullYears) * 12);
  if (fullYears === 0) return `${months} mo`;
  if (months === 0) return `${fullYears} yr`;
  return `${fullYears} yr ${months} mo`;
}