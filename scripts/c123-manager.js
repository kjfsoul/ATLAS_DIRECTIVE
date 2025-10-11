const { spawnSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const cmd = argv._[0];

function runNodeScript(relPath, args = []) {
  const full = path.join(process.cwd(), relPath);
  const res = spawnSync(process.execPath, [full, ...args], { stdio: 'inherit' });
  return res.status;
}

async function main() {
  switch (cmd) {
    case 'status':
      return runNodeScript('./scripts/checkNarrativeEditLock.js');
    case 'acquire':
      return runNodeScript('./scripts/acquireNarrativeLock.js', process.argv.slice(3));
    case 'release':
      return runNodeScript('./scripts/releaseNarrativeLock.js', process.argv.slice(3));
    case 'merge':
      // before merge ensure lock is held by caller
      {
        const check = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/checkNarrativeEditLock.js')], { encoding: 'utf8' });
        if (check.status !== 0 && check.stdout.trim() === '') {
          console.error('Lock check failed. Ensure you hold the lock before merging.');
          return 2;
        }
        // proceed to merge
        return runNodeScript('./scripts/mergeNarratives.js');
      }
    default:
      console.log(`C123 manager usage:
  node ./scripts/c123-manager.js status
  node ./scripts/c123-manager.js acquire -- --agent <AgentName>
  node ./scripts/c123-manager.js release -- --agent <AgentName>
  node ./scripts/c123-manager.js merge
`);
      return 0;
  }
}

process.exitCode = main();
