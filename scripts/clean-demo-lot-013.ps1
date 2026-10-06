param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseName,
    [string]$MongoUri = "mongodb://localhost:27017"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseName) -or (-not $DatabaseName.EndsWith("_dev") -and -not $DatabaseName.EndsWith("_e2e"))) {
    Write-Error "SAFETY GUARD ABORTED: Refusing to touch database '$DatabaseName'. Only databases whose name ends in '_dev' or '_e2e' are allowed."
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

$tmpJava = Join-Path $env:TEMP "CleanDemoLot013_$([guid]::NewGuid().ToString('N')).java"

$javaCode = @'
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import org.bson.Document;
import java.util.ArrayList;
import java.util.List;

public class CleanDemoLot013 {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: CleanDemoLot013 <mongoUri> <dbName>");
            System.exit(1);
        }
        String uri = args[0];
        String dbName = args[1];
        if (!dbName.endsWith("_dev") && !dbName.endsWith("_e2e")) {
            System.err.println("SAFETY GUARD ABORTED: Database '" + dbName + "' does not end with _dev or _e2e.");
            System.exit(1);
        }
        try (MongoClient client = MongoClients.create(uri)) {
            MongoDatabase db = client.getDatabase(dbName);
            MongoCollection<Document> batches = db.getCollection("batches");
            Document demoQuery = new Document("sourceLotCode", new Document("$regex", "^DEMO-LOT-"));
            Document leftoverQuery = new Document("$or", List.of(
                new Document("sourceLotCode", "DEMO-LOT-013"),
                new Document("batchCode", "TX-2026-10-013"),
                new Document("batchCode", "TX-2000-01-013")
            ));

            long beforeTotal = batches.countDocuments();
            long beforeDemo = batches.countDocuments(demoQuery);
            List<Document> beforeLeftovers = batches.find(leftoverQuery).into(new ArrayList<>());
            System.out.println("BEFORE [" + dbName + "]: totalBatches=" + beforeTotal + ", demoLotCount=" + beforeDemo + ", leftover013Count=" + beforeLeftovers.size());
            for (Document doc : beforeLeftovers) {
                System.out.println("  FOUND LEFTOVER: _id=" + doc.get("_id") + ", batchCode=" + doc.getString("batchCode") + ", sourceLotCode=" + doc.getString("sourceLotCode"));
            }

            DeleteResult del = batches.deleteMany(leftoverQuery);
            System.out.println("DELETED [" + dbName + "]: deletedCount=" + del.getDeletedCount());

            MongoCollection<Document> counters = db.getCollection("counters");
            counters.updateMany(
                new Document("seq", 13L),
                new Document("$set", new Document("seq", 12L))
            );

            long afterTotal = batches.countDocuments();
            long afterDemo = batches.countDocuments(demoQuery);
            long afterLeftover = batches.countDocuments(leftoverQuery);
            System.out.println("AFTER  [" + dbName + "]: totalBatches=" + afterTotal + ", demoLotCount=" + afterDemo + ", leftover013Count=" + afterLeftover);
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
