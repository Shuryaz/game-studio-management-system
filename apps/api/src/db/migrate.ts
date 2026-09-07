import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(connection);

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations complete.");

await connection.end();
process.exit(0);
