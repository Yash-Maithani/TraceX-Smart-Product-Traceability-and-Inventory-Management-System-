package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.BatchDispatchDto;
import com.tracex.model.Batch;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.FefoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Partial dispatch (pick-list #4): ship part of a batch, keep the rest in the FEFO queue. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class PartialDispatchTests {

    private static final String SKU = "PDT-SKU";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private BatchRepository batchRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private FefoService fefoService;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    private String coordinatorToken;
    private String factoryToken;

    @BeforeEach
    void setUp() {
        coordinatorToken = token("pdt_coord", Role.DISPATCH_COORDINATOR);
        factoryToken = token("pdt_factory", Role.FACTORY_MANAGER);
    }

    @AfterEach
    void tearDown() {
        mongoTemplate.remove(Query.query(Criteria.where("sku").is(SKU)), Batch.class);
    }

    private String token(String username, Role role) {
        User u = userRepository.findByUsername(username).orElseGet(() -> {
            User n = new User(username, passwordEncoder.encode("TestPass123456!"), username + " Name",
                    username + "@tracex.demo", role, false);
            n.setActive(true);
            return userRepository.save(n);
        });
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private Batch saveBatch(int quantity) {
        Batch b = new Batch();
        b.setBatchCode("TX-PDT-" + UUID.randomUUID().toString().substring(0, 6));
        b.setSku(SKU);
        b.setProductName("Partial Dispatch Jam");
        b.setSourceLotCode("PDT-LOT");
        b.setFarmerName("Farmer");
        b.setVillage("Village");
        b.setQuantityProduced(quantity);
        b.setUnit("Units");
        b.setPackDate(LocalDate.now().minusDays(3));
        b.setExpiryDate(LocalDate.now().plusDays(60));
        b.setLifecycleState("ACTIVE");
        return batchRepository.save(b);
    }

    private ResultActions dispatch(String batchId, String buyer, Integer quantity) throws Exception {
        BatchDispatchDto req = new BatchDispatchDto(buyer, null, null);
        req.setQuantity(quantity);
        return mockMvc.perform(patch("/api/v1/batches/" + batchId + "/dispatch")
                .header("Authorization", "Bearer " + coordinatorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)));
    }

    @Test
    @DisplayName("Shipping part of a batch keeps it active and in the FEFO queue with the remaining quantity")
    void partialDispatchKeepsBatchInQueue() throws Exception {
        Batch b = saveBatch(120);

        dispatch(b.getId(), "Hill Mart", 40)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("ACTIVE"))
                .andExpect(jsonPath("$.data.quantityDispatched").value(40))
                .andExpect(jsonPath("$.data.quantityRemaining").value(80))
                .andExpect(jsonPath("$.data.dispatchHistory[0].quantity").value(40))
                .andExpect(jsonPath("$.data.dispatchHistory[0].buyerName").value("Hill Mart"));

        FefoService.FefoResult fefo = fefoService.getFefoQueue(null, SKU);
        assertThat(fefo.getQueue()).hasSize(1);
        assertThat(fefo.getQueue().get(0).getQuantityRemaining()).isEqualTo(80);

        dispatch(b.getId(), "Valley Stores", 50)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("ACTIVE"))
                .andExpect(jsonPath("$.data.quantityRemaining").value(30))
                .andExpect(jsonPath("$.data.dispatchHistory.length()").value(2));
    }

    @Test
    @DisplayName("Shipping the last units, or leaving quantity out, completes the batch")
    void finalShipmentCompletesBatch() throws Exception {
        Batch b = saveBatch(100);
        dispatch(b.getId(), "Hill Mart", 70).andExpect(status().isOk());

        dispatch(b.getId(), "Valley Stores", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.status").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.quantityRemaining").value(0))
                .andExpect(jsonPath("$.data.dispatchHistory[1].quantity").value(30));

        assertThat(fefoService.getFefoQueue(null, SKU).getQueue()).isEmpty();
        dispatch(b.getId(), "Anyone", 1).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Shipping more than is left, or less than one, is rejected and changes nothing")
    void overShipmentIsRejected() throws Exception {
        Batch b = saveBatch(50);
        dispatch(b.getId(), "Hill Mart", 30).andExpect(status().isOk());

        dispatch(b.getId(), "Hill Mart", 21)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("quantity"));
        dispatch(b.getId(), "Hill Mart", 0).andExpect(status().isUnprocessableEntity());

        Batch reloaded = batchRepository.findById(b.getId()).orElseThrow();
        assertThat(reloaded.getQuantityDispatched()).isEqualTo(30);
        assertThat(reloaded.getDispatchHistory()).hasSize(1);
    }

    @Test
    @DisplayName("Older batches without a shipped count dispatch whole, as before")
    void legacyBatchDispatchesWhole() throws Exception {
        Batch b = saveBatch(60);
        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(b.getId())), new Update().unset("quantityDispatched"), Batch.class);

        dispatch(b.getId(), "Hill Mart", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.quantityDispatched").value(60));
    }

    @Test
    @DisplayName("A batch dispatched before partial dispatch existed shows nothing left in stock")
    void legacyDispatchedBatchShowsNoStock() throws Exception {
        Batch b = saveBatch(90);
        b.setLifecycleState("DISPATCHED");
        batchRepository.save(b);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/batches/" + b.getId())
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.quantityDispatched").value(90))
                .andExpect(jsonPath("$.data.quantityRemaining").value(0));
    }

    @Test
    @DisplayName("Produced quantity cannot be corrected below what was already shipped")
    void cannotCorrectQuantityBelowShipped() throws Exception {
        Batch b = saveBatch(100);
        dispatch(b.getId(), "Hill Mart", 60).andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/raw-material")
                        .header("Authorization", "Bearer " + factoryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityProduced\":50}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("quantityProduced"));
    }
}
