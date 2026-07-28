// services/auth-service/src/scripts/backfillUserUpdated.js
//
// One-off script: publishes a `user_updated` event for every existing user,
// so post-service's local User copies pick up avatars (and names) that
// were set before the user_updated sync existed.
//
// Run once: node src/scripts/backfillUserUpdated.js
// Safe to re-run — it's just re-publishing current state, not mutating anything.

import connectDB from '../db/db.js';
import userModel from '../model/user.model.js';
import { connect, publishToQueue } from '../broker/rabbit.js';

const run = async () => {
  await connectDB();
  console.log('Mongo connected');

  await connect(); // opens the RabbitMQ channel used by publishToQueue
  console.log('RabbitMQ connected');

  const users = await userModel.find({}, '_id fullname avatar').lean();
  console.log(`Found ${users.length} users. Publishing user_updated for each...`);

  for (const user of users) {
    await publishToQueue('user_updated', {
      id: user._id,
      fullname: user.fullname,
      avatar: user.avatar,
    });
  }

  console.log('Done. Give post-service a few seconds to drain the queue, then check the comments API again.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});