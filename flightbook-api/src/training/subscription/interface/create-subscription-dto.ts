import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateSubscriptionDto {

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    comment?: string;
}
