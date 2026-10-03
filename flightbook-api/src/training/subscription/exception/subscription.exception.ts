import { BadRequestException, ConflictException } from "@nestjs/common";

export class SubscriptionException {

    public static alreadyExistsException() {
        throw new ConflictException("The is user already subscribed.");
    }

    public static commentsOnSubscriptionDisabledException() {
        throw new BadRequestException("Comments on subscription are disabled for this school.");
    }
}
