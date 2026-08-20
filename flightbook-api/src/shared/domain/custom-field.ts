import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

export enum CustomFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  DROPDOWN = 'dropdown'
}

@Expose()
export class CustomFieldDefinition {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @ApiProperty()
  @IsBoolean()
  required: boolean;

  @ApiProperty()
  @IsBoolean()
  disabled: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

@Expose()
export class FlightConfig {
  @ApiProperty({ type: [CustomFieldDefinition] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDefinition)
  customFields: CustomFieldDefinition[];
}
