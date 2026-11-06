import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '../../../..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const runId = argument('--run-id', '2026-11-06-web');
if (!/^[\w-]+$/.test(runId)) throw new Error('Invalid audit run ID');
const artifacts = path.join(workspace, 'artifacts/ui-audit', runId);
const documents = path.join(workspace, 'docs/ui-audit');
const optionalJson = async (filename) => {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
const manifests = await Promise.all((await readdir(artifacts))
  .filter((filename) => /^manifest-(before|after).*\.json$/.test(filename))
  .map(async (filename) => ({ filename, ...JSON.parse(await readFile(path.join(artifacts, filename), 'utf8')) })));
const captureRun = argument('--capture-run', '2026-11-06-web-final');
if (!/^[\w-]+$/.test(captureRun)) throw new Error('Invalid capture run ID');
const finalCapture = await optionalJson(path.join(workspace, 'artifacts/ui-audit', captureRun, 'manifest-after.json'));
const correctionRun = '2026-11-06-web-correction';
const correctionCapture = await optionalJson(path.join(workspace, 'artifacts/ui-audit', correctionRun, 'manifest-after.json'));
const current = [...manifests.filter((manifest) => manifest.phase === 'after').flatMap((manifest) => manifest.records), ...(finalCapture?.records ?? []), ...(correctionCapture?.records ?? [])]
  .sort((left, right) => (left.capturedAt ?? '').localeCompare(right.capturedAt ?? ''));
const key = (record) => [record.role, record.routePattern, record.state, record.viewport].join('|');
const records = [...new Map(current.map((record) => [key(record), { ...record, id: key(record), surface: 'WEB' }])).values()];
const issues = (await optionalJson(path.join(documents, 'issues.json')))?.issues ?? [];
const uiTests = await optionalJson(path.join(artifacts, 'ui-regression-results.json'));
const flowTests = await optionalJson(path.join(artifacts, 'flow-results.json'));
const systemRecheck = await optionalJson(path.join(artifacts, 'system-recheck-results.json'));
const flowSuites = [...new Map([...(flowTests?.suites ?? []), ...(systemRecheck?.suites ?? [])].map((suite) => [suite.file, suite])).values()];
const flowCases = (suite) => [...(suite.specs ?? []).flatMap((spec) => spec.tests), ...(suite.suites ?? []).flatMap(flowCases)];
const flowResults = flowSuites.flatMap(flowCases);
const flowSummary = flowTests ? {
  passed: flowResults.filter((test) => test.status === 'expected').length,
  failed: flowResults.filter((test) => ['unexpected', 'flaky'].includes(test.status)).length,
  skipped: flowResults.filter((test) => test.status === 'skipped').length,
} : null;
const unitTests = await optionalJson(path.join(artifacts, 'unit-results.json'));
const focusedUnitTests = await optionalJson(path.join(artifacts, 'focused-unit-results.json'));
const internalUnitRecheck = await optionalJson(path.join(artifacts, 'internal-unit-recheck-results.json'));
const focusedSuites = [...new Map([...(focusedUnitTests?.testResults ?? []), ...(internalUnitRecheck?.testResults ?? [])].map((suite) => [suite.name, suite])).values()];
const focusedCases = focusedSuites.flatMap((suite) => suite.assertionResults);
const focusedSummary = focusedUnitTests ? {
  passed: focusedCases.filter((test) => test.status === 'passed').length,
  failed: focusedCases.filter((test) => test.status === 'failed').length,
  skipped: focusedCases.filter((test) => ['pending', 'skipped', 'todo'].includes(test.status)).length,
} : null;
const boundary = await optionalJson(path.join(artifacts, 'boundary-results.json'));
const session = await optionalJson(path.join(artifacts, 'session-results.json'));
const motion = await optionalJson(path.join(artifacts, 'motion-results.json'));
const checks = await optionalJson(path.join(artifacts, 'checks.json'));
const a11yRuns = argument('--a11y-run', `2026-11-06-a11y-final,2026-11-06-a11y-correction,${captureRun},${correctionRun}`).split(',');
if (a11yRuns.some((id) => !/^[\w-]+$/.test(id))) throw new Error('Invalid accessibility run ID');
const accessibility = await Promise.all(a11yRuns.map((id) => optionalJson(path.join(workspace, 'artifacts/ui-audit', id, 'manifest-after.json'))));
// A targeted recheck replaces only the exact role/route/state/viewport it ran.
// Other records retain their original result; no extrapolation across screens.
const a11yRecords = [...new Map(accessibility.flatMap((manifest) => manifest?.records ?? [])
  .filter((record) => record.status === 'CAPTURED' && record.accessibility)
  .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
  .map((record) => [key(record), record])).values()];
const stats = {
  routePatterns: new Set([...manifests, finalCapture].filter(Boolean).flatMap((manifest) => manifest.inventory?.map((route) => route.routePattern) ?? [])).size,
  roles: [...new Set(records.map((record) => record.role))],
  captured: records.filter((record) => record.status === 'CAPTURED').length,
  blocked: records.filter((record) => record.status === 'BLOCKED').length,
  states: Object.fromEntries([...new Set(records.map((record) => record.state))].map((state) => [state, records.filter((record) => record.state === state && record.status === 'CAPTURED').length])),
  issues: Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map((severity) => [severity, issues.filter((issue) => issue.severity === severity).length])),
  verifiedIssues: issues.filter((issue) => issue.status === 'VERIFIED').length,
  a11yCases: a11yRecords.length,
  a11yViolationGroups: a11yRecords.reduce((sum, record) => sum + record.accessibility.violations.length, 0),
  a11yIncompleteGroups: a11yRecords.reduce((sum, record) => sum + record.accessibility.incomplete.length, 0),
};
await mkdir(documents, { recursive: true });
await writeFile(path.join(documents, 'coverage.json'), `${JSON.stringify({
  runId, generatedAt: new Date().toISOString(), status: 'PARTIALLY_VERIFIED', stats,
  scope: { web: 'UI_VERIFICATION_WITH_LIMITS', native: 'DEFERRED_BY_USER', kotlinDemo: 'OUT_OF_SCOPE' },
  // A screenshot is evidence of capture only. Review/functional verification
  // are recorded separately and must never be inferred from file existence.
  note: 'CAPTURED không đồng nghĩa đã audit hoặc đã nghiệm thu toàn bộ trạng thái tương tác.',
  records,
}, null, 2)}\n`, 'utf8');

const testLine = (label, summary) => summary
  ? `- ${label}: ${summary.passed} đạt, ${summary.failed} lỗi, ${summary.skipped} bỏ qua.`
  : `- ${label}: chưa có báo cáo hoàn chỉnh của lượt chạy.`;
const report = `# Báo cáo UI/UX EmuKey — ${runId}

Tình trạng: đã triển khai các bản sửa UI web, kiểm chứng theo bằng chứng bên dưới; chưa nghiệm thu toàn bộ kế hoạch vì luồng tích hợp mới và kiểm tra thủ công còn thiếu. Native đã hoãn theo lựa chọn của người dùng; Kotlin demo ngoài phạm vi. Báo cáo sinh từ manifest/issues/test JSON, không dùng tỷ lệ hoàn thành ước lượng.

## Phạm vi và bằng chứng

- ${stats.routePatterns} route pattern/view được phát hiện từ source; ${stats.roles.length} ngữ cảnh: ${stats.roles.join(', ')}.
- ${stats.captured} tổ hợp role/route/state/viewport đã chụp sau sửa; ${stats.blocked} tổ hợp đang bị chặn trong manifest.
- Theo trạng thái: ${Object.entries(stats.states).map(([state, count]) => `${state}: ${count}`).join('; ')}.
- Bộ before/after: [manifest trước](../../artifacts/ui-audit/${runId}/manifest-before.json), [manifest sau ban đầu](../../artifacts/ui-audit/${runId}/manifest-after.json), [capture toàn route](../../artifacts/ui-audit/${captureRun}/manifest-after.json), [kiểm tra lại sau sửa cuối](../../artifacts/ui-audit/${correctionRun}/manifest-after.json). Capture sau cùng chỉ thay đúng tổ hợp trùng.
- API thật và CONTROLLED_FIXTURE được ghi riêng trong từng record. Chụp được màn hình không tự chứng minh thao tác hoặc tích hợp bên ngoài thành công.
- Ảnh và JSON kết quả gốc ở artifacts/ui-audit được giữ local và ignore khỏi Git. Kho Git lưu source, test, báo cáo và coverage đã tổng hợp; bản clone mới cần tái chạy để tạo lại các artifact được liên kết.

## Vấn đề và thay đổi

- Số issue theo mức: ${Object.entries(stats.issues).map(([severity, count]) => `${severity}: ${count}`).join('; ')}.
- Đã nghiệm thu theo issue: ${stats.verifiedIssues}/${issues.length}.

${issues.map((issue) => `- **${issue.id} — ${issue.title}** (${issue.status}): ${issue.fix}`).join('\n')}

Chi tiết file, nguyên nhân và bằng chứng: [issues.md](issues.md), [issues.json](issues.json).

## Kiểm thử

${testLine('Browser regression UI', uiTests ? { passed: uiTests.stats.expected, failed: uiTests.stats.unexpected, skipped: uiTests.stats.skipped } : null)}
${testLine('Browser luồng nghiệp vụ (CONTROLLED_FIXTURE)', flowSummary)}
${systemRecheck ? '- Kết quả system-admin chạy lại thay toàn bộ suite system-admin của lượt đầu; không cộng trùng ca. Lượt đầu: 105 đạt/7 lỗi fixture; giữ nguyên báo cáo gốc để truy vết.' : ''}
${testLine('Frontend unit', unitTests ? { passed: unitTests.numPassedTests, failed: unitTests.numFailedTests, skipped: unitTests.numPendingTests } : null)}
${testLine('Frontend unit tập trung sau thay đổi cuối (các ca trùng bộ đầy đủ)', focusedSummary)}
${focusedUnitTests?.numFailedTests ? `- Lượt unit tập trung đầu: ${focusedUnitTests.numPassedTests} đạt/${focusedUnitTests.numFailedTests} lỗi; hai ca đạt khi chạy riêng (10,7s và 7,2s). ${internalUnitRecheck ? 'Đã chạy lại cả file internal-consoles; kết quả mới chỉ thay file tương ứng, báo cáo thất bại gốc được giữ.' : 'Lượt chạy lại toàn file internal-consoles chưa có báo cáo hoàn chỉnh.'}` : ''}
${testLine('Boundary API thật', boundary ? { passed: boundary.records.filter((record) => record.passed).length, failed: boundary.records.filter((record) => !record.passed).length, skipped: 0 } : null)}
${testLine('Browser phiên thật sau reload', session ? { passed: session.records.filter((record) => record.passed).length, failed: session.records.filter((record) => !record.passed).length, skipped: 0 } : null)}
${motion ? `- Carousel tại 320×800, reduced motion và phím Home/End: ${motion.passed ? 'đạt' : 'lỗi'}; tràn toàn trang: ${motion.overflow}; transition track/dot: ${motion.trackTransition}/${motion.dotTransition}.` : ''}
- Axe: ${stats.a11yCases} trường hợp phân biệt đã chạy; ${stats.a11yViolationGroups} nhóm vi phạm; ${stats.a11yIncompleteGroups} nhóm cần kiểm tra thủ công. Kết quả mới thay đúng tổ hợp trùng, không nhân số lượng ca. Nguồn: ${a11yRuns.map((id) => `[${id}](../../artifacts/ui-audit/${id}/manifest-after.json)`).join(', ')}.

${checks?.records.map((check) => `- \`${check.command}\`: exit ${check.exitCode}${check.note ? `; ${check.note}` : ''}.`).join('\n') ?? '- Chưa có checks.json cho build/lint/typecheck.'}

Kết quả build/lint/typecheck và các lệnh kiểm thử mở rộng được ghi trong progress.md cùng mã thoát thực tế. Các timeout của lượt chạy trước được giữ như giới hạn kiểm chứng, không tự chuyển thành PASS.

## Phần cần đối soát

- Các luồng được kiểm chứng và giới hạn từng nhóm nằm trong [interaction-coverage.md](interaction-coverage.md); không suy ra tương tác từ ảnh normal.
- Screen reader và các mục axe incomplete cần kiểm tra thủ công; không tuyên bố chứng nhận WCAG từ kết quả tự động.
- Luồng SePay/worker/blockchain/provider receiver mới chưa tự động được tính đã nghiệm thu chỉ từ test API giả lập hoặc bằng chứng lịch sử.
- Native hoãn theo người dùng; build đang thử đã dừng, không báo là UI Android đã kiểm chứng.

## Tái chạy

\`node tooling/emukey/verification/frontend-scripts/visual-regression.mjs --audit --run-id ${runId} --phase after\`

Credential file chỉ cấp qua biến AUDIT_ACCOUNTS trỏ tới OS temp. Thêm --state empty/error/loading cho trạng thái có kiểm soát, --resume để tiếp tục ảnh đã chụp hợp lệ; AUDIT_AXE_SCRIPT là đường dẫn axe-core local. Không đưa token hoặc mật khẩu vào CLI, tài liệu hoặc Git.

\`node tooling/emukey/verification/frontend-scripts/ui-audit-report.mjs --run-id ${runId} --a11y-run ${a11yRuns.join(',')}\`
`;
await writeFile(path.join(documents, 'final-report.md'), report, 'utf8');
console.log(JSON.stringify(stats, null, 2));
