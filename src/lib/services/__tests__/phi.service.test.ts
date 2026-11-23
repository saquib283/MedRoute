import { encrypt } from '@/lib/auth/crypto';
import { encryptMedicalProfile } from '@/lib/api/phi-encryption';
import { formatPatientForViewer, maskPassportNumber } from '../phi.service';

describe('phi.service — formatPatientForViewer', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('decrypts encrypted medicalProfile arrays so allergies and medications are never lost', () => {
    const encryptedProfile = encryptMedicalProfile({
      allergies: ['Penicillin', 'Sulfa drugs'],
      medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'Daily' }],
      surgeries: [],
      chronicConditions: ['Hypertension'],
    });

    const formatted = formatPatientForViewer({
      id: 'pat-1',
      passportNo: encrypt('A12345678'),
      medicalProfile: encryptedProfile,
    });

    expect(formatted.passportNo).toBe('A12345678');
    expect(formatted.medicalProfile).toEqual({
      allergies: ['Penicillin', 'Sulfa drugs'],
      medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'Daily' }],
      surgeries: [],
      chronicConditions: ['Hypertension'],
    });
  });

  it('handles legacy unencrypted array medicalProfile gracefully', () => {
    const formatted = formatPatientForViewer({
      id: 'pat-2',
      passportNo: 'A12345678',
      medicalProfile: {
        allergies: ['Latex'],
        medications: [],
        surgeries: [],
        chronicConditions: [],
      },
    });
    expect(formatted.passportNo).toBe('A12345678');
    expect(formatted.medicalProfile?.allergies).toEqual(['Latex']);
  });

  it('masks passport numbers for admin list views', () => {
    expect(maskPassportNumber(encrypt('A12345678'))).toBe('*****5678');
    expect(maskPassportNumber('XY99')).toBe('****');
    expect(maskPassportNumber('')).toBe('—');
  });
});
