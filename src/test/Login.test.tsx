import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../components/Login';

describe('Login Component', () => {
  const mockOnLoginSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders login form', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    
    expect(screen.getByText(/Iniciar Sesión/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ej: admin, kevin, rodrigo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('shows error for empty fields', async () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    const user = userEvent.setup();
    
    const submitButton = screen.getByRole('button', { name: /ingresar/i });
    await user.click(submitButton);
    
    const usuarioInput = screen.getByPlaceholderText(/ej: admin, kevin, rodrigo/i) as HTMLInputElement;
    expect(usuarioInput.validity.valueMissing).toBe(true);
  });

  it('handles successful login', async () => {
    const mockUser = {
      nombre: 'Admin User',
      rol: 'Admin',
      usuario: 'admin'
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: mockUser }
      })
    });

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    const user = userEvent.setup();
    
    await user.type(screen.getByPlaceholderText(/ej: admin, kevin, rodrigo/i), 'admin');
    await user.type(screen.getByPlaceholderText(/••••••••/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    
    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockUser);
    });
  });
});
