// PrismaClient: Object used to communicate with the database
// كائن نستخدمه للتواصل مع قاعدة البيانات

import 'dotenv/config' // Load variables from .env into process.env before anything else runs
import { PrismaClient } from '@prisma/client' // Main ORM client generated from your Prisma schema
import { PrismaPg } from '@prisma/adapter-pg' // Driver adapter so Prisma talks to PostgreSQL via the `pg` package

const adapter = new PrismaPg({
  // Wrap PostgreSQL connection settings for Prisma’s driver-adapter API
  connectionString: process.env.DATABASE_URL, // Connection URL from environment (host, user, password, database)
})

const prisma = new PrismaClient({
  adapter, // Use the PostgreSQL adapter instead of Prisma’s default built-in engine
})

export default prisma // Single shared client instance for the whole app (import this everywhere you query the DB)
