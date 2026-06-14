import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Exclude, Expose, Type } from "class-transformer";
import { IsBoolean, IsDate, IsNotEmpty, ValidateNested } from "class-validator";
import { SchoolDto } from "../../../training/school/interface/school-dto";

@Exclude()
export class PassengerConfirmationDto {
    @Expose()
    readonly id: number;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    @IsDate()
    @Type(() => Date)
    readonly date: Date;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly firstname: string;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly lastname: string;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly email: string;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly phone: string;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly place: string; 

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly signature: string;

    @Expose()
    @ApiProperty({ description: 'MIME type of the signature, e.g., "image/svg+xml"'})
    @IsNotEmpty()
    signatureMimeType: string;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    @IsBoolean()
    readonly validated: boolean;

    @Expose()
    @ApiProperty()
    @IsNotEmpty()
    readonly canUseData: boolean;

    @ApiPropertyOptional()
    @Expose()
    @ValidateNested()
    @Type(() => SchoolDto)
    readonly tandemSchool: SchoolDto | null;
}
