import { appendFileSync } from "node:fs";
import { relative } from "node:path";

// Custom node:test reporter that ends the run with a readable summary. The default TAP output
// reports counts but scatters the failures through thousands of lines, which is unusable in CI.

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// Parent tests fail only because a child did; reporting them repeats the same failure.
const isAggregate = (error) => error?.failureType === "subtestsFailed" || /^\d+ subtests? failed$/.test(error?.message ?? "");

// CoreKitError stringifies an absent code as a leading "undefined", which buries the real text.
const firstLine = (text) =>
  String(text ?? "")
    .split("\n")[0]
    .replace(/^undefined\s*/, "")
    .trim();

// A rejected fetch surfaces as a Response, which has no message at all.
const responseMessage = (error) =>
  typeof error?.status === "number" && error?.url ? `HTTP ${error.status} ${error.statusText ?? ""}`.trim() + ` — ${error.url}` : "";

const errorMessage = (error) => {
  if (!error) return "unknown error";
  return (
    firstLine(error.message) ||
    responseMessage(error) ||
    firstLine(error.cause?.message) ||
    responseMessage(error.cause) ||
    firstLine(error.code && `error code ${error.code}`) ||
    "unknown error (see log above)"
  );
};

const formatDuration = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

export default async function* summaryReporter(source) {
  const failures = [];
  const counts = { pass: 0, fail: 0, skipped: 0, todo: 0 };
  const startedAt = Date.now();
  let duration = 0;

  // Files run concurrently, so each needs its own stack of enclosing test names.
  const openNames = new Map();
  const pathFor = (data) => {
    const stack = openNames.get(data.file) ?? [];
    return [...stack.slice(0, data.nesting), data.name].filter(Boolean).join(" › ");
  };

  for await (const event of source) {
    const { type, data } = event;

    if (type === "test:start") {
      const stack = openNames.get(data.file) ?? [];
      stack.length = data.nesting;
      stack[data.nesting] = data.name;
      openNames.set(data.file, stack);
    } else if (type === "test:pass") {
      // describe() suites are not tests; the run summary counts them separately.
      if (data.details?.type === "suite") continue;
      if (data.skip) counts.skipped += 1;
      else if (data.todo) counts.todo += 1;
      else counts.pass += 1;
    } else if (type === "test:fail") {
      const error = data.details?.error;
      if (data.details?.type !== "suite") {
        if (data.todo) counts.todo += 1;
        else counts.fail += 1;
      }
      if (!data.todo && !isAggregate(error)) {
        failures.push({
          name: pathFor(data),
          file: data.file ? relative(process.cwd(), data.file) : "",
          line: data.line,
          message: errorMessage(error),
        });
      }
    } else if (type === "test:summary" && data.file === undefined) {
      // The run-level summary arrives last, without a file. Node 20 never emits it.
      counts.pass = data.counts?.passed ?? counts.pass;
      counts.fail = data.counts?.failed ?? counts.fail;
      counts.skipped = data.counts?.skipped ?? counts.skipped;
      counts.todo = data.counts?.todo ?? counts.todo;
      duration = data.duration_ms ?? duration;
    }
  }

  if (!duration) duration = Date.now() - startedAt;
  const total = counts.pass + counts.fail + counts.skipped + counts.todo;
  const bar = "─".repeat(60);
  const out = [];

  out.push(`\n${bar}\n${BOLD}Test summary${RESET}\n${bar}\n`);
  out.push(`  Total     ${total}\n`);
  out.push(`  ${GREEN}Passed    ${counts.pass}${RESET}\n`);
  out.push(`  ${counts.fail > 0 ? RED : DIM}Failed    ${counts.fail}${RESET}\n`);
  if (counts.skipped) out.push(`  ${YELLOW}Skipped   ${counts.skipped}${RESET}\n`);
  if (counts.todo) out.push(`  ${YELLOW}Todo      ${counts.todo}${RESET}\n`);
  if (duration) out.push(`  ${DIM}Duration  ${formatDuration(duration)}${RESET}\n`);

  if (failures.length > 0) {
    const rolledUp = counts.fail - failures.length;
    const note = rolledUp > 0 ? ` ${DIM}(+${rolledUp} parent suite${rolledUp === 1 ? "" : "s"} reporting the same failures)${RESET}` : "";
    out.push(`\n${RED}${BOLD}Failed tests (${failures.length})${RESET}${note}\n\n`);
    for (const failure of failures) {
      const where = failure.file ? `${failure.file}${failure.line ? `:${failure.line}` : ""}` : "";
      out.push(`  ${RED}✖${RESET} ${failure.name}\n`);
      if (where) out.push(`    ${DIM}${where}${RESET}\n`);
      out.push(`    ${failure.message}\n\n`);
    }
  } else if (counts.fail === 0) {
    out.push(`\n${GREEN}All tests passed.${RESET}\n`);
  }

  out.push(`${bar}\n`);
  yield out.join("");

  writeGitHubStepSummary(counts, total, duration, failures);
}

// GitHub renders this on the workflow run page, so a failure is visible without opening the log.
function writeGitHubStepSummary(counts, total, duration, failures) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;

  const lines = [
    `## ${counts.fail > 0 ? "❌" : "✅"} Tests: ${counts.pass}/${total} passed`,
    "",
    "| Result | Count |",
    "| --- | --- |",
    `| ✅ Passed | ${counts.pass} |`,
    `| ❌ Failed | ${counts.fail} |`,
  ];
  if (counts.skipped) lines.push(`| ⏭️ Skipped | ${counts.skipped} |`);
  if (counts.todo) lines.push(`| 📝 Todo | ${counts.todo} |`);
  if (duration) lines.push(`| ⏱️ Duration | ${formatDuration(duration)} |`);

  if (failures.length > 0) {
    lines.push("", `### Failed tests (${failures.length})`, "");
    for (const failure of failures) {
      const where = failure.file ? ` — \`${failure.file}${failure.line ? `:${failure.line}` : ""}\`` : "";
      lines.push(`- **${failure.name}**${where}`, `  - ${failure.message}`);
    }
  }
  lines.push("");

  try {
    appendFileSync(target, lines.join("\n"));
  } catch {
    // A summary that cannot be written must never fail the run.
  }
}
