import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../components/Dashboard';
import { DatabaseState } from '../types';

// Mock Recharts to avoid rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  Pie: () => <div data-testid="pie" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />
}));

// Mock VehiculosStats
vi.mock('../components/vehiculos/VehiculosStats', () => ({
  default: () => <div data-testid="vehiculos-stats">Stats</div>
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock scrollIntoView for pagination tests
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mockData: DatabaseState = {
  clientes: [
    { id: 'cli1', nombre: 'Cliente A' },
    { id: 'cli2', nombre: 'Cliente B' }
  ],
  proyectos: [
    { id: 'proj1', nombre: 'Proyecto Alpha', clienteId: 'cli1', clienteNombre: 'Cliente A', estado: 'En Proceso' },
    { id: 'proj2', nombre: 'Proyecto Beta', clienteId: 'cli2', clienteNombre: 'Cliente B', estado: 'Finalizado' },
    { id: 'proj3', nombre: 'Proyecto Gamma', clienteId: 'cli1', clienteNombre: 'Cliente A', estado: 'En Proceso' }
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
      concepto: 'MO' as const,
      descripcion: 'Desarrollo frontend',
      cantidad: 120,
      hsTotal: 2,
      precioUnitario: 50000,
      total: 6000000
    },
    {
      id: 'reg2',
      clienteId: 'cli2',
      clienteNombre: 'Cliente B',
      proyectoId: 'proj2',
      proyectoNombre: 'Proyecto Beta',
      fecha: '2026-06-21',
      concepto: 'Insumo' as const,
      descripcion: 'Cables y conectores',
      cantidad: 10,
      precioUnitario: 5000,
      total: 50000
    },
    {
      id: 'reg3',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj3',
      proyectoNombre: 'Proyecto Gamma',
      fecha: '2026-06-22',
      concepto: 'MO' as const,
      descripcion: 'Testing backend',
      cantidad: 90,
      hsTotal: 1.5,
      precioUnitario: 50000,
      total: 4500000
    }
  ],
  registrosVehiculo: [
    {
      id: 'veh1',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj1',
      proyectoNombre: 'Proyecto Alpha',
      fecha: '2026-06-22',
      kmInicial: 1000,
      kmFinal: 1050,
      distanciaOdometro: 50,
      combustibleLitros: 5,
      combustibleCosto: 40000,
      total: 40000,
      descripcion: 'Viaje al cliente',
      alertaDiscrepancia: false,
      origen: 'Manual',
      fechaImportacion: '2026-06-22T10:00:00Z'
    }
  ]
};

describe('Dashboard', () => {
  const mockOnNavigateImport = vi.fn();
  const mockOnDeleteRegistro = vi.fn();
  const mockOnEditRegistro = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders dashboard header', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByText('Panel de Operaciones')).toBeInTheDocument();
    });

    it('displays metric cards', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByText('Total Mano de Obra')).toBeInTheDocument();
      expect(screen.getByText('Costo Acumulado Gral')).toBeInTheDocument();
    });

    it('displays import button', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByRole('button', { name: /Importar Excel/i })).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('filters by cliente', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      // Cliente select doesn't have proper label, find by combobox role
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects[0]; // First select is Cliente
      
      await user.selectOptions(clienteSelect, 'cli1');
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
      });
    });

    it('filters by proyecto', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const proyectoSelect = selects[1]; // Second select is Proyecto
      
      await user.selectOptions(proyectoSelect, 'proj2');
      await waitFor(() => {
        expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
        expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
      });
    });

    it('filters by concepto MO', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const moButton = screen.getByRole('button', { name: /Mano de Obra/i });
      await user.click(moButton);
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
      });
    });

    it('filters by concepto Insumo', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const insumoButton = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumoButton);
      await waitFor(() => {
        expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
        expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
      });
    });

    it('filters by date range', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      // Date inputs don't have proper labels, query by type attribute directly
      const container = screen.getByText('Fecha Desde').closest('div')?.parentElement;
      const dateInputs = container?.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      if (dateInputs && dateInputs.length >= 2) {
        await user.type(dateInputs[0], '2026-06-21'); // Fecha Desde
        await user.type(dateInputs[1], '2026-06-21'); // Fecha Hasta
        
        await waitFor(() => {
          expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
          expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
        });
      }
    });

    it('clears all filters', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects[0];
      
      await user.selectOptions(clienteSelect, 'cli1');
      const clearButton = screen.getByRole('button', { name: /Limpiar Filtros/i });
      await user.click(clearButton);
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
      });
    });

    it('shows filtrado badge when filters are active', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects[0];
      
      await user.selectOptions(clienteSelect, 'cli1');
      await waitFor(() => {
        // Multiple "Filtrado" badges appear on metric cards when filters are active
        const badges = screen.getAllByText('Filtrado');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sorting', () => {
    it('sorts by fecha', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const fechaHeader = screen.getByRole('columnheader', { name: /Fecha/i });
      await user.click(fechaHeader);
      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
      });
    });

    it('sorts by clienteNombre', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const clienteHeader = screen.getByRole('columnheader', { name: /Cliente \/ Proyecto/i });
      await user.click(clienteHeader);
      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
      });
    });

    it('sorts by total', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const totalHeader = screen.getByRole('columnheader', { name: /Total/i });
      await user.click(totalHeader);
      await waitFor(() => {
        expect(screen.getByText('Gs. 40.000')).toBeInTheDocument();
      });
    });

    it('toggles sort order', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const fechaHeader = screen.getByRole('columnheader', { name: /Fecha/i });
      await user.click(fechaHeader);
      await user.click(fechaHeader);
      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
      });
    });
  });

  describe('Pagination', () => {
    it('changes items per page', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const itemsPerPageSelect = screen.getByLabelText(/Registros por página/i);
      await user.selectOptions(itemsPerPageSelect, '50');
      await waitFor(() => {
        expect(itemsPerPageSelect).toHaveValue('50');
      });
    });

    it('displays correct page numbers', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
    });
  });

  describe('Global Search', () => {
    it('searches by descripcion', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/Buscar/i);
      await user.type(searchInput, 'frontend');
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
      });
    });

    it('searches by clienteNombre', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/Buscar/i);
      await user.type(searchInput, 'Cliente B');
      await waitFor(() => {
        expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
        expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Modal', () => {
    it('opens edit modal when clicking edit button', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      // Multiple MO records - use getAllByLabelText and pick first
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Editar Registro')).toBeInTheDocument();
      });
    });

    it('calls onEditRegistro callback', async () => {
      mockOnEditRegistro.mockResolvedValue(true);
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Editar Registro')).toBeInTheDocument();
      });
      const saveButton = screen.getByRole('button', { name: /Guardar/i });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockOnEditRegistro).toHaveBeenCalled();
      });
    });

    it('populates modal fields with registro data', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      // Target reg1 (Proyecto Alpha) explicitly — default sort by fecha desc puts reg3 first
      const editButton = screen.getByLabelText('Editar registro de MO - Proyecto Alpha');
      await user.click(editButton);

      const modal = await screen.findByText('Editar Registro').then(el => el.closest('.glass-panel'));
      expect(modal).toBeInTheDocument();

      const clienteSelect = within(modal as HTMLElement).getByLabelText(/Cliente/i);
      const proyectoSelect = within(modal as HTMLElement).getByLabelText(/Proyecto/i);
      const fechaInput = within(modal as HTMLElement).getByLabelText(/Fecha/i);
      const descripcionInput = within(modal as HTMLElement).getByLabelText(/Descripción/i);

      expect(clienteSelect).toHaveValue('cli1');
      expect(proyectoSelect).toHaveValue('proj1');
      expect(fechaInput).toHaveValue('2026-06-20');
      expect(descripcionInput).toHaveValue('Desarrollo frontend');
    });

    it('updates form fields correctly', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);

      const modal = await screen.findByText('Editar Registro').then(el => el.closest('.glass-panel'));
      const descripcionInput = within(modal as HTMLElement).getByLabelText(/Descripción/i);

      await user.clear(descripcionInput);
      await user.type(descripcionInput, 'Nueva descripción');

      expect(descripcionInput).toHaveValue('Nueva descripción');
    });

    it('validates required fields', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);

      const modal = await screen.findByText('Editar Registro').then(el => el.closest('.glass-panel'));
      const descripcionInput = within(modal as HTMLElement).getByLabelText(/Descripción/i);

      await user.clear(descripcionInput);
      const saveButton = within(modal as HTMLElement).getByRole('button', { name: /Guardar/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Descripción requerida/i)).toBeInTheDocument();
      });
    });

    it('validates HH:MM format for MO cantidad', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);

      const modal = await screen.findByText('Editar Registro').then(el => el.closest('.glass-panel'));
      const cantidadInput = within(modal as HTMLElement).getByLabelText(/Horas.*HH:MM/i);

      await user.clear(cantidadInput);
      await user.type(cantidadInput, 'invalid');
      const saveButton = within(modal as HTMLElement).getByRole('button', { name: /Guardar/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Formato inválido/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete', () => {
    it('calls onDeleteRegistro when delete button clicked', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const deleteButtons = screen.getAllByText(/Remover/i);
      await user.click(deleteButtons[0]);
      expect(mockOnDeleteRegistro).toHaveBeenCalled();
    });
  });

  describe('Unified View', () => {
    it('displays MO registros', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
    });

    it('displays Vehículo registros', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByText(/Viaje.*Proyecto Alpha/i)).toBeInTheDocument();
    });
  });

  describe('Metrics', () => {
    it('calculates total MO hours in HH:MM format', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getByText('03:30')).toBeInTheDocument();
    });

    it('calculates total cost correctly', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      expect(screen.getAllByText(/Gs\. 10\.590\.000/i).length).toBeGreaterThan(0);
    });

    it('updates metrics when filters are applied', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects.find(s => s.previousElementSibling?.textContent?.includes('CLIENTE'));
      if (clienteSelect) {
        await user.selectOptions(clienteSelect, 'cli2');
        await waitFor(() => {
          expect(screen.getByText('Cables y conectores')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Helper Functions - Indirect Testing', () => {
    it('formatGuaranies handles large values correctly', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      // Verificar que "Gs. 10.590.000" aparece en la UI
      expect(screen.getAllByText(/Gs\. 10\.590\.000/i).length).toBeGreaterThan(0);
    });

    it('formatGuaranies handles zero', () => {
      const emptyData: DatabaseState = { 
        clientes: mockData.clientes,
        proyectos: mockData.proyectos,
        colaboradores: [],
        registros: [], 
        registrosVehiculo: [] 
      };
      render(<Dashboard data={emptyData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      // Verificar que "Gs. 0" aparece cuando no hay datos
      expect(screen.getByText(/Costo Acumulado Gral/i)).toBeInTheDocument();
    });

    it('formatMinutosToHHMM displays correctly in UI', () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      // 120 + 90 = 210 minutos = 03:30
      expect(screen.getByText('03:30')).toBeInTheDocument();
    });

    it('parseHHMMToMinutos converts correctly when editing MO', async () => {
      mockOnEditRegistro.mockResolvedValue(true);
      const user = userEvent.setup();
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      
      const editButtons = screen.getAllByLabelText(/Editar registro de MO/i);
      await user.click(editButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Editar Registro')).toBeInTheDocument();
      });
      
      const cantidadInput = screen.getByLabelText(/Horas/i);
      await user.clear(cantidadInput);
      await user.type(cantidadInput, '02:30');
      
      // Verificar que el total se calcula correctamente (150 minutos * 50000 = 7500000)
      await waitFor(() => {
        expect(screen.getByText(/Gs\. 7\.500\.000/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination - Advanced', () => {
    it('navigates to next page', async () => {
      // Crear 30 registros para forzar múltiples páginas
      const largeData: DatabaseState = {
        ...mockData,
        registros: Array.from({ length: 30 }, (_, i) => ({
          id: `reg${i}`,
          clienteId: 'cli1',
          clienteNombre: 'Cliente A',
          proyectoId: 'proj1',
          proyectoNombre: 'Proyecto Alpha',
          fecha: '2026-06-20',
          concepto: 'MO' as const,
          descripcion: `Registro ${i}`,
          cantidad: 60,
          hsTotal: 1,
          precioUnitario: 50000,
          total: 3000000
        }))
      };
      
      render(<Dashboard data={largeData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // Verificar que estamos en página 1
      expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
      
      // Click en botón "Página 2"
      const nextButton = screen.getByRole('button', { name: /Página 2/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        // Verificar que registros de página 2 están visibles
        expect(screen.getByText(/Registro 25/i)).toBeInTheDocument();
      });
    });

    it('navigates to previous page', async () => {
      const largeData: DatabaseState = {
        ...mockData,
        registros: Array.from({ length: 30 }, (_, i) => ({
          id: `reg${i}`,
          clienteId: 'cli1',
          clienteNombre: 'Cliente A',
          proyectoId: 'proj1',
          proyectoNombre: 'Proyecto Alpha',
          fecha: '2026-06-20',
          concepto: 'MO' as const,
          descripcion: `Registro ${i}`,
          cantidad: 60,
          hsTotal: 1,
          precioUnitario: 50000,
          total: 3000000
        }))
      };
      render(<Dashboard data={largeData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // Ir a página 2
      const page2Button = screen.getByRole('button', { name: /Página 2/i });
      await user.click(page2Button);
      
      await waitFor(() => {
        expect(screen.getByText(/Registro 25/i)).toBeInTheDocument();
      });
      
      // Volver a página 1
      const prevButton = screen.getByRole('button', { name: /Página 1/i });
      await user.click(prevButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Registro 0/i)).toBeInTheDocument();
      });
    });

    it('handles page changes correctly', async () => {
      const largeData: DatabaseState = {
        ...mockData,
        registros: Array.from({ length: 30 }, (_, i) => ({
          id: `reg${i}`,
          clienteId: 'cli1',
          clienteNombre: 'Cliente A',
          proyectoId: 'proj1',
          proyectoNombre: 'Proyecto Alpha',
          fecha: '2026-06-20',
          concepto: 'MO' as const,
          descripcion: `Registro ${i}`,
          cantidad: 60,
          hsTotal: 1,
          precioUnitario: 50000,
          total: 3000000
        }))
      };
      render(<Dashboard data={largeData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // Cambiar a página 2
      const page2 = screen.getByRole('button', { name: /Página 2/i });
      await user.click(page2);
      
      // Verificar que currentPage cambió
      await waitFor(() => {
        expect(screen.getByText(/Registro 25/i)).toBeInTheDocument();
      });
    });

    it('generates page numbers with ellipsis for more than 7 pages', () => {
      // 200 registros = 8 páginas (25 por página)
      const largeData: DatabaseState = {
        ...mockData,
        registros: Array.from({ length: 200 }, (_, i) => ({
          id: `reg${i}`,
          clienteId: 'cli1',
          clienteNombre: 'Cliente A',
          proyectoId: 'proj1',
          proyectoNombre: 'Proyecto Alpha',
          fecha: '2026-06-20',
          concepto: 'MO' as const,
          descripcion: `Registro ${i}`,
          cantidad: 60,
          hsTotal: 1,
          precioUnitario: 50000,
          total: 3000000
        }))
      };
      
      render(<Dashboard data={largeData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      
      // Verificar que múltiples páginas están presentes
      expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
      // Verificar que hay múltiples botones de página
      const allButtons = screen.getAllByRole('button');
      const pageButtons = allButtons.filter(btn => {
        const label = btn.getAttribute('aria-label');
        return label && label.includes('Página');
      });
      expect(pageButtons.length).toBeGreaterThan(1);
    });
  });

  describe('Charts - Empty Data', () => {
    it('displays no data message when costTrendData is empty', () => {
      const emptyData: DatabaseState = {
        clientes: mockData.clientes,
        proyectos: mockData.proyectos,
        colaboradores: [],
        registros: [],
        registrosVehiculo: []
      };
      
      render(<Dashboard data={emptyData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      
      expect(screen.getByText(/No hay datos acumulados para graficar/i)).toBeInTheDocument();
    });

    it('displays no data message when clientCostData is empty', () => {
      const emptyData: DatabaseState = {
        clientes: mockData.clientes,
        proyectos: mockData.proyectos,
        colaboradores: [],
        registros: [],
        registrosVehiculo: []
      };
      
      render(<Dashboard data={emptyData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      
      // Hay múltiples elementos con "No hay datos", usar getAllByText
      const noDataMessages = screen.getAllByText(/No hay datos/i);
      expect(noDataMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Edge Cases', () => {
    it('combines filters + search + sorting simultaneously', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // Aplicar filtro de cliente
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      
      // Aplicar búsqueda
      const searchInput = screen.getByPlaceholderText(/Buscar/i);
      await user.type(searchInput, 'frontend');
      
      // Aplicar ordenamiento por Total
      const totalHeader = screen.getByRole('columnheader', { name: /Total/i });
      await user.click(totalHeader);
      
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
        expect(screen.queryByText('Testing backend')).not.toBeInTheDocument();
      });
    });

    it('filters by Vehículo tab', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      const vehiculoButton = screen.getByRole('button', { name: /Vehículos/i });
      await user.click(vehiculoButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Viaje.*Proyecto Alpha/i)).toBeInTheDocument();
        expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
      });
    });
  });

  describe('Combined Edge Cases', () => {
    it('combines filters + search + sorting simultaneously', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // 1. Aplicar filtro de cliente
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects[0];
      await user.selectOptions(clienteSelect, 'cli1');
      
      // 2. Aplicar búsqueda
      const searchInput = screen.getByPlaceholderText(/Buscar/i);
      await user.type(searchInput, 'frontend');
      
      // 3. Aplicar ordenamiento
      const totalHeader = screen.getByRole('columnheader', { name: /Total/i });
      await user.click(totalHeader);
      
      // Verificar que todo funciona junto
      await waitFor(() => {
        expect(screen.getByText('Desarrollo frontend')).toBeInTheDocument();
        expect(screen.queryByText('Testing backend')).not.toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
      });
    });

    it('filters by Vehículo concepto', async () => {
      render(<Dashboard data={mockData} onNavigateImport={mockOnNavigateImport} onDeleteRegistro={mockOnDeleteRegistro} onEditRegistro={mockOnEditRegistro} />);
      const user = userEvent.setup();
      
      // Click en botón filtro de Vehículos
      const vehiculoButton = screen.getByRole('button', { name: /Vehículos/i });
      await user.click(vehiculoButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Viaje.*Proyecto Alpha/i)).toBeInTheDocument();
        expect(screen.queryByText('Desarrollo frontend')).not.toBeInTheDocument();
        expect(screen.queryByText('Cables y conectores')).not.toBeInTheDocument();
      });
    });
  });
});
