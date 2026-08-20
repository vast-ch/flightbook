import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserCustomValues1785447600000 implements MigrationInterface {
    name = 'AddUserCustomValues1785447600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight" ADD "user_custom_values" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight" DROP COLUMN "user_custom_values"`);
    }
}
