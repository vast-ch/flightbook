import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractSocialLogin1791472417355 implements MigrationInterface {
    name = 'ContractSocialLogin1791472417355'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "salt"`);
        await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "login_type"`);
        await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "sociallogin_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_user" ADD "sociallogin_id" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "app_user" ADD "login_type" character varying(25) NOT NULL DEFAULT 'LOCAL'`);
        await queryRunner.query(`ALTER TABLE "app_user" ADD "salt" character varying(255)`);
    }

}
