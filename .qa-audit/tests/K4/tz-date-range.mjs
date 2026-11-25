// Reproduces frontend getDefaultDateRange() (pages/Reports.tsx:63-71) under a given TZ.
const now = new Date(process.argv[2] || Date.now());
const start = new Date(now.getFullYear(), now.getMonth(), 1);
const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
const yearStart = new Date(now.getFullYear(), 0, 1);
console.log(JSON.stringify({
  TZ: process.env.TZ, nowLocal: now.toString(),
  monthStart: start.toISOString().slice(0, 10),
  monthEnd: end.toISOString().slice(0, 10),
  yearStart: yearStart.toISOString().slice(0, 10),
  today_isoSplit: now.toISOString().split('T')[0],
}));
