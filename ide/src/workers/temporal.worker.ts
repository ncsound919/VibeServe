import { Worker } from '@temporalio/worker';
import * as marketActivities from './activities/market.activities';
import * as dbActivities from './activities/database.activities';
import * as agentActivities from './activities/agent.activities';

async function run() {
  const worker = await Worker.create({
    activities: {
      ...marketActivities,
      ...dbActivities,
      ...agentActivities,
    },
    taskQueue: 'nexus-alpha',
  });

  console.log('Nexus Alpha Temporal Worker started. Polling task queue...');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
