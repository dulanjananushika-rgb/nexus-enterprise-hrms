import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';
import { ReportService } from '../src/services/report.service.js';

describe('Payment of Gratuity Act No. 12 of 1983 & Accounting Provisions', () => {
  beforeEach(() => {
    initializeDatabase();
    seedDatabase();
  });

  it('computes accurate statutory gratuity and LKAS 19 reserves for active staff', () => {
    const report = ReportService.getGratuityProvisions();
    expect(report).toBeDefined();
    expect(report.records.length).toBeGreaterThan(0);
    expect(report.totals.totalEmployees).toBe(report.records.length);

    // Verify each record conforms to Sri Lankan legal rules
    report.records.forEach((record) => {
      expect(record.yearsOfService).toBeGreaterThanOrEqual(0);
      if (record.isVested) {
        // Vested employees must have at least 5 completed years
        expect(record.yearsOfService).toBeGreaterThanOrEqual(5);
        expect(record.statutoryGratuityLiabilityCents).toBeGreaterThan(0);
        // Formula: completedYears * (baseSalary / 2)
        const expectedStatutory = Math.floor(record.yearsOfService) * Math.round(record.baseSalaryCents / 2);
        expect(record.statutoryGratuityLiabilityCents).toBe(expectedStatutory);
      } else {
        // Unvested employees have 0 statutory gratuity liability
        expect(record.statutoryGratuityLiabilityCents).toBe(0);
      }

      // LKAS 19 continuous service reserve must always be positive
      expect(record.accruedLkas19ReserveCents).toBeGreaterThanOrEqual(0);
    });
  });

  it('exports valid, parseable Gratuity CSV with statutory columns', () => {
    const csv = ReportService.exportGratuityCsv();
    expect(csv).toContain('Employee Code,Full Name,Department,Hire Date,Years of Service,Vesting Status,Monthly Basic Salary (LKR),Statutory Gratuity Liability (LKR),LKAS 19 Reserve (LKR)');
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });
});
