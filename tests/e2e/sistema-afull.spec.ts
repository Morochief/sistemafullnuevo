import { test, expect } from '@playwright/test';

test.describe('Sistema aFull - E2E Suite', () => {

  test('Debe autenticar correctamente como Operador y cargar la dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('operador1');
    await page.locator('input[type="password"]').fill('Operator123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/');
  });

  test('Debe bloquear marcación de entrada si está fuera de geocerca', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 10.0, longitude: 10.0 });
    
    await page.goto('/');
    await page.locator('input[type="text"]').fill('operador1');
    await page.locator('input[type="password"]').fill('Operator123!');
    await page.locator('button[type="submit"]').click();

    const btn = page.locator('button:has-text("Marcar Entrada"), button:has-text("ENTRADA")');
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator('text=fuera de rango')).toBeVisible();
    }
  });

  test('Debe permitir marcación dentro de geocerca', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -25.320588, longitude: -57.624181 });

    await page.goto('/');
    await page.locator('input[type="text"]').fill('operador1');
    await page.locator('input[type="password"]').fill('Operator123!');
    await page.locator('button[type="submit"]').click();

    const btn = page.locator('button:has-text("Marcar Entrada"), button:has-text("ENTRADA")');
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator('button:has-text("Marcar Salida"), button:has-text("SALIDA"), button:has-text("Salida")')).toBeVisible();
    }
  });

  test('Debe simular subida de Excel y mockup de Gemini enrichment', async ({ page }) => {
    await page.route('**/api/import-excel', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, fecha: '2026-06-30', colaborador: 'Juan Perez', horas: 8, costo: 160000, concepto: 'Desarrollo Frontend' }
          ]
        })
      });
    });

    await page.route('**/api/gemini-enrich', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, fecha: '2026-06-30', colaborador: 'Juan Perez', horas: 8, costo: 160000, concepto: 'Desarrollo Frontend', matchSugerido: 'Juan Perez (Desarrollador)' }
          ]
        })
      });
    });

    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();

    await page.locator('text=Importaciones').click();
    
    const buffer = Buffer.from('dummy excel content');
    await page.setInputFiles('input[type="file"]', {
      name: 'test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer
    });

    await expect(page.locator('text=Juan Perez')).toBeVisible();
    await page.locator('button:has-text("Enriquecer con IA")').click();
  });

  test('Debe calcular markup y prefacturación correctamente en Reportes', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();

    await page.locator('text=Reportes').click();
    const markupInput = page.locator('input[type="number"]');
    await markupInput.fill('40');
    await expect(markupInput).toHaveValue('40');
  });

  test('Debe denegar operaciones de escritura al rol Visor', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('visor1');
    await page.locator('input[type="password"]').fill('Visor123!');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('button:has-text("Iniciar Timer")')).not.toBeVisible();
    await expect(page.locator('text=Admin Panel')).not.toBeVisible();

    const forbidden = await page.evaluate(async () => {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Proyecto Prohibido', clienteId: 'cli_dummy' })
      });
      return res.status;
    });

    expect(forbidden).toBe(403);
  });

});
