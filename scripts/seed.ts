import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workspace, workspaceMember } from '@/modules/workspace/workspace.schema';
import { apiKey } from '@/modules/workspace/api-key.schema';
import { getAuth } from '@/modules/auth/auth.config';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed script cannot run in production.');
  process.exit(1);
}

function generateSeedApiKey(): { plaintextKey: string; keyHash: string; keyPrefix: string } {
  const plaintextKey = `qk_${randomBytes(20).toString('hex')}`;
  const keyHash = createHash('sha256').update(plaintextKey).digest('hex');
  const keyPrefix = plaintextKey.slice(0, 11);
  return { plaintextKey, keyHash, keyPrefix };
}

async function seed() {
  console.log('Seeding database...');

  // Truncate all tables (CASCADE handles FK ordering)
  await db.execute(
    sql`TRUNCATE "user", "session", "account", "verification", "workspace", "workspace_member", "api_key" CASCADE`
  );
  console.log('Truncated all tables.');

  // Create test user via Better Auth (exercises full auth stack: password hashing, ID generation)
  const auth = getAuth();
  const signUpResult = await auth.api.signUpEmail({
    body: {
      name: 'Seed User',
      email: 'seed@quaynt.dev',
      password: 'password123',
    },
  });

  const seedUser = signUpResult.user;
  if (!seedUser?.id) {
    throw new Error('Failed to create seed user');
  }
  console.log(`Created user: ${seedUser.id} (${seedUser.email})`);

  // Create default workspace
  const [ws] = await db
    .insert(workspace)
    .values({
      name: 'Seed Workspace',
      slug: 'seed-workspace',
      ownerId: seedUser.id,
    })
    .returning();
  console.log(`Created workspace: ${ws.id} (${ws.slug})`);

  // Add seed user as workspace owner
  await db.insert(workspaceMember).values({
    workspaceId: ws.id,
    userId: seedUser.id,
    role: 'owner',
  });
  console.log('Added seed user as workspace owner.');

  // Create second user (member)
  const memberSignUp = await auth.api.signUpEmail({
    body: {
      name: 'Member User',
      email: 'member@quaynt.dev',
      password: 'password123',
    },
  });

  const memberUser = memberSignUp.user;
  if (!memberUser?.id) {
    throw new Error('Failed to create member user');
  }
  console.log(`Created user: ${memberUser.id} (${memberUser.email})`);

  // Add member user to workspace with member role
  await db.insert(workspaceMember).values({
    workspaceId: ws.id,
    userId: memberUser.id,
    role: 'member',
  });
  console.log('Added member user to workspace.');

  // Create admin API key
  const adminKey = generateSeedApiKey();
  await db.insert(apiKey).values({
    workspaceId: ws.id,
    name: 'Admin API Key',
    keyHash: adminKey.keyHash,
    keyPrefix: adminKey.keyPrefix,
    scopes: 'admin',
  });
  console.log(`Created admin API key (plaintext): ${adminKey.plaintextKey}`);

  // Create read-only API key
  const readKey = generateSeedApiKey();
  await db.insert(apiKey).values({
    workspaceId: ws.id,
    name: 'Read-Only API Key',
    keyHash: readKey.keyHash,
    keyPrefix: readKey.keyPrefix,
    scopes: 'read',
  });
  console.log(`Created read-only API key (plaintext): ${readKey.plaintextKey}`);

  console.log('Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
