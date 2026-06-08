import { runMigrations } from './src/config/migrations';

async function main() {
  try {
    await runMigrations();
    console.log('Migrations completed.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
