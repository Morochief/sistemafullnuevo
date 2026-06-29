import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const records = await p.registroVehiculo.findMany({
  select: { id: true, fotoOdometroInicio: true, fotoOdometroFin: true, fecha: true },
  take: 3,
  orderBy: { fecha: 'desc' }
});

for (const r of records) {
  console.log(`\n=== ${r.id} (${r.fecha.toISOString().substring(0,10)}) ===`);
  for (const [label, url] of [['inicio', r.fotoOdometroInicio], ['fin', r.fotoOdometroFin]] as const) {
    if (!url) { console.log(`  ${label}: NULL`); continue; }
    const isUrl = url.startsWith('http');
    const isB64 = url.startsWith('data:');
    let status = 'N/A';
    let size = 'N/A';
    let body = '';
    if (isUrl) {
      try {
        const res = await fetch(url);
        status = `${res.status}`;
        const txt = await res.text();
        size = `${txt.length} chars`;
        if (res.status !== 200) body = txt;
      } catch (e: any) { status = `ERR ${e.message}`; }
    }
    console.log(`  ${label}: ${isUrl ? 'URL' : isB64 ? 'BASE64' : 'OTHER'} | HTTP ${status} | ${size}`);
    console.log(`    FULL URL: ${url}`);
    if (body) console.log(`    ERROR BODY: ${body}`);
  }
}

await p.$disconnect();
