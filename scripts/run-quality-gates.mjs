import { execSync } from 'node:child_process';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

try {
  run('npm run quality:governance');
  run('npm run quality:bundle');
  run('npm run quality:routes');
  console.log('All quality gates passed.');
} catch (error) {
  process.exit(1);
}
