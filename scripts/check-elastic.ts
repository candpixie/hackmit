/**
 * Verifies the Elasticsearch connection end to end: reachable, authorised,
 * can create the index, can write, can read back.
 *
 *   pnpm check-elastic
 */

const URL_ = process.env.ELASTIC_URL;
const KEY = process.env.ELASTIC_API_KEY;

const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const bad = (s: string) => console.log(`  \x1b[31m✗\x1b[0m ${s}`);

if (!URL_ || !KEY) {
  bad("ELASTIC_URL or ELASTIC_API_KEY missing from the environment.");
  console.log("\n  Add both to .env.local, then run: pnpm check-elastic\n");
  process.exit(1);
}

const base = URL_.replace(/\/$/, "");

async function es(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `ApiKey ${KEY}`,
      ...init?.headers,
    },
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

console.log(`\n  ${base}\n`);

try {
  const root = await es("/");
  if (root.status === 401 || root.status === 403) {
    bad(`Authentication rejected (${root.status}). The key is wrong, or it is not an "ApiKey" style key.`);
    process.exit(1);
  }
  if (root.status >= 400) {
    bad(`Cluster returned ${root.status}: ${root.body.slice(0, 200)}`);
    process.exit(1);
  }
  const info = JSON.parse(root.body);
  ok(`reachable and authorised${info.version?.number ? ` (v${info.version.number})` : ""}`);
} catch (e) {
  bad(`Cannot reach it: ${e instanceof Error ? e.message : e}`);
  console.log("\n  Check the URL. It should have no port and no trailing path.\n");
  process.exit(1);
}

const INDEX = "overdue-preflight";
await es(`/${INDEX}`, { method: "DELETE" });

const created = await es(`/${INDEX}`, {
  method: "PUT",
  body: JSON.stringify({ mappings: { properties: { text: { type: "text" } } } }),
});
if (created.status >= 400) {
  bad(`Cannot create an index (${created.status}). The key may be read-only.`);
  console.log(`  ${created.body.slice(0, 250)}\n`);
  process.exit(1);
}
ok("can create an index");

const wrote = await es(`/${INDEX}/_doc/1?refresh=true`, {
  method: "POST",
  body: JSON.stringify({ text: "we should finally do that ceramics class" }),
});
if (wrote.status >= 400) {
  bad(`Cannot write (${wrote.status}): ${wrote.body.slice(0, 200)}`);
  process.exit(1);
}
ok("can write");

const found = await es(`/${INDEX}/_search`, {
  method: "POST",
  body: JSON.stringify({ query: { match: { text: "ceramics" } } }),
});
const hits = JSON.parse(found.body).hits?.hits?.length ?? 0;
if (hits !== 1) {
  bad(`Search returned ${hits} hits, expected 1.`);
  process.exit(1);
}
ok("can search");

await es(`/${INDEX}`, { method: "DELETE" });
ok("cleaned up");

console.log("\n  \x1b[32mElasticsearch is good.\x1b[0m Restart the dev server and the planner will use it.\n");
