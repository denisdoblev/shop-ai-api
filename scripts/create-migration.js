const path = require('path');
const { spawnSync } = require('child_process');


// Accept --name=Foo or Foo as argument
let migrationName = process.env.npm_config_name || process.argv.slice(2).find(Boolean);
if (migrationName && migrationName.startsWith('--name=')) {
  migrationName = migrationName.replace(/^--name=/, '');
}

if (!migrationName) {
  console.error('Missing migration name. Example: pnpm run migration:create --name=AddUsersTable');
  process.exit(1);
}

const cliArgs = [
  'exec',
  'ts-node',
  '-r',
  'tsconfig-paths/register',
  './node_modules/typeorm/cli',
  'migration:generate',
  '-d',
  './src/db/data-source.ts',
  path.posix.join('src/db/migrations', migrationName),
];

if (process.env.npm_config_pretty === 'true') {
  cliArgs.push('--pretty');
}

if (process.env.npm_config_outputjs === 'true') {
  cliArgs.push('--outputJs');
}

if (process.env.npm_config_esm === 'true') {
  cliArgs.push('--esm');
}

if (process.env.npm_config_dryrun === 'true') {
  cliArgs.push('--dryrun');
}

if (process.env.npm_config_check === 'true') {
  cliArgs.push('--check');
}

if (process.env.npm_config_timestamp) {
  cliArgs.push('--timestamp', process.env.npm_config_timestamp);
}

const result = spawnSync('pnpm', cliArgs, {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);