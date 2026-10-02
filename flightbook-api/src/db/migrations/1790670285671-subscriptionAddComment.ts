import { MigrationInterface, QueryRunner } from "typeorm";

export class SubscriptionAddComment1790670285671 implements MigrationInterface {
    name = 'SubscriptionAddComment1790670285671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription" ADD "comment" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "comment"`);
    }

}
