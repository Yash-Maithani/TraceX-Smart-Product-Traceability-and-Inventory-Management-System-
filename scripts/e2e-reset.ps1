param(
    [string]$DatabaseName = "tracex_fresh_e2e",
    [string]$MongoUri = "mongodb://localhost:27017"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseName) -or -not $DatabaseName.EndsWith("_e2e")) {
    Write-Error "SAFETY GUARD ABORTED: Refusing to touch database '$DatabaseName'. Only databases whose name ends in '_e2e' may be reset by e2e-reset.ps1."
    exit 1
}

$fullUri = "$MongoUri/$DatabaseName"
Write-Host "Resetting E2E database '$DatabaseName' at $fullUri ..."

$mongoshCmd = Get-Command mongosh -ErrorAction SilentlyContinue
if ($null -ne $mongoshCmd) {
    & mongosh $fullUri --quiet --eval "if (!db.getName().endsWith('_e2e')) { throw new Error('Safety guard: database does not end with _e2e'); } db.dropDatabase();"
    if ($LASTEXITCODE -ne 0) {
        throw "mongosh failed to drop database '$DatabaseName' (exit code $LASTEXITCODE)."
    }
} else {
    $nodeScript = @'
const net = require("node:net");
const dbName = process.argv[2];
if (!dbName || !dbName.endsWith("_e2e")) {
  console.error("Safety guard: database name must end with _e2e");
  process.exit(1);
}
const cstr = (s) => Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]);
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n, 0); return b; };
const dbBuf = Buffer.from(dbName, "utf8");
const elems = Buffer.concat([
  Buffer.from([0x10]), cstr("dropDatabase"), i32(1),
  Buffer.from([0x02]), cstr("$db"), i32(dbBuf.length + 1), dbBuf, Buffer.from([0])
]);
const bson = Buffer.concat([i32(4 + elems.length + 1), elems, Buffer.from([0])]);
const totalLen = 16 + 4 + 1 + bson.length;
const msg = Buffer.concat([i32(totalLen), i32(1), i32(0), i32(2013), i32(0), Buffer.from([0]), bson]);
const sock = net.createConnection({ host: "127.0.0.1", port: 27017 }, () => {
  sock.write(msg);
});
sock.once("data", (chunk) => {
  sock.end();
  if (chunk.length >= 20) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
sock.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
  process.exit(1);
});
'@
    $nodeScript | node - $DatabaseName
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to drop database '$DatabaseName' via MongoDB wire protocol."
    }
}

Write-Host "Successfully dropped E2E database '$DatabaseName'."
