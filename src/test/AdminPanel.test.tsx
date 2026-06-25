import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../components/AdminPanel';
import { DatabaseState } from '../types';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

vi.mock('../components/VehiculosAdminView', () => ({
  default: ({ initialEditId }: any) => (
    <div data-testid="vehiculos-admin-view">
      {initialEditId && <span data-testid="initial-edit-id">{initialEditId}</span>}
      Vehículos Admin View
    </div>
  )
}));

const mockData: DatabaseState = {
  clientes: [
    { id: 'cli1', nombre: 'Cliente A', codigo: 'CA', fechaCreacion: '2026-01-01' },
    { id: 'cli2', nombre: 'Cliente B', codigo: 'CB', fechaCreacion: '2026-01-02' }
  ],
  proyectos: [
    { id: 'proj1', nombre: 'Proyecto Alpha', clienteId: 'cli1', estado: 'En Proceso', fechaInicio: '2026-01-01' },
    { id: 'proj2', nombre: 'Proyecto Beta', clienteId: 'cli2', estado: 'Completado', fechaInicio: '2026-01-02' }
  ],
  colaboradores: [
    { id: 'col1', nombre: 'Juan Pérez', rol: 'Montador', tarifaSugerida: 400 },
    { id: 'col2', nombre: 'María García', rol: 'Instalador', tarifaSugerida: 350 }
  ],
  registros: [],
  registrosVehiculo: [],
  timersActivos: [],
  viajesActivos: []
};

const mockProps = {
  data: mockData,
  onAddRegistro: vi.fn().mockResolvedValue(true),
  onAddCliente: vi.fn(),
  onEditCliente: vi.fn().mockResolvedValue(undefined),
  onDeleteCliente: vi.fn().mockResolvedValue(undefined),
  onAddProyecto: vi.fn(),
  onEditProyecto: vi.fn().mockResolvedValue(undefined),
  onDeleteProyecto: vi.fn().mockResolvedValue(undefined),
  onAddColaborador: vi.fn(),
  onEditColaborador: vi.fn().mockResolvedValue(undefined),
  onDeleteColaborador: vi.fn().mockResolvedValue(undefined),
  onResetDatabase: vi.fn(),
  onRefresh: vi.fn().mockResolvedValue(undefined)
};

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tab Navigation', () => {
    it('should render with default "registro" tab active', () => {
      render(<AdminPanel {...mockProps} />);
      expect(screen.getByText('Registrar Parte Diario / Gasto Manual')).toBeInTheDocument();
    });

    it('should use initialSubTab prop when provided', () => {
      render(<AdminPanel {...mockProps} initialSubTab="clientes" />);
      expect(screen.getByText('Registrar Nuevo Cliente Frecuente')).toBeInTheDocument();
    });

    it('should switch tabs when clicking tab buttons', async () => {
      render(<AdminPanel {...mockProps} />);
      const user = userEvent.setup();

      // Start at registro tab
      expect(screen.getByText('Registrar Parte Diario / Gasto Manual')).toBeInTheDocument();

      // Click clientes tab
      const clientesButton = screen.getByRole('button', { name: /Clientes de Cartera/i });
      await user.click(clientesButton);

      await waitFor(() => {
        expect(screen.getByText('Registrar Nuevo Cliente Frecuente')).toBeInTheDocument();
      });
    });
  });

  describe('Basic Rendering', () => {
    it('should render all 5 tab buttons', () => {
      render(<AdminPanel {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /Nueva Carga Directa/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clientes de Cartera/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Proyectos Registrados/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Colaboradores/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Vehículos/i })).toBeInTheDocument();
    });

    it('should render RegistroManualForm when registro tab active', () => {
      render(<AdminPanel {...mockProps} />);
      expect(screen.getByText('Registrar Parte Diario / Gasto Manual')).toBeInTheDocument();
    });

    it('should render ClientesTab when clientes tab active', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="clientes" />);
      expect(screen.getByText('Registrar Nuevo Cliente Frecuente')).toBeInTheDocument();
      expect(screen.getByText('Base de Clientes Disponibles (2)')).toBeInTheDocument();
    });

    it('should render ProyectosTab when proyectos tab active', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="proyectos" />);
      expect(screen.getByText('Registrar Nuevo Proyecto Operativo')).toBeInTheDocument();
      expect(screen.getByText('Proyectos en Cartera (2)')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation error when submitting registro with empty required fields', async () => {
      render(<AdminPanel {...mockProps} />);
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /Confirmar y Guardar en Historial/i });
      await user.click(submitButton);

      // HTML5 validation will prevent form submission
      expect(mockProps.onAddRegistro).not.toHaveBeenCalled();
    });

    it('should prevent registro submission with missing cliente', async () => {
      render(<AdminPanel {...mockProps} />);
      const user = userEvent.setup();

      // Try to submit without selecting cliente
      const submitButton = screen.getByRole('button', { name: /Confirmar y Guardar en Historial/i });
      await user.click(submitButton);

      // Form should not submit due to required validation
      expect(mockProps.onAddRegistro).not.toHaveBeenCalled();
    });

    it('should show error when creating client with empty name', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="clientes" />);
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /Agregar Cliente/i });
      await user.click(submitButton);

      // Form validation should prevent submission
      expect(mockProps.onAddCliente).not.toHaveBeenCalled();
    });

    it('should show error when creating proyecto with empty name', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="proyectos" />);
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /Abrir Proyecto/i });
      await user.click(submitButton);

      // Form validation should prevent submission
      expect(mockProps.onAddProyecto).not.toHaveBeenCalled();
    });
  });

  describe('Form State Management', () => {
    it('should update form state when changing concepto', async () => {
      render(<AdminPanel {...mockProps} />);
      const user = userEvent.setup();

      // Click on "Insumos / Mat." button
      const insumoButton = screen.getByRole('button', { name: /Insumos \/ Mat\./i });
      await user.click(insumoButton);

      // Verify the button is now active (has the active styling)
      await waitFor(() => {
        expect(insumoButton).toHaveClass('bg-violet-600');
      });
    });

    it('should update precioUnitario when selecting colaborador', async () => {
      render(<AdminPanel {...mockProps} />);
      const user = userEvent.setup();

      // Find colaborador select - it's the third combobox on the page
      const allComboboxes = screen.getAllByRole('combobox');
      const colaboradorSelect = allComboboxes[2]; // Third select is colaborador
      
      // Select a colaborador
      await user.selectOptions(colaboradorSelect, 'col1');

      // The precio should update to the colaborador's tarifaSugerida (400)
      // Find the spinbutton inputs and get the second one (precio por minuto)
      const spinButtons = screen.getAllByRole('spinbutton');
      const precioInput = spinButtons[1] as HTMLInputElement;
      await waitFor(() => {
        expect(precioInput.value).toBe('400');
      });
    });

    it('should default fecha to today\'s date', () => {
      render(<AdminPanel {...mockProps} />);
      
      // Find the date input by type
      const fechaInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]) as HTMLInputElement;
      const today = new Date().toISOString().split('T')[0];
      
      expect(fechaInput.value).toBe(today);
    });
  });

  describe('Create Operations', () => {
    it('should call onAddCliente when creating client', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="clientes" />);
      const user = userEvent.setup();

      // Get all text inputs - the first two are for cliente form (nombre, codigo)
      const textInputs = screen.getAllByRole('textbox');
      const nameInput = textInputs[0];
      const codeInput = textInputs[1];
      
      await user.clear(nameInput);
      await user.type(nameInput, 'Nuevo Cliente');

      await user.clear(codeInput);
      await user.type(codeInput, 'NC');

      const submitButton = screen.getByRole('button', { name: /Agregar Cliente/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onAddCliente).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: 'Nuevo Cliente',
            codigo: 'NC'
          })
        );
      });
    });

    it('should call onAddColaborador when creating colaborador', async () => {
      render(<AdminPanel {...mockProps} initialSubTab="colaboradores" />);
      const user = userEvent.setup();

      // Get all text inputs - first is nombre, second is rol
      const textInputs = screen.getAllByRole('textbox');
      const nameInput = textInputs[0];
      const rolInput = textInputs[1];
      
      await user.clear(nameInput);
      await user.type(nameInput, 'Pedro López');

      await user.clear(rolInput);
      await user.type(rolInput, 'Técnico');

      // Find the tarifa input - it's a number input on the colaboradores form
      const tarifaInput = screen.getByRole('spinbutton');
      await user.clear(tarifaInput);
      await user.type(tarifaInput, '500');

      const submitButton = screen.getByRole('button', { name: /Dar de Alta/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onAddColaborador).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: 'Pedro López',
            rol: 'Técnico',
            tarifaSugerida: 500
          })
        );
      });
    });

    it('should pass initialVehicleEditId to VehiculosAdminView', () => {
      render(<AdminPanel {...mockProps} initialSubTab="vehiculos" initialVehicleEditId="veh123" />);
      
      expect(screen.getByTestId('vehiculos-admin-view')).toBeInTheDocument();
      expect(screen.getByTestId('initial-edit-id')).toHaveTextContent('veh123');
    });
  });
});
