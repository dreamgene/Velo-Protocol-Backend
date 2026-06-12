import { IsArray, IsString, IsUrl, ArrayNotEmpty } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl({ require_tld: true })
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];
}
