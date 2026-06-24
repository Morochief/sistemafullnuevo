import { readFileSync } from 'fs';

const db = JSON.parse(readFileSync('./database.json', 'utf-8'));

const total = db.registros.reduce((acc, r) => acc + r.total, 0);
const mo = db.registros.filter(r => r.concepto === 'MO').reduce((acc, r) => acc + r.total, 0);
const insumos = db.registros.filter(r => r.concepto === 'Insumo').reduce((acc, r) => acc + r.total, 0);

console.log('=== ANÁLISIS DE TOTALES ===');
console.log('Total registros:', db.registros.length);
console.log('Total calculado:', total.toLocaleString('es-PY'));
console.log('MO:', mo.toLocaleString('es-PY'));
console.log('Insumos:', insumos.toLocaleString('es-PY'));
console.log('\n=== DETALLE POR REGISTRO ===');
db.registros.forEach((r, i) => {
  console.log(`${i + 1}. ${r.id}: ${r.concepto} - Gs. ${r.total.toLocaleString('es-PY')}`);
});
console.log('\n=== SUMA VERIFICADA ===');
console.log('MO + Insumos =', (mo + insumos).toLocaleString('es-PY'));
