import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class AppointmentDeleteDto {

    /** Optional text from the instructor, passed on to the subscribers. */
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @ApiPropertyOptional()
    message?: string;
}
