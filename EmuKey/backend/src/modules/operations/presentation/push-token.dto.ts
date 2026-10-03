import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ minLength: 8, maxLength: 512 })
  @IsString()
  @Length(8, 512)
  token!: string;

  @ApiProperty({ enum: ['FCM', 'EXPO'] })
  @IsIn(['FCM', 'EXPO'])
  provider!: 'FCM' | 'EXPO';
}
