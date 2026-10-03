import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto } from '../../../../EmuKey/backend/src/modules/commerce-payment/presentation/commerce.dto.js';

describe('create order plan identifier validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: CreateOrderDto });

  it('accepts a PostgreSQL UUID returned by the seeded catalog', async () => {
    const input = { planId: 'fee2902f-8158-1a7a-cb11-b53fd910f27f' };
    await expect(validate(input)).resolves.toMatchObject(input);
  });

  it('accepts a generated RFC UUID', async () => {
    const input = { planId: '00000000-0000-4000-8000-000000000001' };
    await expect(validate(input)).resolves.toMatchObject(input);
  });

  it.each([undefined, null, '', 'plan-1', 'fee2902f81581a7acb11b53fd910f27f', 'fee2902f-8158-1a7a-cb11-b53fd910f27g', 42])('rejects malformed plan identifier %s', async (planId) => {
    await expect(validate({ planId })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still rejects client-provided prices and invalid renewal license IDs', async () => {
    const planId = 'fee2902f-8158-1a7a-cb11-b53fd910f27f';
    await expect(validate({ planId, priceVnd: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate({ planId, targetLicenseId: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
