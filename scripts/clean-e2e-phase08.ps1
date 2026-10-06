param(
    [string]$DatabaseName = "tracex_fresh_e2e",
    [string]$MongoUri = "mongodb://localhost:27017"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseName) -or (-not $DatabaseName.EndsWith("_e2e"))) {
    Write-Error "SAFETY GUARD ABORTED: Refusing to touch database '$DatabaseName'. Only databases whose name ends in '_e2e' are allowed."
    exit 1
}

$m2 = "$env:USERPROFILE\.m2\repository"
$cp = @(
    "$m2\org\mongodb\mongodb-driver-sync\4.11.2\mongodb-driver-sync-4.11.2.jar",
    "$m2\org\mongodb\mongodb-driver-core\4.11.2\mongodb-driver-core-4.11.2.jar",
    "$m2\org\mongodb\bson\4.11.2\bson-4.11.2.jar",
    "$m2\org\slf4j\slf4j-api\2.0.13\slf4j-api-2.0.13.jar",
    "$m2\org\slf4j\slf4j-nop\2.0.13\slf4j-nop-2.0.13.jar"
) -join ";"

$tmpJava = Join-Path $env:TEMP "CleanE2ePhase08_$([guid]::NewGuid().ToString('N')).java"

$javaCode = @'
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import org.bson.Document;

public class CleanE2ePhase08 {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: CleanE2ePhase08 <mongoUri> <dbName>");
            System.exit(1);
        }
        String uri = args[0];
        String dbName = args[1];
        if (!dbName.endsWith("_e2e")) {
            System.err.println("SAFETY GUARD ABORTED: Database '" + dbName + "' does not end with _e2e.");
            System.exit(1);
        }
        try (MongoClient client = MongoClients.create(uri)) {
            MongoDatabase db = client.getDatabase(dbName);
            MongoCollection<Document> batches = db.getCollection("batches");
            MongoCollection<Document> importjobs = db.getCollection("importjobs");
            MongoCollection<Document> counters = db.getCollection("counters");

            Document p8BatchQuery = new Document("sourceLotCode", new Document("$regex", "^E2E-P8-"));
            DeleteResult batchDel = batches.deleteMany(p8BatchQuery);

            Document p8JobQuery = new Document("fileName", new Document("$regex", "^e2e-phase08-"));
            DeleteResult jobDel = importjobs.deleteMany(p8JobQuery);

            counters.updateMany(
                new Document("_id", new Document("$regex", "^batch_TX-")),
                new Document("$set", new Document("seq", 12L))
            );

            long remainingBatches = batches.countDocuments();
            System.out.println("CLEAN_E2E_P8 [" + dbName + "]: deletedBatches=" + batchDel.getDeletedCount()
                + ", deletedImportJobs=" + jobDel.getDeletedCount()
                + ", remainingBatches=" + remainingBatches);
        }
    }
}
'@

[System.IO.File]::WriteAllText($tmpJava, $javaCode, [System.Text.Encoding]::ASCII)
try {
    & java -cp $cp $tmpJava $MongoUri $DatabaseName
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    if (Test-Path $tmpJava) {
        Remove-Item $tmpJava -Force
    }
}
