#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const requireFromBackend = createRequire(
  new globalThis.URL("../../../EmuKey/backend/package.json", import.meta.url),
);
const argon2 = requireFromBackend("argon2");
const { Client } = requireFromBackend("pg");
const { keccak256 } = requireFromBackend("viem");

const ACCOUNT_PASSWORD = "Emu@1234";
const PRODUCT_COUNT = 50;
const BUSINESS_ROW_COUNT = 30;
const CHECKPOINT_ROW_COUNT = 10;
const SEED_NAMESPACE = "emukey-root-demo-v1";

const DATABASE_SQL = readFileSync(
  new globalThis.URL("../../../EmuKey/backend/database/schema.sql", import.meta.url),
  "utf8",
);
function seedSection(name) {
  const pieces = DATABASE_SQL.split(`$emukey_seed_${name}$`);
  if (pieces.length !== 3) throw new Error(`Missing or ambiguous SQL seed section: ${name}`);
  return pieces[1].trim();
}
const PRODUCT_CATALOG = JSON.parse(seedSection("products"));
const IMAGE_URLS = PRODUCT_CATALOG.map(({ image_url: imageUrl }) => imageUrl);
const ACTIVATION_FIXTURES = JSON.parse(seedSection("activations"));
const TABLE_EXPECTATIONS = {
  chain_commands: BUSINESS_ROW_COUNT,
  chain_events: BUSINESS_ROW_COUNT,
  chain_indexer_checkpoints: CHECKPOINT_ROW_COUNT,
  conversations: BUSINESS_ROW_COUNT,
  knowledge_chunks: BUSINESS_ROW_COUNT,
  knowledge_documents: BUSINESS_ROW_COUNT,
  license_devices: BUSINESS_ROW_COUNT,
  licenses: BUSINESS_ROW_COUNT,
  messages: BUSINESS_ROW_COUNT,
  mobile_push_tokens: BUSINESS_ROW_COUNT,
  notifications: BUSINESS_ROW_COUNT,
  orders: BUSINESS_ROW_COUNT,
  payment_attempts: BUSINESS_ROW_COUNT,
  payment_transactions: BUSINESS_ROW_COUNT,
  plans: BUSINESS_ROW_COUNT,
  products: PRODUCT_COUNT,
  users: BUSINESS_ROW_COUNT,
};

const SEED_SQL = seedSection("demo");
const COUNT_SQL = seedSection("counts");

function usage() {
  console.log(`Usage:
  node --env-file-if-exists=EmuKey/backend/.env tooling/emukey/fixtures/seed-demo-data.mjs --yes
  node tooling/emukey/fixtures/seed-demo-data.mjs --validate-only

Options:
  --yes               Confirm writing demo data to DATABASE_URL.
  --validate-only     Validate fixture counts and live images without writing data.
  --skip-image-check  Skip the live image URL check (intended for automated tests).
  --print-accounts    Print every generated demo login email.

Safety:
  NODE_ENV must be development. The script is idempotent and does not delete rows.
  All generated accounts use the password ${ACCOUNT_PASSWORD}.`);
}

function validateFixtures() {
  if (ACTIVATION_FIXTURES.length !== BUSINESS_ROW_COUNT || ACTIVATION_FIXTURES.some((fixture, index) =>
    fixture.i !== index + 1 || !/^0x[0-9a-f]{64}$/.test(fixture.activation_key) ||
    keccak256(fixture.activation_key) !== fixture.activation_commitment)) {
    throw new Error("SQL demo activation fixtures are invalid");
  }
  if (PRODUCT_CATALOG.length !== PRODUCT_COUNT) {
    throw new Error(
      `Product fixture count mismatch: expected ${PRODUCT_COUNT}, received ${PRODUCT_CATALOG.length}`,
    );
  }
  if (
    PRODUCT_CATALOG.filter(({ status }) => status === "PUBLISHED").length !==
    BUSINESS_ROW_COUNT
  ) {
    throw new Error(`Exactly ${BUSINESS_ROW_COUNT} products must be published`);
  }

  const codes = new Set(PRODUCT_CATALOG.map(({ code }) => code));
  const imageUrls = new Set(IMAGE_URLS);
  if (codes.size !== PRODUCT_COUNT || imageUrls.size !== PRODUCT_COUNT) {
    throw new Error("Product codes and image URLs must be unique");
  }

  for (const [table, expected] of Object.entries(TABLE_EXPECTATIONS)) {
    const valid =
      table === "products" ? expected >= 50 : expected >= 10 && expected <= 30;
    if (!valid) {
      throw new Error(
        `Seed row count for ${table} is outside the requested range`,
      );
    }
  }
}

async function checkImage(url) {
  const response = await globalThis.fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: globalThis.AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  await response.body?.cancel();
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error(
      `Image check failed (${response.status}, ${contentType || "unknown type"}): ${url}`,
    );
  }
}

async function checkImages() {
  for (let offset = 0; offset < IMAGE_URLS.length; offset += 8) {
    await Promise.all(IMAGE_URLS.slice(offset, offset + 8).map(checkImage));
  }
}

async function run() {
  const args = new Set(process.argv.slice(2));
  validateFixtures();
  if (args.has("--help") || args.has("-h")) {
    usage();
    return;
  }
  if (args.has("--validate-only")) {
    if (!args.has("--skip-image-check")) {
      await checkImages();
    }
    console.log(
      `Validated ${PRODUCT_CATALOG.length} products, ${Object.keys(TABLE_EXPECTATIONS).length} table expectations, and ${args.has("--skip-image-check") ? 0 : IMAGE_URLS.length} live image URLs.`,
    );
    return;
  }
  if (!args.has("--yes")) {
    usage();
    throw new Error("Refusing to write without --yes");
  }
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Demo seed is allowed only when NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!args.has("--skip-image-check")) {
    await checkImages();
    console.log(`Verified ${IMAGE_URLS.length} live product image URLs.`);
  }

  const passwordHash = await argon2.hash(ACCOUNT_PASSWORD, {
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
  });
  const database = new Client({
    application_name: "emukey-demo-seed",
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await database.connect();
    const preflight = await database.query(`
      SELECT
        current_database() AS database,
        (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url'
        ) AS has_image_url
    `);
    const target = preflight.rows[0];
    if (Number(target?.tables) !== 19 || target?.has_image_url !== true) {
      throw new Error(
        "Database does not match the current EmuKey schema; run db:verify first",
      );
    }

    await database.query("BEGIN");
    try {
      await database.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)),
                 set_config('emukey.seed_namespace', $1, true),
                 set_config('emukey.seed_password_hash', $2, true),
                 set_config('emukey.seed_activations', $3, true),
                 set_config('emukey.seed_products', $4, true),
                 set_config('emukey.seed_environment', 'development', true)`,
        [
          SEED_NAMESPACE,
          passwordHash,
          JSON.stringify(ACTIVATION_FIXTURES),
          JSON.stringify(PRODUCT_CATALOG),
        ],
      );
      await database.query(SEED_SQL);
      const countsResult = await database.query(COUNT_SQL);
      const counts = Object.fromEntries(
        countsResult.rows.map((row) => [row.table_name, Number(row.row_count)]),
      );
      for (const [table, expected] of Object.entries(TABLE_EXPECTATIONS)) {
        if (counts[table] !== expected) {
          throw new Error(
            `Seed verification failed for ${table}: expected ${expected}, received ${counts[table] ?? 0}`,
          );
        }
      }

      const loginResult = await database.query(`
        SELECT DISTINCT ON (role) role, email::text AS email, password_hash
        FROM users
        WHERE email::text LIKE '%@demo.emukey.local'
        ORDER BY role, email
      `);
      const passwordStats = await database.query(`
        SELECT count(*)::int AS accounts,
               count(DISTINCT password_hash)::int AS distinct_hashes
        FROM users
        WHERE email::text LIKE '%@demo.emukey.local'
      `);
      if (
        loginResult.rows.length !== 4 ||
        passwordStats.rows[0]?.accounts !== TABLE_EXPECTATIONS.users ||
        passwordStats.rows[0]?.distinct_hashes !== 1 ||
        !(await argon2.verify(
          loginResult.rows[0].password_hash,
          ACCOUNT_PASSWORD,
        ))
      ) {
        throw new Error("Generated account password verification failed");
      }

      const customerLicenses = await database.query(`
        SELECT order_row.id AS "orderId",
               order_row.order_number AS "orderNumber",
               customer.email::text AS "customerEmail",
               activation.activation_key AS "activationKey"
        FROM _demo_orders AS demo
        JOIN orders AS order_row ON order_row.id = demo.id
        JOIN users AS customer ON customer.id = demo.customer_user_id
        JOIN jsonb_to_recordset(current_setting('emukey.seed_activations')::jsonb)
          AS activation(i integer, activation_key text, activation_commitment text)
          ON activation.i = demo.i
        ORDER BY demo.i
        LIMIT 3
      `);

      await database.query("COMMIT");
      console.log(
        JSON.stringify(
          {
            database: target.database,
            password: ACCOUNT_PASSWORD,
            sampleAccounts: loginResult.rows.map(({ email, role }) => ({
              email,
              role,
            })),
            sampleCustomerLicenses: customerLicenses.rows,
            seededRows: counts,
          },
          null,
          2,
        ),
      );

      if (args.has("--print-accounts")) {
        const accounts = await database.query(`
          SELECT role, email::text AS email
          FROM users
          WHERE email::text LIKE '%@demo.emukey.local'
          ORDER BY role, email
        `);
        console.table(accounts.rows);
      }
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    }
  } finally {
    await database.end();
  }
}

await run();
