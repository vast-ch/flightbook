import { Exclude, Expose } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserReadDto } from "../../../user/interface/user-read-dto";
import { AppointmentDto } from "../../appointment/interface/appointment-dto";
import { StudentDto } from "../../student/interface/student-dto";

@Exclude()
export class SubscriptionDto {

    @Expose()
    id: number;

    @Expose()
    @ApiProperty()
    user: UserReadDto;

    @Expose()
    @ApiProperty()
    student: StudentDto;

    @Expose()
    appointment: AppointmentDto;

    @Expose()
    waitingList: boolean;

    @Expose()
    @ApiPropertyOptional()
    comment?: string;

    timestamp: Date;
}
