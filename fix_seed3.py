# -*- coding: utf-8 -*-
import re

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the broken constructor and fields
fields_and_constructor = '''    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessRequestRepository accessRequestRepository;
    private final AuditService auditService;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final Clock clock;
    private final MongoTemplate mongoTemplate;
    private final org.springframework.core.env.Environment environment;

    @Value("${tracex.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${SEED_DEFAULT_PASSWORD:}")
    private String defaultPassword;

    @Value("${tracex.business.timezone:Asia/Kolkata}")
    private String businessTimezone;

    public SeedRunner(UserRepository userRepository, PasswordEncoder passwordEncoder,
                      AccessRequestRepository accessRequestRepository, AuditService auditService,
                      ProductRepository productRepository, BatchRepository batchRepository,
                      Clock clock, MongoTemplate mongoTemplate, org.springframework.core.env.Environment environment) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessRequestRepository = accessRequestRepository;
        this.auditService = auditService;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.clock = clock;
        this.mongoTemplate = mongoTemplate;
        this.environment = environment;
    }'''

text = re.sub(
    r'private final UserRepository userRepository;.*?\n\s*public SeedRunner\(.*?\) \{.*?\}',
    fields_and_constructor, text, flags=re.DOTALL)

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'w', encoding='utf-8') as f:
    f.write(text)

with open('backend/src/main/java/com/tracex/exception/GlobalExceptionHandler.java', 'r', encoding='utf-8') as f:
    eh = f.read()
eh = eh.replace('logger.warn("Optimistic locking failure: {}", ex.getMessage());', 'System.out.println("Optimistic locking failure: " + ex.getMessage());')
eh = eh.replace('ApiResponse.error(ErrorCode.CONFLICT, "Resource was modified concurrently. Please retry.")', 'ApiResponse.error(ErrorCode.CONFLICT, "Resource was modified concurrently. Please retry.", com.tracex.util.RequestIdContext.getOrCreate())')
with open('backend/src/main/java/com/tracex/exception/GlobalExceptionHandler.java', 'w', encoding='utf-8') as f:
    f.write(eh)

