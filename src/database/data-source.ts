import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities';
import { InitialSchema1763299200000 } from './migrations/1763299200000-InitialSchema';
import { MakeUserMobileNullable1795087523965 } from './migrations/1795087523965-MakeUserMobileNullable';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env first.');
}

/** Used by the TypeORM CLI (migrations) and the seed / create-admin scripts. */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  entities: ALL_ENTITIES,
  migrations: [InitialSchema1763299200000, MakeUserMobileNullable1795087523965],
  synchronize: false,
  logging: false,
});
