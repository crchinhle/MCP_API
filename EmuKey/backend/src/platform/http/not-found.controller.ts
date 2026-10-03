import { All, Controller, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class NotFoundController {
  @All('{*splat}')
  notFound(): never {
    throw new NotFoundException();
  }
}
