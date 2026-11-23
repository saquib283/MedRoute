import fs from 'fs';
import path from 'path';

describe('Phase 1 Schema & Migration Sync', () => {
  const schemaText = fs.readFileSync(
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf-8'
  );

  it('defines PasswordResetToken model and storageKey fields on Document and MedicalBill', () => {
    expect(schemaText).toContain('model PasswordResetToken');
    expect(schemaText).toMatch(/model Document[\s\S]*?storageKey\s+String\?\s+@map\("storage_key"\)/);
    expect(schemaText).toMatch(/model MedicalBill[\s\S]*?storageKey\s+String\?\s+@map\("storage_key"\)/);
  });

  it('ships the Phase 1 reconciliation migration creating all missing tables', () => {
    const migPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261123000000_sync_schema_phase1',
      'migration.sql'
    );
    expect(fs.existsSync(migPath)).toBe(true);
    const sql = fs.readFileSync(migPath, 'utf-8');
    for (const table of [
      'clinical_steps',
      'fit_to_fly_clearances',
      'medical_bills',
      'bill_items',
      'hotels',
      'hotel_bookings',
      'password_reset_tokens',
    ]) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``);
    }
  });
});
