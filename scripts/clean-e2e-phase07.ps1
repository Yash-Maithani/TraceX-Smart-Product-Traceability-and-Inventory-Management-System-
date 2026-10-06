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

$tmpJava = Join-Path $env:TEMP "CleanE2ePhase07_$([guid]::NewGuid().ToString('N')).java"

$javaCode = @'
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import org.bson.Document;
import org.bson.types.ObjectId;
import java.util.ArrayList;
import java.util.List;

public class CleanE2ePhase07 {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: CleanE2ePhase07 <mongoUri> <dbName>");
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
            MongoCollection<Document> inspections = db.getCollection("inspections");
            MongoCollection<Document> scanevents = db.getCollection("scanevents");
            MongoCollection<Document> counters = db.getCollection("counters");

            Document p7Query = new Document("sourceLotCode", new Document("$regex", "^E2E-P7-"));
            List<Document> p7Batches = batches.find(p7Query).into(new ArrayList<>());
            List<String> batchIds = new ArrayList<>();
            for (Document b : p7Batches) {
                Object idObj = b.get("_id");
                if (idObj instanceof ObjectId) {
                    batchIds.add(((ObjectId) idObj).toHexString());
                } else if (idObj != null) {
                    batchIds.add(idObj.toString());
                }
            }

            long deletedInspections = 0;
            long deletedScans = 0;
            if (!batchIds.isEmpty()) {
                DeleteResult inspDel = inspections.deleteMany(new Document("batchId", new Document("$in", batchIds)));
                deletedInspections = inspDel.getDeletedCount();
                DeleteResult scanDel = scanevents.deleteMany(new Document("batchId", new Document("$in", batchIds)));
                deletedScans = scanDel.getDeletedCount();
            }

            DeleteResult batchDel = batches.deleteMany(p7Query);
            counters.updateMany(
                new Document("_id", new Document("$regex", "^batch_TX-")),
                new Document("$set", new Document("seq", 12L))
            );

            long remainingBatches = batches.countDocuments();
            System.out.println("CLEAN_E2E_P7 [" + dbName + "]: deletedBatches=" + batchDel.getDeletedCount()
                + ", deletedInspections=" + deletedInspections + ", deletedScans=" + deletedScans
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
