import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VehiculosAdminView from '../components/VehiculosAdminView';
import { DatabaseState } from '../types';
import * as authFetch from '../authFetch';

vi.mock('../components/vehiculos/VehiculosAnalysis', () => ({
  default: () => <div data-testid="vehiculos-analysis">Analysis Dashboard</div>
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

const mockData: DatabaseState = {
  clientes: [
    { id: 'cli1', nombre: 'Cliente A' },
    { id: 'cli2', nombre: 'Cliente B' }
  ],
  colaboradores: [],
  proyectos: [
    { id: 'proj1', nombre: 'Proyecto Alpha', clienteId: 'cli1', clienteNombre: 'Cliente A', estado: 'En Proceso' },
    { id: 'proj2', nombre: 'Proyecto Beta', clienteId: 'cli2', clienteNombre: 'Cliente B', estado: 'Finalizado' },
    { id: 'proj3', nombre: 'Proyecto Gamma', clienteId: 'cli1', clienteNombre: 'Cliente A', estado: 'En Proceso' }
  ],
  registros: [],
  registrosVehiculo: [
    {
      id: 'veh1',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj1',
      proyectoNombre: 'Proyecto Alpha',
      fecha: '2026-06-20',
      kmInicial: 1000,
      kmFinal: 1050,
      distanciaOdometro: 50,
      distanciaGPS: 49.5,
      combustibleLitros: 5,
      combustibleCosto: 50000,
      total: 50000,
      fotoKmInicial: '/uploads/km-inicial.jpg',
      fotoKmFinal: '/uploads/km-final.jpg',
      fotoOdometroInicio: '/uploads/km-inicial.jpg',
      fotoOdometroFin: '/uploads/km-final.jpg',
      descripcion: 'Viaje al cliente',
      alertaDiscrepancia: false,
      discrepancia: 1.0,
      origen: 'Manual',
      fechaImportacion: '2026-06-20T14:00:00Z',
      ubicacionInicio: { lat: -25.2637, lng: -57.5759, nombre: 'Oficina' },
      ubicacionFin: { lat: -25.2837, lng: -57.5959, nombre: 'Cliente A' },
      horaInicio: '09:00',
      horaFin: '10:00',
      duracionMinutos: 60,
      consumoPorKm: 0.1
    },
    {
      id: 'veh2',
      clienteId: 'cli2',
      clienteNombre: 'Cliente B',
      proyectoId: 'proj2',
      proyectoNombre: 'Proyecto Beta',
      fecha: '2026-06-21',
      kmInicial: 2000,
      kmFinal: 2100,
      distanciaOdometro: 100,
      distanciaGPS: 120,
      combustibleLitros: 10,
      combustibleCosto: 100000,
      total: 100000,
      fotoKmInicial: '/uploads/km2-inicial.jpg',
      fotoKmFinal: '/uploads/km2-final.jpg',
      fotoOdometroInicio: '/uploads/km2-inicial.jpg',
      fotoOdometroFin: '/uploads/km2-final.jpg',
      descripcion: 'Viaje de supervisión',
      alertaDiscrepancia: true,
      discrepancia: 20.0,
      origen: 'Excel',
      fechaImportacion: '2026-06-21T10:00:00Z',
      ubicacionInicio: { lat: -25.2637, lng: -57.5759, nombre: 'Oficina' },
      ubicacionFin: { lat: -25.3837, lng: -57.6959, nombre: 'Cliente B' },
      horaInicio: '14:00',
      horaFin: '16:00',
      duracionMinutos: 120,
      consumoPorKm: 0.1
    },
    {
      id: 'veh3',
      clienteId: 'cli1',
      clienteNombre: 'Cliente A',
      proyectoId: 'proj3',
      proyectoNombre: 'Proyecto Gamma',
      fecha: '2026-06-22',
      kmInicial: 3000,
      kmFinal: 3200,
      distanciaOdometro: 200,
      distanciaGPS: 198,
      combustibleLitros: 20,
      combustibleCosto: 200000,
      total: 200000,
      fotoKmInicial: '/uploads/km3-inicial.jpg',
      fotoKmFinal: '/uploads/km3-final.jpg',
      fotoOdometroInicio: '/uploads/km3-inicial.jpg',
      fotoOdometroFin: '/uploads/km3-final.jpg',
      descripcion: 'Viaje largo',
      alertaDiscrepancia: false,
      discrepancia: 1.0,
      origen: 'Manual',
      fechaImportacion: '2026-06-22T08:00:00Z',
      ubicacionInicio: { lat: -25.2637, lng: -57.5759, nombre: 'Oficina' },
      ubicacionFin: { lat: -25.5837, lng: -57.8959, nombre: 'Obra Gamma' },
      horaInicio: '08:00',
      horaFin: '11:00',
      duracionMinutos: 180,
      consumoPorKm: 0.1
    }
  ]
};

describe('VehiculosAdminView', () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders header with title', () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('Registro de Vehículos')).toBeInTheDocument();
    });

    it('displays total records count', () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays all vehicle records in table', () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('Viaje al cliente')).toBeInTheDocument();
      expect(screen.getByText('Viaje de supervisión')).toBeInTheDocument();
      expect(screen.getByText('Viaje largo')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('toggles to dashboard view', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const dashboardButton = screen.getByRole('button', { name: /Dashboard/i });
      await user.click(dashboardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('vehiculos-analysis')).toBeInTheDocument();
      });
    });

    it('toggles back to list view', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const dashboardButton = screen.getByRole('button', { name: /Dashboard/i });
      await user.click(dashboardButton);
      
      const listButton = screen.getByRole('button', { name: /Listado/i });
      await user.click(listButton);
      
      await waitFor(() => {
        expect(screen.getByText('Viaje al cliente')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('filters by "Con Alertas"', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const alertasButton = screen.getByRole('button', { name: /Con Alertas/i });
      await user.click(alertasButton);
      
      await waitFor(() => {
        expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
        expect(screen.queryByText('Proyecto Alpha')).not.toBeInTheDocument();
      });
    });

    it('filters by "Sin Alertas"', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const sinAlertasButton = screen.getByRole('button', { name: /Sin Alertas/i });
      await user.click(sinAlertasButton);
      
      await waitFor(() => {
        expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
        expect(screen.getByText('Proyecto Gamma')).toBeInTheDocument();
        expect(screen.queryByText('Proyecto Beta')).not.toBeInTheDocument();
      });
    });

    it('resets to "Todos"', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const alertasButton = screen.getByRole('button', { name: /Con Alertas/i });
      await user.click(alertasButton);
      
      const todosButton = screen.getByRole('button', { name: /Todos \(3\)/i });
      await user.click(todosButton);
      
      await waitFor(() => {
        expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
        expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
        expect(screen.getByText('Proyecto Gamma')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Modal', () => {
    it('opens edit modal', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Editar Registro de Vehículo')).toBeInTheDocument();
      });
    });

    it('closes modal on cancel', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Editar Registro de Vehículo')).not.toBeInTheDocument();
      });
    });

    it('updates kmInicial field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      const inputs = screen.getAllByRole('spinbutton');
      const kmInicialInput = inputs.find(input => 
        input.previousElementSibling?.textContent?.includes('Km Inicial')
      );
      if (kmInicialInput) {
        await user.clear(kmInicialInput);
        await user.type(kmInicialInput, '1500');
        expect(kmInicialInput).toHaveValue(1500);
      }
    });

    it('updates kmFinal field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      const inputs = screen.getAllByRole('spinbutton');
      const kmFinalInput = inputs.find(input => 
        input.previousElementSibling?.textContent?.includes('Km Final')
      );
      if (kmFinalInput) {
        await user.clear(kmFinalInput);
        await user.type(kmFinalInput, '1600');
        expect(kmFinalInput).toHaveValue(1600);
      }
    });

    it('updates combustible litros field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      // Find input by type and nearby label text
      const inputs = screen.getAllByRole('spinbutton');
      const litrosInput = inputs.find(input => 
        input.previousElementSibling?.textContent?.includes('Litros')
      );
      
      if (litrosInput) {
        await user.clear(litrosInput);
        await user.type(litrosInput, '8');
        expect(litrosInput).toHaveValue(8);
      }
    });

    it('updates fecha field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      // Find the date input
      const dateInputs = screen.getAllByDisplayValue('2026-06-22');
      const fechaInput = dateInputs[0];
      
      await user.clear(fechaInput);
      await user.type(fechaInput, '2026-07-15');
      
      expect(fechaInput).toHaveValue('2026-07-15');
    });

    it('updates total (Costo Total) field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      // Find input by nearby label text
      const inputs = screen.getAllByRole('spinbutton');
      const totalInput = inputs.find(input => 
        input.previousElementSibling?.textContent?.includes('Costo Total')
      );
      
      if (totalInput) {
        await user.clear(totalInput);
        await user.type(totalInput, '75000');
        expect(totalInput).toHaveValue(75000);
      }
    });

    it('updates descripcion field', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      // Find textarea by placeholder
      const descripcionInput = screen.getByPlaceholderText(/Descripción del viaje/i);
      await user.clear(descripcionInput);
      await user.type(descripcionInput, 'Nueva descripción');
      
      expect(descripcionInput).toHaveValue('Nueva descripción');
    });

    it('submits edit successfully', async () => {
      vi.spyOn(authFetch, 'authFetchJSON').mockResolvedValue({ success: true });
      mockOnRefresh.mockResolvedValue(undefined);
      
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      const saveButton = screen.getByRole('button', { name: /Guardar Cambios/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    it('shows error on failed edit', async () => {
      vi.spyOn(authFetch, 'authFetchJSON').mockRejectedValue(new Error('Network error'));
      
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const editButtons = screen.getAllByLabelText(/Editar viaje/i);
      await user.click(editButtons[0]);
      
      const saveButton = screen.getByRole('button', { name: /Guardar Cambios/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Modal', () => {
    it('opens delete confirmation modal', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const deleteButtons = screen.getAllByLabelText(/Eliminar viaje/i);
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirmar Eliminación/i)).toBeInTheDocument();
      });
    });

    it('confirms delete and refreshes data', async () => {
      vi.spyOn(authFetch, 'authFetchJSON').mockResolvedValue({ success: true });
      mockOnRefresh.mockResolvedValue(undefined);
      
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const deleteButtons = screen.getAllByLabelText(/Eliminar viaje/i);
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirmar Eliminación/i)).toBeInTheDocument();
      });
      
      // Find the confirm button in the modal (not the one in the card)
      const allButtons = screen.getAllByRole('button');
      const confirmButton = allButtons.find(btn => 
        btn.textContent?.includes('Eliminar') && !btn.getAttribute('aria-label')
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }
      
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    it('cancels delete modal', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const deleteButtons = screen.getAllByLabelText(/Eliminar viaje/i);
      await user.click(deleteButtons[0]);
      
      const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Confirmar Eliminación/i)).not.toBeInTheDocument();
      });
    });

    it('shows error on failed delete', async () => {
      vi.spyOn(authFetch, 'authFetchJSON').mockRejectedValue(new Error('Network error'));
      
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      const deleteButtons = screen.getAllByLabelText(/Eliminar viaje/i);
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirmar Eliminación/i)).toBeInTheDocument();
      });
      
      // Find the confirm button in the modal
      const allButtons = screen.getAllByRole('button');
      const confirmButton = allButtons.find(btn => 
        btn.textContent?.includes('Eliminar') && !btn.getAttribute('aria-label')
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Foto Modal', () => {
    it('opens foto modal when clicking foto button', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      // First expand a card to reveal foto buttons
      const expandButton = screen.getAllByRole('button', { name: /Ver detalles del viaje/i })[0];
      await user.click(expandButton);
      
      // Now find the foto button by alt text of the image inside
      await waitFor(() => {
        expect(screen.getByAltText('Odómetro Inicio')).toBeInTheDocument();
      });
      
      // Click the button containing the image
      const fotoButton = screen.getByAltText('Odómetro Inicio').closest('button');
      if (fotoButton) {
        await user.click(fotoButton);
        
        await waitFor(() => {
          expect(screen.getByText(/Odómetro Inicio/i)).toBeInTheDocument();
        });
      }
    });

    it('opens foto modal when clicking Odómetro Fin button', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      // First expand a card to reveal foto buttons
      const expandButton = screen.getAllByRole('button', { name: /Ver detalles del viaje/i })[0];
      await user.click(expandButton);
      
      // Now find the second foto button (Odómetro Fin) by alt text
      await waitFor(() => {
        expect(screen.getByAltText('Odómetro Fin')).toBeInTheDocument();
      });
      
      // Click the button containing the Odómetro Fin image
      const fotoFinButton = screen.getByAltText('Odómetro Fin').closest('button');
      if (fotoFinButton) {
        await user.click(fotoFinButton);
        
        await waitFor(() => {
          expect(screen.getByText(/Odómetro Fin/i)).toBeInTheDocument();
        });
      }
    });

    it('closes foto modal', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      // First expand a card
      const expandButton = screen.getAllByRole('button', { name: /Ver detalles del viaje/i })[0];
      await user.click(expandButton);
      
      // Click foto button
      await waitFor(() => {
        expect(screen.getByAltText('Odómetro Inicio')).toBeInTheDocument();
      });
      
      const fotoButton = screen.getByAltText('Odómetro Inicio').closest('button');
      if (fotoButton) {
        await user.click(fotoButton);
        
        // The modal is closed by clicking on the backdrop
        const modal = screen.getByText(/Odómetro Inicio/i).closest('div[class*="fixed"]');
        if (modal) {
          await user.click(modal);
          
          await waitFor(() => {
            expect(screen.queryByText(/Odómetro Inicio/i)).not.toBeInTheDocument();
          });
        }
      }
    });

    it('does not close foto modal when clicking inside modal content', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} />);
      const user = userEvent.setup();
      
      // Expandir tarjeta y abrir modal
      const expandButton = screen.getAllByRole('button', { name: /Ver detalles del viaje/i })[0];
      await user.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByAltText('Odómetro Inicio')).toBeInTheDocument();
      });
      
      const fotoButton = screen.getByAltText('Odómetro Inicio').closest('button');
      await user.click(fotoButton!);
      
      await waitFor(() => {
        expect(screen.getByText(/Odómetro Inicio/i)).toBeInTheDocument();
      });
      
      // Click DENTRO del modal - NO debe cerrarse
      const modalContent = screen.getByText(/Odómetro Inicio/i).closest('div[class*="rounded-2xl"]');
      await user.click(modalContent!);
      
      // Modal sigue abierto
      expect(screen.getByText(/Odómetro Inicio/i)).toBeInTheDocument();
    });
  });

  describe('Auto-Open & Edge Cases', () => {
    it('auto-opens edit modal when initialEditId provided', async () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} initialEditId="veh1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Editar Registro de Vehículo')).toBeInTheDocument();
      });
    });

    it('does not auto-open if initialEditId not found', () => {
      render(<VehiculosAdminView data={mockData} onRefresh={mockOnRefresh} initialEditId="nonexistent" />);
      
      expect(screen.queryByText('Editar Registro de Vehículo')).not.toBeInTheDocument();
    });

    it('shows empty state when no vehicle records', () => {
      const emptyData = { ...mockData, registrosVehiculo: [] };
      render(<VehiculosAdminView data={emptyData} onRefresh={mockOnRefresh} />);
      
      expect(screen.getByText(/No hay registros de viajes/i)).toBeInTheDocument();
    });
  });
});
