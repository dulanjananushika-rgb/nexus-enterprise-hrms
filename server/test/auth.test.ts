import { describe, it, expect, beforeAll } from 'vitest';
import { AuthService } from '../src/services/auth.service.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Authentication & Security Controls', () => {
  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
  });

  it('authenticates valid credentials and issues valid JWT payload', () => {
    const result = AuthService.login('admin@nexus.com', 'Password123!');
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('admin@nexus.com');
    expect(result.user.role).toBe('SUPER_ADMIN');
  });

  it('fails with invalid password and throws error', () => {
    expect(() => {
      AuthService.login('admin@nexus.com', 'WrongPassword!');
    }).toThrow('Invalid email or password.');
  });

  it('retrieves detailed user profile for valid user id', () => {
    const login = AuthService.login('hr@nexus.com', 'Password123!');
    const profile = AuthService.getProfile(login.user.id) as {
      email: string;
      role: string;
      employee_code: string;
      department_name: string;
    };

    expect(profile).toBeDefined();
    expect(profile.email).toBe('hr@nexus.com');
    expect(profile.role).toBe('HR_MANAGER');
    expect(profile.employee_code).toBe('EMP-0001');
    expect(profile.department_name).toBe('Human Resources & People');
  });
});
