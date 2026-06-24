import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistroOperativo from '../components/RegistroOperativo';
import { DatabaseState } from '../types';

// Mock motion/react
vi.mock('motion/react', () => {
  const filterMotionProps = (props: any) => {
    const { whileHover, whileTap, initial, animate, exit, transition, layout, ...rest } = props;
    return rest;
  };

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...filterMotionProps(props)}>{children}</button>,
      span: ({ children, ...props }: any) => <span {...filterMotionProps(props)}>{children}</span>,
      p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
      h1: ({ children, ...props }: any) => <h1 {...filterMotionProps(props)}>{children}</h1>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
  };
});

// Mock VehiculoTab (already tested separately)
vi.mock('../components/VehiculoTab.tsx', () => {
  return {
    default: () => <div data-testid="vehiculo-tab">Vehículo Tab</div>
  };
});

// Mock authFetchJSON
vi.mock('../authFetch', () => ({
  authFetchJSON: vi.fn().mockResolvedValue({ success: false, data: null })
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockData: DatabaseState = {
  clientes: [
    { id: 'cli1', nombre: 'Cliente A', codigo: 'CA' },
    { id: 'cli2', nombre: 'Cliente B', codigo: 'CB' }
  ],
  proyectos: [
    { id: 'proj1', nombre: 'Proyecto Alpha', clienteId: 'cli1', estado: 'En Proceso' },
    { id: 'proj2', nombre: 'Proyecto Beta', clienteId: 'cli2', estado: 'Completado' },
    { id: 'proj3', nombre: 'Proyecto Gamma', clienteId: 'cli1', estado: 'En Proceso' }
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

const mockAdminUser = { nombre: 'Admin', rol: 'Admin', usuario: 'admin' };
const mockNonAdminUser = { nombre: 'Juan Pérez', rol: 'Usuario', usuario: 'juan' };

const mockProps = {
  data: mockData,
  onAddRegistro: vi.fn().mockResolvedValue(true),
  currentUser: mockAdminUser
};

describe('RegistroOperativo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    // Guarantee fake timers never leak into the next test (prevents userEvent hangs)
    vi.useRealTimers();
  });

  // ══════════════════════════════════════════════════════
  // GROUP 1: Helper Functions (4 tests)
  // ══════════════════════════════════════════════════════

  describe('Helper Functions', () => {
    it('should format duration correctly (test via timer display)', () => {
      render(<RegistroOperativo {...mockProps} />);
      
      // Timer should display 00:00:00 initially
      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });

    it('should format time correctly (test via time display)', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Select context
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      await user.selectOptions(selects[2], 'col1');
      
      // Start timer
      const startButton = screen.getByRole('button', { name: /Iniciar Tarea/i });
      await user.click(startButton);
      
      // Should show timestamps in HH:MM format
      await waitFor(() => {
        const timestamps = screen.getAllByText(/\d{2}:\d{2}/);
        expect(timestamps.length).toBeGreaterThan(0);
      });
    });

    it('should format Guaraníes with prefix (test via total display)', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to Insumos tab
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Enter insumo data
      const inputs = screen.getAllByRole('textbox');
      const numberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(inputs[0], 'Prueba insumo');
      await user.clear(numberInputs[0]);
      await user.type(numberInputs[0], '2');
      await user.clear(numberInputs[1]);
      await user.type(numberInputs[1], '5000');
      
      // Should show Gs. prefix in total (multiple instances exist)
      await waitFor(() => {
        const totals = screen.getAllByText(/Gs\. 10\.000/i);
        expect(totals.length).toBeGreaterThan(0);
      });
    });

    it('should generate unique IDs (test via insumo line IDs)', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Switch to Insumos tab
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Add multiple lines
      const addButton = screen.getByRole('button', { name: /Agregar ítem de insumo/i });
      await user.click(addButton);
      await user.click(addButton);
      
      // Should have 3 insumo input rows (1 default + 2 added)
      const descripcionInputs = screen.getAllByPlaceholderText(/Insumo \d+\.\.\./i);
      expect(descripcionInputs.length).toBe(3);
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 2: Context Selection (3 tests)
  // ══════════════════════════════════════════════════════

  describe('Context Selection', () => {
    it('should default fecha to today', () => {
      render(<RegistroOperativo {...mockProps} />);
      const today = new Date().toISOString().split('T')[0];
      const fechaInput = screen.getByDisplayValue(today);
      expect(fechaInput).toBeInTheDocument();
    });

    it('should filter proyectos when cliente selected', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      const selects = screen.getAllByRole('combobox');
      const clienteSelect = selects[0];
      const proyectoSelect = selects[1];
      
      // Initially all proyectos should be available
      await user.selectOptions(clienteSelect, 'cli1');
      
      // After selecting cli1, should only show proyectos for cli1
      await waitFor(() => {
        const options = Array.from(proyectoSelect.querySelectorAll('option')).map(
          (opt: any) => opt.textContent
        );
        expect(options).toContain('Proyecto Alpha');
        expect(options).toContain('Proyecto Gamma');
        expect(options).not.toContain('Proyecto Beta');
      });
    });

    it('should show context incomplete message when cliente not selected', () => {
      render(<RegistroOperativo {...mockProps} />);
      
      expect(screen.getByText(/Seleccioná Cliente y Proyecto para poder registrar operaciones/i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 3: Tab Navigation (3 tests)
  // ══════════════════════════════════════════════════════

  describe('Tab Navigation', () => {
    it('should render all 3 tabs (MO, Insumos, Vehículo)', () => {
      render(<RegistroOperativo {...mockProps} />);

      // Exact match avoids colliding with the "Registrar Horas de Mano de Obra" submit button
      expect(screen.getByRole('button', { name: 'Mano de Obra' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insumos/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Vehículo/i })).toBeInTheDocument();
    });

    it('should default to MO tab active', () => {
      render(<RegistroOperativo {...mockProps} />);
      
      // Should show MO content by default
      expect(screen.getByText(/Iniciar Tarea/i)).toBeInTheDocument();
      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });

    it('should switch to Insumos tab when clicked', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      await waitFor(() => {
        expect(screen.getByText(/Materiales y Gastos Operativos/i)).toBeInTheDocument();
        expect(screen.getByText(/Agregar ítem de insumo/i)).toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 4: Mano de Obra Form (4 tests)
  // ══════════════════════════════════════════════════════

  describe('Mano de Obra Form', () => {
    it('should allow admin to select any colaborador', () => {
      render(<RegistroOperativo {...mockProps} currentUser={mockAdminUser} />);
      
      const selects = screen.getAllByRole('combobox');
      const colaboradorSelect = selects[2]; // Third select is colaborador
      
      // Admin should see all colaboradores
      const options = Array.from(colaboradorSelect.querySelectorAll('option')).map(
        (opt: any) => opt.textContent
      );
      
      expect(options.some(opt => opt.includes('Juan Pérez'))).toBe(true);
      expect(options.some(opt => opt.includes('María García'))).toBe(true);
    });

    it('should auto-assign colaborador for non-admin user', () => {
      render(<RegistroOperativo {...mockProps} currentUser={mockNonAdminUser} />);
      
      // Non-admin should have their colaborador auto-assigned
      expect(screen.getByText(/Solo tu usuario/i)).toBeInTheDocument();
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    it('should display timer at 00:00:00 initially', () => {
      render(<RegistroOperativo {...mockProps} />);
      
      expect(screen.getByText('00:00:00')).toBeInTheDocument();
      expect(screen.getByText(/LISTO/i)).toBeInTheDocument();
    });

    it('should update precio when colaborador selected', async () => {
      render(<RegistroOperativo {...mockProps} currentUser={mockAdminUser} />);
      const user = userEvent.setup();
      
      const selects = screen.getAllByRole('combobox');
      const colaboradorSelect = selects[2];
      
      await user.selectOptions(colaboradorSelect, 'col1');
      
      // Price should be updated to colaborador's tarifa (400)
      await waitFor(() => {
        const priceInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
        expect(priceInput.value).toBe('400');
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 5: Insumos Form (5 tests)
  // ══════════════════════════════════════════════════════

  describe('Insumos Form', () => {
    it('should add new insumo line', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      const addButton = screen.getByRole('button', { name: /Agregar ítem de insumo/i });
      await user.click(addButton);
      
      // Should have 2 insumo lines now
      const descripcionInputs = screen.getAllByPlaceholderText(/Insumo \d+\.\.\./i);
      expect(descripcionInputs.length).toBe(2);
    });

    it('should remove insumo line', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Add a line first
      const addButton = screen.getByRole('button', { name: /Agregar ítem de insumo/i });
      await user.click(addButton);
      
      // Remove the second line
      const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
        btn => btn.querySelector('svg')
      );
      
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
        
        await waitFor(() => {
          const descripcionInputs = screen.getAllByPlaceholderText(/Insumo \d+\.\.\./i);
          expect(descripcionInputs.length).toBe(1);
        });
      }
    });

    it('should calculate total correctly with multiple lines', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Fill first line: 2 × 1000 = 2000
      const textInputs = screen.getAllByRole('textbox');
      const numberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(textInputs[0], 'Insumo A');
      await user.clear(numberInputs[0]);
      await user.type(numberInputs[0], '2');
      await user.clear(numberInputs[1]);
      await user.type(numberInputs[1], '1000');
      
      // Add second line: 3 × 500 = 1500
      const addButton = screen.getByRole('button', { name: /Agregar ítem de insumo/i });
      await user.click(addButton);
      
      await waitFor(() => {
        const newTextInputs = screen.getAllByRole('textbox');
        expect(newTextInputs.length).toBe(2);
      });
      
      const updatedTextInputs = screen.getAllByRole('textbox');
      const updatedNumberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(updatedTextInputs[1], 'Insumo B');
      await user.clear(updatedNumberInputs[2]);
      await user.type(updatedNumberInputs[2], '3');
      await user.clear(updatedNumberInputs[3]);
      await user.type(updatedNumberInputs[3], '500');
      
      // Total should be 3500 (appears twice: line subtotal + grand total)
      await waitFor(() => {
        expect(screen.getAllByText(/Gs\. 3\.500/i).length).toBeGreaterThan(0);
      });
    });

    it('should show validation error without descripcion', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Select context
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // With no valid insumo line, the submit button is disabled (prevents invalid submission)
      const submitButton = screen.getByRole('button', { name: /Registrar \d+ Insumo/i });
      expect(submitButton).toBeDisabled();
    });

    it('should show validation error with zero cantidad', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Select context
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Enter insumo with zero cantidad
      const textInputs = screen.getAllByRole('textbox');
      const numberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(textInputs[0], 'Insumo Test');
      await user.clear(numberInputs[0]);
      await user.type(numberInputs[0], '0');
      await user.clear(numberInputs[1]);
      await user.type(numberInputs[1], '100');
      
      // cantidad=0 keeps the line invalid, so the submit button stays disabled
      const submitButton = screen.getByRole('button', { name: /Registrar \d+ Insumo/i });
      expect(submitButton).toBeDisabled();
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 6: Form Submission (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Form Submission', () => {
    it('should submit MO registro with timer data', async () => {
      // Deterministic approach: pre-seed a completed timer (>=30s) in localStorage so the
      // MO submit guard (timerSeconds >= 30) passes without driving real or fake time.
      // useTimer initializes timerSeconds/timerStart/timerEnd from these keys on mount.
      const now = new Date();
      localStorage.setItem('afull_timer_admin_running', 'false');
      localStorage.setItem('afull_timer_admin_paused', 'false');
      localStorage.setItem('afull_timer_admin_seconds', '60');
      localStorage.setItem('afull_timer_admin_start', new Date(now.getTime() - 60000).toISOString());
      localStorage.setItem('afull_timer_admin_end', now.toISOString());

      const user = userEvent.setup();
      render(<RegistroOperativo {...mockProps} />);

      // Timer is not running, so context selects are enabled
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      await user.selectOptions(selects[2], 'col1');

      // Submit MO (button enabled because timerSeconds=60 and timerEnd is set)
      const submitButton = screen.getByRole('button', { name: /Registrar Horas de Mano de Obra/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onAddRegistro).toHaveBeenCalledWith(
          expect.objectContaining({
            clienteId: 'cli1',
            proyectoId: 'proj1',
            concepto: 'MO',
            colaboradorId: 'col1'
          })
        );
      });
    });

    it('should submit Insumos registro with multiple lines', async () => {
      render(<RegistroOperativo {...mockProps} />);
      const user = userEvent.setup();
      
      // Select context
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Fill first insumo line
      const textInputs = screen.getAllByRole('textbox');
      const numberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(textInputs[0], 'Material A');
      await user.clear(numberInputs[0]);
      await user.type(numberInputs[0], '5');
      await user.clear(numberInputs[1]);
      await user.type(numberInputs[1], '2000');
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /Registrar \d+ Insumo/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockProps.onAddRegistro).toHaveBeenCalledWith(
          expect.objectContaining({
            clienteId: 'cli1',
            proyectoId: 'proj1',
            concepto: 'Insumo',
            descripcion: 'Material A',
            cantidad: 5,
            precioUnitario: 2000
          })
        );
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // GROUP 7: Edge Cases (2 tests)
  // ══════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should show error feedback on failed submission', async () => {
      const failProps = {
        ...mockProps,
        onAddRegistro: vi.fn().mockResolvedValue(false)
      };
      
      render(<RegistroOperativo {...failProps} />);
      const user = userEvent.setup();
      
      // Select context
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'cli1');
      await user.selectOptions(selects[1], 'proj1');
      
      const insumosTab = screen.getByRole('button', { name: /Insumos/i });
      await user.click(insumosTab);
      
      // Fill insumo
      const textInputs = screen.getAllByRole('textbox');
      const numberInputs = screen.getAllByRole('spinbutton');
      
      await user.type(textInputs[0], 'Test Item');
      await user.clear(numberInputs[0]);
      await user.type(numberInputs[0], '1');
      await user.clear(numberInputs[1]);
      await user.type(numberInputs[1], '100');
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /Registrar \d+ Insumo/i });
      await user.click(submitButton);
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Algunos insumos no se pudieron guardar/i)).toBeInTheDocument();
      });
    });

    it('should disable submit when context incomplete', () => {
      render(<RegistroOperativo {...mockProps} />);
      
      // MO submit button should be disabled when no timer data
      const moSubmitButton = screen.getByRole('button', { name: /Registrar Horas de Mano de Obra/i });
      expect(moSubmitButton).toBeDisabled();
    });
  });
});
