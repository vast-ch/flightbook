import {BadRequestException, ConflictException, UnprocessableEntityException} from "@nestjs/common";

export class UserException {

    public static invalidEmailException(type?: string) {
        if (!type || type == "") {
            type = "user";
        }
        throw new UnprocessableEntityException(`A ${type} email must be provided and be valid`)
    }

    public static invalidEmailTokenVerificationException() {
        throw new BadRequestException('Invalid verification token')
    }

    public static customFieldTypeImmutableException(fieldKey: string) {
        throw new BadRequestException(`Cannot change type of custom field '${fieldKey}'. Type is immutable.`)
    }

    public static customFieldDuplicateKeysException(duplicateKeys: string[]) {
        throw new BadRequestException(`Duplicate custom field keys found: ${duplicateKeys.join(', ')}`)
    }
}
