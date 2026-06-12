import { IsNumber, IsOptional, IsString, IsPositive, Max, IsInt } from 'class-validator';

export class CreateInvoiceDto {
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsPositive()
  @Max(1_000_000)
  amount_usdc: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(43200)
  expires_in_minutes?: number;
}
