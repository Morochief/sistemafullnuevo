import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reportes from '../components/Reportes';
import { DatabaseState } from '../types';

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock XLSX (optional - can skip export tests for 50% coverage target)
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}));

const mockData: DatabaseState = {
  clientes: [
    { id: 'cli1', nombre: 'Cliente A', codigo: 'CA' },
    { id: 'cli2', nombre: 'Cliente B', codigo: 'CB' }
  ],
  proyectos: [
    { id: 'proj1', nombre: 'Proyecto Alpha', clienteId: 'cli1', estado: 'En Proceso' },
    { id: 'proj2', nombre: 'Proyecto Beta', clienteId: 'cli2', estado: 'Completado' }
  ],
  colaboradores: [],
  registros: [
    {
      id: 'reg1',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj1',
      proyectoNombre: 'Proyecto Alpha',
      fecha: '2026-06-20',
      concepto: 'MO',
      descripcion: 'Trabajo MO',
      cantidad: 300,
      precioUnitario: 400,
      total: 120000,
      origen: 'Manual'
    },
    {
      id: 'reg2',
      clienteId: 'cli2',
      clienteNombre: 'Cliente B',
      proyectoId: 'proj2',
      proyectoNombre: 'Proyecto Beta',
      fecha: '2026-06-21',
      concepto: 'Insumo',
      descripcion: 'Materiales',
      cantidad: 10,
      precioUnitario: 5000,
      total: 50000,
      origen: 'Manual'
    },
    {
      id: 'reg3',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj1',
      proyectoNombre: 'Proyecto Alpha',
      fecha: '2026-06-22',
      concepto: 'Insumo',
      descripcion: 'Insumos varios',
      cantidad: 5,
      precioUnitario: 3000,
      total: 15000,
      origen: 'Manual'
    }
  ],
  registrosVehiculo: [],
  timersActivos: [],
  viajesActivos: []
};

const mockProps = {
  data: mockData,
  markupRate: 0.35,
  onMarkupChange: vi.fn()
};

describe('Reportes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════
  // GROUP 1: Helper Functions (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Helper Functions', () => {
    it('should format Guaraníes with prefix and thousands separator', () => {
      render(<Reportes {...mockProps} />);
      
      // Total is 120000 + 50000 + 15000 = 185000, formatted as Gs. 185.000
      const totals = screen.getAllByText(/Gs\. 185\.000/i);
      expect(totals.length).toBeGreaterThan(0);
    });

    it('should convert minutes to HH:MM format for MO records', () => {
      render(<Reportes {...mockProps} />);
      
      // reg1 has cantidad=300 minutes, should display as 05:00
      expect(screen.getByText('05:00')).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 2: Tab Navigation (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Tab Navigation', () => {
    it('should default to reportes tab', () => {
      render(<Reportes {...mockProps} />);
      
      // Should show reportes tab content
      expect(screen.getByText(/Filtros Avanzados/i)).toBeInTheDocument();
      expect(screen.getByText(/Vista Previa del Reporte/i)).toBeInTheDocument();
    });

    it('should switch to prefactura tab when clicked', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Click prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Configurar Simulación de Pre-Factura/i)).toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 3: Filters (6 tests)
  // ══════════════════════════════════════════════════════

  describe('Filters', () => {
    it('should filter registros by cliente', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Get cliente select (first combobox)
      const clienteSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(clienteSelect, 'cli1');
      
      // Total should show only Cliente A registros (120000 + 15000 = 135000)
      await waitFor(() => {
        const filteredTotals = screen.getAllByText(/Gs\. 135\.000/i);
        expect(filteredTotals.length).toBeGreaterThan(0);
      });
    });

    it('should filter registros by proyecto', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Get proyecto select (second combobox)
      const proyectoSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(proyectoSelect, 'proj2');
      
      // Total should show only Proyecto Beta registros (50000)
      await waitFor(() => {
        const filteredTotals = screen.getAllByText(/Gs\. 50\.000/i);
        expect(filteredTotals.length).toBeGreaterThan(0);
      });
    });

    it('should filter registros by concepto (MO)', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Get concepto select (third combobox)
      const conceptoSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(conceptoSelect, 'MO');
      
      // Total should show only MO registros (120000)
      await waitFor(() => {
        const moTotals = screen.getAllByText(/Gs\. 120\.000/i);
        expect(moTotals.length).toBeGreaterThan(0);
      });
    });

    it('should filter registros by fecha desde', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Get fecha desde input
      const fechaDesdeInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement;
      await user.type(fechaDesdeInput, '2026-06-21');
      
      // Should exclude reg1 (2026-06-20), include reg2 and reg3 (65000)
      await waitFor(() => {
        const filteredTotals = screen.getAllByText(/Gs\. 65\.000/i);
        expect(filteredTotals.length).toBeGreaterThan(0);
      });
    });

    it('should filter registros by fecha hasta', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Get fecha hasta input (second date input)
      const fechaHastaInput = screen.getAllByDisplayValue('')[1] as HTMLInputElement;
      await user.type(fechaHastaInput, '2026-06-21');
      
      // Should include reg1 and reg2, exclude reg3 (170000)
      await waitFor(() => {
        const filteredTotals = screen.getAllByText(/Gs\. 170\.000/i);
        expect(filteredTotals.length).toBeGreaterThan(0);
      });
    });

    it('should clear all filters when clear button clicked', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Apply a filter first
      const clienteSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(clienteSelect, 'cli1');
      
      // Verify filter is applied
      await waitFor(() => {
        const filteredTotals = screen.getAllByText(/Gs\. 135\.000/i);
        expect(filteredTotals.length).toBeGreaterThan(0);
      });
      
      // Click clear button
      const clearButton = screen.getByRole('button', { name: /Limpiar/i });
      await user.click(clearButton);
      
      // Should show all registros again (185000)
      await waitFor(() => {
        const allTotals = screen.getAllByText(/Gs\. 185\.000/i);
        expect(allTotals.length).toBeGreaterThan(0);
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 4: Totals Calculation (4 tests)
  // ══════════════════════════════════════════════════════

  describe('Totals Calculation', () => {
    it('should calculate total filtrado correctly', () => {
      render(<Reportes {...mockProps} />);
      
      // Total should be 120000 + 50000 + 15000 = 185000
      const totals = screen.getAllByText(/Gs\. 185\.000/i);
      expect(totals.length).toBeGreaterThan(0);
      expect(screen.getByText('3 registros')).toBeInTheDocument();
    });

    it('should calculate total MO filtrado', () => {
      render(<Reportes {...mockProps} />);
      
      // MO total should be 120000
      const moTotals = screen.getAllByText(/Gs\. 120\.000/i);
      expect(moTotals.length).toBeGreaterThan(0);
      // MO percentage should be 65% (120000/185000 = 0.648...)
      expect(screen.getByText(/65% del total/i)).toBeInTheDocument();
    });

    it('should calculate total Insumo filtrado', () => {
      render(<Reportes {...mockProps} />);
      
      // Insumo total should be 50000 + 15000 = 65000
      const insumoTotals = screen.getAllByText(/Gs\. 65\.000/i);
      expect(insumoTotals.length).toBeGreaterThan(0);
      // Insumo percentage should be 35% (65000/185000 = 0.351...)
      expect(screen.getByText(/35% del total/i)).toBeInTheDocument();
    });

    it('should update totals when filters change', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Initial total
      const initialTotals = screen.getAllByText(/Gs\. 185\.000/i);
      expect(initialTotals.length).toBeGreaterThan(0);
      
      // Filter by concepto Insumo
      const conceptoSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(conceptoSelect, 'Insumo');
      
      // Total should update to 65000
      await waitFor(() => {
        const newTotals = screen.getAllByText(/Gs\. 65\.000/i);
        expect(newTotals.length).toBeGreaterThan(0);
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 5: Pre-Factura Selection (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Pre-Factura Selection', () => {
    it('should show cliente info when proyecto selected', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Should show cliente info
      await waitFor(() => {
        expect(screen.getByText('Cliente A')).toBeInTheDocument();
        expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      });
    });

    it('should display registros for selected proyecto', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Should show detail of items
      await waitFor(() => {
        expect(screen.getByText(/Detalle de 2 ítems/i)).toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 6: Pre-Factura Calculations (4 tests)
  // ══════════════════════════════════════════════════════

  describe('Pre-Factura Calculations', () => {
    it('should calculate costo base correctly', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto with 2 registros (120000 + 15000 = 135000)
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Should show costo base (multiple instances exist)
      await waitFor(() => {
        const costos = screen.getAllByText(/Gs\. 135\.000/i);
        expect(costos.length).toBeGreaterThan(0);
      });
    });

    it('should calculate markup amount (base * rate)', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Markup should be 135000 * 0.35 = 47250
      await waitFor(() => {
        expect(screen.getByText(/\+ Gs\. 47\.250/i)).toBeInTheDocument();
      });
    });

    it('should calculate precio venta (base + markup)', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Precio venta should be 135000 + 47250 = 182250
      await waitFor(() => {
        expect(screen.getByText(/Gs\. 182\.250/i)).toBeInTheDocument();
      });
    });

    it('should show breakdown by concepto (MO/Insumos/Otros)', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getByRole('combobox');
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Should show breakdown
      await waitFor(() => {
        expect(screen.getByText(/Mano de Obra \(MO\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Insumos y Materiales/i)).toBeInTheDocument();
        expect(screen.getByText(/Otros/i)).toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 7: Markup Configuration (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Markup Configuration', () => {
    it('should display default markup rate (35%)', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Should show default markup 35%
      await waitFor(() => {
        expect(screen.getByText(/Markup global actual: 35%/i)).toBeInTheDocument();
      });
    });

    it('should update calculations when markup changed', async () => {
      render(<Reportes {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to prefactura tab
      const prefacturaButton = screen.getByRole('button', { name: /Pre-Factura/i });
      await user.click(prefacturaButton);
      
      // Select proyecto
      const proyectoSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(proyectoSelect, 'proj1');
      
      // Change markup to 50%
      const markupInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
      await user.clear(markupInput);
      await user.type(markupInput, '50');
      
      // New markup should be 135000 * 0.50 = 67500
      // New precio venta should be 135000 + 67500 = 202500
      await waitFor(() => {
        expect(screen.getByText(/\+ Gs\. 67\.500/i)).toBeInTheDocument();
        expect(screen.getByText(/Gs\. 202\.500/i)).toBeInTheDocument();
      });
    });
  });
});
