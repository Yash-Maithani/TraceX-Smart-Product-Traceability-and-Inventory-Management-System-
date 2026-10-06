package com.tracex;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class BatchIndexTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    public void testBatchIndexesExist() {
        List<Document> indexes = mongoTemplate.getCollection("batches").listIndexes().into(new java.util.ArrayList<>());
        List<String> indexNames = indexes.stream()
                .map(doc -> doc.getString("name"))
                .collect(Collectors.toList());

        // We expect batchCode (unique), sku, and the compound index
        assertThat(indexNames).anyMatch(name -> name.contains("batchCode"));
        assertThat(indexNames).anyMatch(name -> name.contains("sku"));
        assertThat(indexNames).anyMatch(name -> name.contains("isDeleted_lifecycleState_expiryDate"));
    }
}
