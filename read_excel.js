import xlsx from 'xlsx';
import fs from 'fs';

// Leer el archivo Excel
const workbook = xlsx.readFile('Kevin.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convertir a JSON
const rows = xlsx.utils.sheet_to_json(worksheet);

console.log('=== TOTAL DE FILAS ===');
console.log(rows.length);

console.log('\n=== COLUMNAS (primera fila) ===');
console.log(Object.keys(rows[0]));

console.log('\n=== PRIMERA FILA MO ===');
const primeraFilaMO = rows.find(r => r.Concepto === 'MO');
if (primeraFilaMO) {
    console.log(JSON.stringify(primeraFilaMO, null, 2));
} else {
    console.log('No se encontró fila con Concepto=MO');
}

console.log('\n=== PRIMERAS 3 FILAS COMPLETAS ===');
console.log(JSON.stringify(rows.slice(0, 3), null, 2));
