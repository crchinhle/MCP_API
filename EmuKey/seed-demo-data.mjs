#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const requireFromBackend = createRequire(
  new globalThis.URL("./backend/package.json", import.meta.url),
);
const argon2 = requireFromBackend("argon2");
const { Client } = requireFromBackend("pg");
const { keccak256 } = requireFromBackend("viem");

const ACCOUNT_PASSWORD = "Emu@1234";
const PRODUCT_COUNT = 50;
const BUSINESS_ROW_COUNT = 30;
const CHECKPOINT_ROW_COUNT = 10;
const CUSTOMER_COUNT = 20;
const SEED_NAMESPACE = "emukey-root-demo-v1";

const PRODUCT_FAMILIES = [
  {
    code: "SECUREDESK",
    name: "SecureDesk",
    summary:
      "Bảo vệ máy trạm, mã hóa dữ liệu và kiểm soát thiết bị đầu cuối cho đội ngũ làm việc hiện đại.",
    basePriceVnd: 149_000,
  },
  {
    code: "CLOUDSTUDIO",
    name: "CloudStudio",
    summary:
      "Không gian cộng tác nội dung trên đám mây với phê duyệt, quản lý phiên bản và chia sẻ an toàn.",
    basePriceVnd: 189_000,
  },
  {
    code: "DATAGUARD",
    name: "DataGuard",
    summary:
      "Sao lưu tự động, khôi phục nhanh và giám sát tính toàn vẹn dữ liệu cho doanh nghiệp.",
    basePriceVnd: 229_000,
  },
  {
    code: "CLASSROOM",
    name: "Classroom Hub",
    summary:
      "Quản lý lớp học, học liệu, bài tập và tiến độ học tập trong một cổng đào tạo thống nhất.",
    basePriceVnd: 129_000,
  },
  {
    code: "DEVSHIELD",
    name: "DevShield",
    summary:
      "Quét mã nguồn, phát hiện bí mật và quản trị rủi ro chuỗi cung ứng phần mềm ngay trong CI/CD.",
    basePriceVnd: 259_000,
  },
  {
    code: "RETAILFLOW",
    name: "RetailFlow",
    summary:
      "Đồng bộ bán hàng, tồn kho, khách hàng thân thiết và báo cáo doanh thu cho chuỗi cửa hàng.",
    basePriceVnd: 209_000,
  },
  {
    code: "CLINICDESK",
    name: "ClinicDesk",
    summary:
      "Điều phối lịch hẹn, hồ sơ khám và chăm sóc sau khám dành cho phòng khám vừa và nhỏ.",
    basePriceVnd: 279_000,
  },
  {
    code: "SMARTFACTORY",
    name: "SmartFactory",
    summary:
      "Theo dõi sản xuất, bảo trì thiết bị và cảnh báo vận hành theo thời gian thực tại nhà máy.",
    basePriceVnd: 329_000,
  },
  {
    code: "EDUANALYTICS",
    name: "EduAnalytics",
    summary:
      "Phân tích tuyển sinh, kết quả học tập và mức độ tương tác bằng bảng điều khiển trực quan.",
    basePriceVnd: 169_000,
  },
  {
    code: "TEAMVAULT",
    name: "TeamVault",
    summary:
      "Quản lý mật khẩu, thông tin nhạy cảm và quyền truy cập dùng chung với nhật ký kiểm toán.",
    basePriceVnd: 119_000,
  },
];

const PRODUCT_EDITIONS = [
  {
    code: "STARTER",
    name: "Starter",
    audience: "cá nhân và nhóm nhỏ cần triển khai nhanh",
    billingCycle: "MONTHLY",
    durationMonths: 1,
    priceMultiplier: 1,
    maxActiveDevices: 1,
    planName: "Gói Khởi đầu",
    status: "PUBLISHED",
  },
  {
    code: "PRO",
    name: "Professional",
    audience: "đội ngũ chuyên môn cần tự động hóa quy trình hằng ngày",
    billingCycle: "YEARLY",
    durationMonths: 12,
    priceMultiplier: 10,
    maxActiveDevices: 3,
    planName: "Gói Chuyên nghiệp",
    status: "PUBLISHED",
  },
  {
    code: "BUSINESS",
    name: "Business",
    audience: "doanh nghiệp cần quản trị tập trung và báo cáo nâng cao",
    billingCycle: "YEARLY",
    durationMonths: 12,
    priceMultiplier: 18,
    maxActiveDevices: 10,
    planName: "Gói Doanh nghiệp",
    status: "PUBLISHED",
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    audience: "tổ chức lớn cần SSO, phân quyền sâu và hỗ trợ ưu tiên",
    billingCycle: "YEARLY",
    durationMonths: 12,
    priceMultiplier: 32,
    maxActiveDevices: 30,
    planName: "Gói Enterprise",
    status: "DRAFT",
  },
  {
    code: "ULTIMATE",
    name: "Ultimate",
    audience: "khách hàng từng sử dụng bộ tính năng trọn gói thế hệ trước",
    billingCycle: "YEARLY",
    durationMonths: 12,
    priceMultiplier: 45,
    maxActiveDevices: 50,
    planName: "Gói Ultimate",
    status: "ARCHIVED",
  },
];

const PRODUCT_CATALOG = PRODUCT_EDITIONS.flatMap((edition, editionIndex) =>
  PRODUCT_FAMILIES.map((family, familyIndex) => {
    const i = editionIndex * PRODUCT_FAMILIES.length + familyIndex + 1;
    const imageSeed = `${family.code}-${edition.code}`.toLowerCase();
    return {
      i,
      code: `DEMO_${family.code}_${edition.code}`,
      name: `${family.name} ${edition.name}`,
      description: `${family.summary} Phiên bản ${edition.name} phù hợp với ${edition.audience}.`,
      image_url: `https://picsum.photos/seed/emukey-${imageSeed}/1200/800.jpg`,
      status: edition.status,
      plan_name: edition.planName,
      billing_cycle: edition.billingCycle,
      duration_months: edition.durationMonths,
      price_vnd: family.basePriceVnd * edition.priceMultiplier,
      max_active_devices: edition.maxActiveDevices,
    };
  }),
);

const IMAGE_URLS = PRODUCT_CATALOG.map(({ image_url: imageUrl }) => imageUrl);
const ACTIVATION_FIXTURES = Array.from(
  { length: BUSINESS_ROW_COUNT },
  (_, index) => {
    const i = index + 1;
    const activationKey = `0x${createHash("sha256")
      .update(`${SEED_NAMESPACE}:activation:${i}`)
      .digest("hex")}`;
    return {
      i,
      activation_key: activationKey,
      activation_commitment: keccak256(activationKey),
    };
  },
);
const TABLE_EXPECTATIONS = {
  audit_logs: BUSINESS_ROW_COUNT,
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

const SEED_SQL = String.raw`
CREATE TEMP TABLE _demo_providers ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':provider:' || i)::uuid AS id,
  'provider' || lpad(i::text, 2, '0') || '@demo.emukey.local' AS email,
  (ARRAY[
    'Công ty Cổ phần An Việt Digital',
    'Công ty TNHH Công nghệ Sao Khuê',
    'Công ty Cổ phần Giải pháp Mây Xanh',
    'Công ty TNHH Dữ liệu Minh Tâm',
    'Công ty Cổ phần Nền tảng Tiên Phong'
  ])[i] AS organization_name,
  (ARRAY['Nguyễn Minh Anh', 'Trần Quốc Bảo', 'Lê Hoài Nam', 'Phạm Thu Hà', 'Võ Gia Huy'])[i] AS representative_name
FROM generate_series(1, 5) AS series(i);

CREATE TEMP TABLE _demo_support ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':support:' || i)::uuid AS id,
  'support' || lpad(i::text, 2, '0') || '@demo.emukey.local' AS email,
  (ARRAY['Đỗ Thanh Tùng', 'Bùi Khánh Linh', 'Ngô Hải Yến'])[i] AS display_name
FROM generate_series(1, 3) AS series(i);

CREATE TEMP TABLE _demo_admins ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':admin:' || i)::uuid AS id,
  'admin' || lpad(i::text, 2, '0') || '@demo.emukey.local' AS email,
  (ARRAY['Quản trị hệ thống', 'Điều hành nền tảng'])[i] AS display_name
FROM generate_series(1, 2) AS series(i);

CREATE TEMP TABLE _demo_customers ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':customer:' || i)::uuid AS id,
  'customer' || lpad(i::text, 2, '0') || '@demo.emukey.local' AS email,
  (ARRAY['INDIVIDUAL', 'STUDENT', 'BUSINESS'])[((i - 1) % 3) + 1] AS customer_type,
  (ARRAY[
    'Nguyễn Ngọc Mai', 'Trần Đức Anh', 'Lê Phương Thảo', 'Phạm Quang Minh',
    'Hoàng Bảo Trâm', 'Vũ Tuấn Kiệt', 'Đặng Thu Trang', 'Bùi Nhật Nam',
    'Đỗ Khánh Vy', 'Hồ Minh Khang', 'Ngô Thùy Dương', 'Dương Quốc Việt',
    'Lý Gia Hân', 'Mai Anh Tuấn', 'Tạ Thanh Lam', 'Cao Đức Long',
    'Trịnh Yến Nhi', 'Phan Hoàng Sơn', 'Võ Bảo Ngọc', 'Chu Minh Nhật'
  ])[i] AS display_name
FROM generate_series(1, ${CUSTOMER_COUNT}) AS series(i);

CREATE TEMP TABLE _demo_users ON COMMIT DROP AS
SELECT id FROM _demo_providers
UNION ALL SELECT id FROM _demo_support
UNION ALL SELECT id FROM _demo_admins
UNION ALL SELECT id FROM _demo_customers;

INSERT INTO users (
  id, email, password_hash, display_name, role, status,
  organization_name, representative_name, tax_code, phone, address,
  provider_chain_address, provider_chain_namespace, customer_type,
  email_verified_at
)
SELECT id, email, current_setting('emukey.seed_password_hash'),
       representative_name, 'PROVIDER_ADMIN', 'ACTIVE',
       organization_name, representative_name,
       'DEMO-TAX-' || lpad(i::text, 3, '0'), '028' || lpad((1000000 + i)::text, 7, '0'),
       (ARRAY['Quận 1, TP. Hồ Chí Minh', 'Quận Cầu Giấy, Hà Nội', 'Quận Hải Châu, Đà Nẵng', 'TP. Thủ Đức, TP. Hồ Chí Minh', 'Quận Ninh Kiều, Cần Thơ'])[i],
       '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':provider-address-a:' || i) || md5(current_setting('emukey.seed_namespace') || ':provider-address-b:' || i), 1, 40),
       'demo-provider-' || substr(md5(current_setting('emukey.seed_namespace') || ':provider-namespace:' || i), 1, 12),
       NULL::varchar, NULL::timestamptz
FROM _demo_providers
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       display_name, 'SUPPORT_STAFF', 'ACTIVE',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM _demo_support
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       display_name, 'SYSTEM_ADMIN', 'ACTIVE',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM _demo_admins
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       display_name, 'CUSTOMER', 'ACTIVE',
       NULL, NULL, NULL, '09' || lpad((10000000 + i)::text, 8, '0'),
       (ARRAY['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng'])[((i - 1) % 5) + 1], NULL, NULL,
       customer_type, now() - interval '30 days'
FROM _demo_customers
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  organization_name = EXCLUDED.organization_name,
  representative_name = EXCLUDED.representative_name,
  tax_code = EXCLUDED.tax_code,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  status = 'ACTIVE',
  failed_login_count = 0,
  locked_until = NULL,
  updated_at = now();

CREATE TEMP TABLE _demo_products ON COMMIT DROP AS
SELECT
  catalog.*,
  md5(current_setting('emukey.seed_namespace') || ':product:' || catalog.i)::uuid AS id,
  ((catalog.i - 1) % 5) + 1 AS provider_index
FROM jsonb_to_recordset(current_setting('emukey.seed_products')::jsonb) AS catalog(
  i integer,
  code text,
  name text,
  description text,
  image_url text,
  status text,
  plan_name text,
  billing_cycle text,
  duration_months integer,
  price_vnd bigint,
  max_active_devices integer
);

INSERT INTO products (
  id, provider_user_id, code, name, description, image_url, status, published_at
)
SELECT
  product.id,
  provider.id,
  product.code,
  product.name,
  product.description,
  product.image_url,
  product.status,
  CASE
    WHEN product.status = 'DRAFT' THEN NULL
    ELSE now() - make_interval(days => 65 - product.i)
  END
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = now();

CREATE TEMP TABLE _demo_plans ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':plan:' || product.i)::uuid AS id,
  product.id AS product_id,
  provider.id AS provider_user_id,
  'DEMO_PLAN_' || lpad(product.i::text, 2, '0') AS code,
  product.plan_name,
  product.billing_cycle,
  product.duration_months,
  product.price_vnd,
  product.max_active_devices,
  digest(current_setting('emukey.seed_namespace') || ':plan-commitment:' || product.i, 'sha256') AS plan_commitment
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index
WHERE product.status = 'PUBLISHED';

INSERT INTO plans (
  id, product_id, provider_user_id, code, version, name, billing_cycle,
   duration_months, price_vnd, max_active_devices, entitlements,
   plan_commitment, status, published_at
)
SELECT
  id, product_id, provider_user_id, code, 1,
  plan_name,
  billing_cycle, duration_months, price_vnd, max_active_devices,
   jsonb_build_object(
     'desktop', true,
     'cloudSync', i > 10,
     'prioritySupport', i > 20,
     'analytics', i > 20,
     'demoSeed', current_setting('emukey.seed_namespace')
   ),
   plan_commitment, 'PUBLISHED', now() - make_interval(days => 40 - i)
FROM _demo_plans
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_orders ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':order:' || product.i)::uuid AS id,
  md5(current_setting('emukey.seed_namespace') || ':order-idempotency:' || product.i)::uuid AS idempotency_key,
  customer.id AS customer_user_id,
  plan.provider_user_id,
  plan.product_id,
  plan.id AS plan_id,
  plan.billing_cycle,
  plan.duration_months,
  plan.price_vnd,
   plan.max_active_devices,
  plan.plan_commitment,
  product.name AS product_name,
  provider_name.organization_name AS provider_name
FROM _demo_products AS product
JOIN _demo_plans AS plan ON plan.i = product.i
JOIN _demo_customers AS customer ON customer.i = ((product.i - 1) % ${CUSTOMER_COUNT}) + 1
JOIN users AS provider_name ON provider_name.id = plan.provider_user_id;

INSERT INTO orders (
  id, order_number, idempotency_key, customer_user_id, provider_user_id,
  product_id, plan_id, order_type, order_status, provider_name_snapshot,
  product_name_snapshot, plan_name_snapshot, plan_version_snapshot,
  price_vnd_snapshot, currency, billing_cycle_snapshot,
  duration_months_snapshot, max_active_devices_snapshot,
  entitlements_snapshot,
  plan_commitment_snapshot, payment_due_at, ipn_accept_until
)
SELECT
  id, 'DEMO-' || upper(substr(md5(id::text), 1, 16)), idempotency_key,
  customer_user_id, provider_user_id, product_id, plan_id,
  'NEW_PURCHASE', 'WAITING_SERVICE_TERMS_ACCEPTANCE', provider_name, product_name,
  CASE WHEN billing_cycle = 'YEARLY' THEN 'Gói năm' ELSE 'Gói tháng' END,
  1, price_vnd, 'VND', billing_cycle, duration_months, max_active_devices,
  jsonb_build_object('desktop', true, 'demoSeed', current_setting('emukey.seed_namespace')),
  plan_commitment, statement_timestamp() + interval '7 days',
  statement_timestamp() + interval '8 days'
FROM _demo_orders
ON CONFLICT (id) DO NOTHING;

UPDATE orders
SET order_status = 'WAITING_PAYMENT'
FROM _demo_orders AS demo
WHERE orders.id = demo.id
  AND orders.order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE';

CREATE TEMP TABLE _demo_attempts ON COMMIT DROP AS
SELECT
  orders.i,
  md5(current_setting('emukey.seed_namespace') || ':payment-attempt:' || orders.i)::uuid AS id,
  orders.id AS order_id,
  orders.price_vnd
FROM _demo_orders AS orders;

INSERT INTO payment_attempts (
  id, order_id, attempt_no, provider_reference, amount_vnd, status, expires_at
)
SELECT
  id, order_id, 1, 'DEMO-PAY-' || upper(substr(md5(id::text), 1, 18)),
  price_vnd, 'PENDING', statement_timestamp() + interval '1 day'
FROM _demo_attempts AS attempt
WHERE NOT EXISTS (
  SELECT 1 FROM payment_attempts AS existing WHERE existing.id = attempt.id
)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_transactions ON COMMIT DROP AS
SELECT
  attempt.i,
  md5(current_setting('emukey.seed_namespace') || ':payment-transaction:' || attempt.i)::uuid AS id,
  attempt.order_id,
  attempt.id AS payment_attempt_id,
  attempt.price_vnd,
  statement_timestamp() AS provider_occurred_at
FROM _demo_attempts AS attempt;

INSERT INTO payment_transactions (
  id, provider_event_id, provider_transaction_ref, order_id,
  payment_attempt_id, amount_minor, classification, raw_payload,
  provider_occurred_at
)
SELECT
  transaction.id,
  'DEMO-EVENT-' || upper(substr(md5(transaction.id::text), 1, 18)),
  'DEMO-TXN-' || upper(substr(md5(transaction.order_id::text), 1, 18)),
  transaction.order_id, transaction.payment_attempt_id,
  transaction.price_vnd, 'MATCHED',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'demo', true),
  transaction.provider_occurred_at
FROM _demo_transactions AS transaction
WHERE NOT EXISTS (
  SELECT 1 FROM payment_transactions AS existing WHERE existing.id = transaction.id
)
ON CONFLICT (id) DO NOTHING;

UPDATE payment_attempts
SET status = 'SUCCEEDED'
FROM _demo_attempts AS demo
WHERE payment_attempts.id = demo.id
  AND payment_attempts.status = 'PENDING';

UPDATE orders
SET order_status = 'PAYMENT_ACCEPTED'
FROM _demo_orders AS demo
WHERE orders.id = demo.id
  AND orders.order_status = 'WAITING_PAYMENT';

CREATE TEMP TABLE _demo_licenses ON COMMIT DROP AS
SELECT
  orders.i,
  md5(current_setting('emukey.seed_namespace') || ':license:' || orders.i)::uuid AS id,
  orders.id AS origin_order_id,
  orders.provider_user_id,
  orders.customer_user_id,
  orders.product_id,
  orders.plan_id,
  orders.plan_commitment,
  orders.duration_months,
  orders.max_active_devices,
  payment.provider_occurred_at AS period_start,
  activation.activation_key,
  decode(substr(activation.activation_commitment, 3), 'hex') AS activation_commitment
FROM _demo_orders AS orders
JOIN payment_transactions AS payment ON payment.fulfillment_order_id = orders.id
JOIN jsonb_to_recordset(current_setting('emukey.seed_activations')::jsonb)
  AS activation(i integer, activation_key text, activation_commitment text)
  ON activation.i = orders.i;

INSERT INTO licenses (
  id, public_license_id, origin_order_id, provider_user_id, customer_user_id,
  product_id, plan_id, plan_commitment, status, period_start,
  expires_at, max_active_devices, activation_commitment,
  activation_key_version, activation_key_last4, entitlement_version
)
SELECT
  id, 'EMU-DEMO-' || upper(substr(md5(id::text), 1, 20)), origin_order_id,
  provider_user_id, customer_user_id, product_id, plan_id,
  plan_commitment, 'PENDING_ONCHAIN', period_start,
  period_start + make_interval(months => duration_months),
  max_active_devices,
  activation_commitment,
  1, substr(md5(id::text), 1, 4), 1
FROM _demo_licenses
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_devices ON COMMIT DROP AS
SELECT
  license.i,
  md5(current_setting('emukey.seed_namespace') || ':device:' || license.i)::uuid AS id,
  license.id AS license_id
FROM _demo_licenses AS license;

INSERT INTO license_devices (
  id, license_id, device_ref, device_signer_address,
  status, binding_generation
)
SELECT
  id, license_id,
  encode(digest(current_setting('emukey.seed_namespace') || ':device-ref:' || id::text, 'sha256'), 'hex'),
  '0x' || substr(encode(digest(current_setting('emukey.seed_namespace') || ':device-key:' || id::text, 'sha256'), 'hex'), 1, 40),
  'PENDING_ONCHAIN', 1
FROM _demo_devices
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_commands ON COMMIT DROP AS
SELECT
  license.i,
  md5(current_setting('emukey.seed_namespace') || ':chain-command:' || license.i)::uuid AS id,
  license.id AS license_id,
  license.provider_user_id,
  license.origin_order_id,
  license.activation_commitment
FROM _demo_licenses AS license;

INSERT INTO chain_commands (
  id, idempotency_key, command_type, provider_user_id, order_id, license_id,
  license_command_sequence, network, chain_id, contract_address, payload,
  payload_hash, status, relayer_address, nonce, signed_transaction,
  transaction_hash, attempt_count
)
SELECT
  id,
  md5(current_setting('emukey.seed_namespace') || ':chain-idempotency:' || i)::uuid,
  'ISSUE_LICENSE', provider_user_id, origin_order_id, license_id,
  1, 'demo-local', 31337,
  '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':contract-a') || md5(current_setting('emukey.seed_namespace') || ':contract-b'), 1, 40),
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'licenseId', license_id),
  digest(current_setting('emukey.seed_namespace') || ':payload:' || i, 'sha256'),
  'PENDING',
  '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':relayer-a') || md5(current_setting('emukey.seed_namespace') || ':relayer-b'), 1, 40),
  i,
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':signed-transaction:' || i, 'sha256'), 'hex'),
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':transaction:' || i, 'sha256'), 'hex'),
  0
FROM _demo_commands AS command
WHERE NOT EXISTS (
  SELECT 1 FROM chain_commands AS existing WHERE existing.id = command.id
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO chain_indexer_checkpoints (
  network, chain_id, contract_address, next_block,
  last_scanned_block, last_scanned_block_hash
)
SELECT
  'demo-indexer-' || lpad(checkpoint.i::text, 2, '0'),
  31337 + checkpoint.i,
  '0x' || substr(
    md5(current_setting('emukey.seed_namespace') || ':checkpoint-contract-a:' || checkpoint.i) ||
    md5(current_setting('emukey.seed_namespace') || ':checkpoint-contract-b:' || checkpoint.i),
    1,
    40
  ),
  1200 + checkpoint.i,
  1199 + checkpoint.i,
  '0x' || encode(
    digest(current_setting('emukey.seed_namespace') || ':checkpoint-block:' || checkpoint.i, 'sha256'),
    'hex'
  )
FROM generate_series(1, ${CHECKPOINT_ROW_COUNT}) AS checkpoint(i)
ON CONFLICT (network, chain_id, contract_address) DO UPDATE SET
  next_block = EXCLUDED.next_block,
  last_scanned_block = EXCLUDED.last_scanned_block,
  last_scanned_block_hash = EXCLUDED.last_scanned_block_hash,
  locked_by = NULL,
  locked_at = NULL,
  updated_at = now();

CREATE TEMP TABLE _demo_events ON COMMIT DROP AS
SELECT
  command.i,
  md5(current_setting('emukey.seed_namespace') || ':chain-event:' || command.i)::uuid AS id,
  command.id AS chain_command_id,
  command.provider_user_id,
  command.license_id,
  command.activation_commitment
FROM _demo_commands AS command;

INSERT INTO chain_events (
  id, chain_command_id, event_type, provider_user_id, license_id, network,
  chain_id, contract_address, transaction_hash, log_index, block_number,
  block_hash, confirmation_count, finality_status, activation_commitment,
  activation_key_version, payload, observed_at
)
SELECT
  id, chain_command_id, 'LICENSE_ISSUED', provider_user_id, license_id,
  'demo-local', 31337,
  '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':contract-a') || md5(current_setting('emukey.seed_namespace') || ':contract-b'), 1, 40),
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':transaction:' || i, 'sha256'), 'hex'),
  0, 1000 + i,
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':block:' || i, 'sha256'), 'hex'),
  0, 'PENDING', activation_commitment, 1,
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'licenseId', license_id),
  statement_timestamp()
FROM _demo_events AS event
WHERE NOT EXISTS (
  SELECT 1 FROM chain_events AS existing WHERE existing.id = event.id
)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_documents ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':knowledge-document:' || product.i)::uuid AS id,
  product.id AS product_id,
  provider.id AS provider_user_id,
  product.name AS product_name
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index
WHERE product.status = 'PUBLISHED';

INSERT INTO knowledge_documents (
  id, provider_user_id, product_id, logical_document_key, version,
  source_type, title, storage_key, storage_mime_type, storage_size_bytes,
  checksum, status, is_current
)
SELECT
  id, provider_user_id, product_id,
  'demo-guide-' || lpad(i::text, 2, '0'), 1, 'TXT',
  'Hướng dẫn sử dụng ' || product_name,
  'demo/knowledge/' || id || '.txt', 'text/plain', 2048 + i,
  digest(current_setting('emukey.seed_namespace') || ':document:' || i, 'sha256'),
  'READY', true
FROM _demo_documents
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_chunks (
  id, document_id, chunk_index, content, token_count, source_metadata
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':knowledge-chunk:' || i)::uuid,
  id, 0,
  'Nội dung minh họa cho ' || product_name || ': cài đặt, kích hoạt và quản lý license.',
  24,
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'page', 1)
FROM _demo_documents
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_conversations ON COMMIT DROP AS
SELECT
  series.i,
  md5(current_setting('emukey.seed_namespace') || ':conversation:' || series.i)::uuid AS id,
  customer.id AS customer_user_id
FROM generate_series(1, ${BUSINESS_ROW_COUNT}) AS series(i)
JOIN _demo_customers AS customer ON customer.i = ((series.i - 1) % ${CUSTOMER_COUNT}) + 1;

INSERT INTO conversations (
  id, customer_user_id, status, version, title, context_type, last_message_at
)
SELECT
  id, customer_user_id, 'AI_ACTIVE', 1,
  'Trao đổi minh họa ' || lpad(i::text, 2, '0'), 'GENERAL', now() - make_interval(hours => i)
FROM _demo_conversations
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (
  id, conversation_id, sender_user_id, sender_type, client_message_id,
  server_sequence, content, sources
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':message:' || i)::uuid,
  id, customer_user_id, 'CUSTOMER',
  md5(current_setting('emukey.seed_namespace') || ':client-message:' || i)::uuid,
  1, 'Tôi cần hướng dẫn kích hoạt sản phẩm minh họa số ' || i || '.',
  jsonb_build_array(jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace')))
FROM _demo_conversations
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (
  id, user_id, event_key, type, title, content, data, channel,
  delivery_status, attempt_count, is_read, sent_at
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':notification:' || i)::uuid,
  id, 'demo-notification-' || lpad(i::text, 2, '0'), 'LICENSE_ACTIVE',
  'License đã sẵn sàng', 'License minh họa của bạn đã được kích hoạt.',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'index', i),
  'IN_APP', 'SENT', 1, i % 3 = 0, now() - make_interval(hours => i)
FROM (
  SELECT row_number() OVER (ORDER BY id)::int AS i, id
  FROM _demo_users
) AS demo_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO mobile_push_tokens (
  id, user_id, token, provider, status, last_seen_at
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':push-token:' || i)::uuid,
  id, 'demo-push-' || encode(digest(current_setting('emukey.seed_namespace') || ':push:' || i, 'sha256'), 'hex'),
  'EXPO', 'ACTIVE', now() - make_interval(hours => i)
FROM (
  SELECT row_number() OVER (ORDER BY id)::int AS i, id
  FROM _demo_users
) AS demo_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (
  actor_user_id, actor_role, action, target_type,
  target_id, outcome, metadata
)
SELECT
  customer.id, 'CUSTOMER', 'DEMO_DATA_CREATED', 'ORDER',
  md5(current_setting('emukey.seed_namespace') || ':order:' || demo_row.i)::uuid, 'SUCCESS',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'index', demo_row.i)
FROM generate_series(1, ${BUSINESS_ROW_COUNT}) AS demo_row(i)
JOIN _demo_customers AS customer ON customer.i = ((demo_row.i - 1) % ${CUSTOMER_COUNT}) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs AS audit
  WHERE audit.metadata ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
    AND audit.metadata ->> 'index' = demo_row.i::text
);
`;

const COUNT_SQL = String.raw`
SELECT table_name, row_count::int
FROM (
  SELECT 'users' AS table_name, count(*) AS row_count
  FROM users AS row JOIN _demo_users AS seed ON seed.id = row.id
  UNION ALL SELECT 'products', count(*)
  FROM products AS row JOIN _demo_products AS seed ON seed.id = row.id
  UNION ALL SELECT 'plans', count(*)
  FROM plans AS row JOIN _demo_plans AS seed ON seed.id = row.id
  UNION ALL SELECT 'orders', count(*)
  FROM orders AS row JOIN _demo_orders AS seed ON seed.id = row.id
  UNION ALL SELECT 'payment_attempts', count(*)
  FROM payment_attempts AS row JOIN _demo_attempts AS seed ON seed.id = row.id
  UNION ALL SELECT 'payment_transactions', count(*)
  FROM payment_transactions AS row JOIN _demo_attempts AS seed ON seed.id = row.payment_attempt_id
  UNION ALL SELECT 'licenses', count(*)
  FROM licenses AS row JOIN _demo_licenses AS seed ON seed.id = row.id
  UNION ALL SELECT 'license_devices', count(*)
  FROM license_devices AS row JOIN _demo_devices AS seed ON seed.id = row.id
  UNION ALL SELECT 'chain_commands', count(*)
  FROM chain_commands AS row JOIN _demo_commands AS seed ON seed.id = row.id
  UNION ALL SELECT 'chain_indexer_checkpoints', count(*)
  FROM chain_indexer_checkpoints WHERE network LIKE 'demo-indexer-%'
  UNION ALL SELECT 'chain_events', count(*)
  FROM chain_events AS row JOIN _demo_events AS seed ON seed.id = row.id
  UNION ALL SELECT 'knowledge_documents', count(*)
  FROM knowledge_documents AS row JOIN _demo_documents AS seed ON seed.id = row.id
  UNION ALL SELECT 'knowledge_chunks', count(*)
  FROM knowledge_chunks AS row JOIN _demo_documents AS seed ON seed.id = row.document_id
  UNION ALL SELECT 'conversations', count(*)
  FROM conversations AS row JOIN _demo_conversations AS seed ON seed.id = row.id
  UNION ALL SELECT 'messages', count(*)
  FROM messages AS row JOIN _demo_conversations AS seed ON seed.id = row.conversation_id
  UNION ALL SELECT 'notifications', count(*)
  FROM notifications AS row
  JOIN generate_series(1, ${BUSINESS_ROW_COUNT}) AS seed(i)
    ON row.id = md5(current_setting('emukey.seed_namespace') || ':notification:' || seed.i)::uuid
  UNION ALL SELECT 'mobile_push_tokens', count(*)
  FROM mobile_push_tokens AS row
  JOIN generate_series(1, ${BUSINESS_ROW_COUNT}) AS seed(i)
    ON row.id = md5(current_setting('emukey.seed_namespace') || ':push-token:' || seed.i)::uuid
  UNION ALL SELECT 'audit_logs', count(*)
  FROM audit_logs AS row JOIN _demo_orders AS seed ON seed.id = row.target_id
  WHERE row.metadata ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
) AS counts
ORDER BY table_name;
`;

function usage() {
  console.log(`Usage:
  node --env-file-if-exists=backend/.env seed-demo-data.mjs --yes
  node seed-demo-data.mjs --validate-only

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
    if (Number(target?.tables) !== 18 || target?.has_image_url !== true) {
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
                 set_config('emukey.seed_products', $4, true)`,
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
