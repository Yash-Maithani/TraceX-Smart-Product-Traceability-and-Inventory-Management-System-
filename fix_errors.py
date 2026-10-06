# -*- coding: utf-8 -*-
import re

# Fix SeedRunner.java
with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'r', encoding='utf-8') as f:
    text = f.read()

if 'import java.time.temporal.ChronoUnit;' not in text:
    text = text.replace('import java.util.Optional;', 'import java.util.Optional;\nimport java.time.temporal.ChronoUnit;\nimport java.time.ZoneId;')

if 'import com.tracex.model.Product;' not in text:
    text = text.replace('import org.springframework.stereotype.Service;', 'import org.springframework.stereotype.Service;\nimport com.tracex.model.Product;\nimport com.tracex.model.Batch;')

text = text.replace('logger.info', 'System.out.println')
text = text.replace('logger.warn', 'System.out.println')

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'w', encoding='utf-8') as f:
    f.write(text)

# Fix BatchController.java
with open('backend/src/main/java/com/tracex/controller/BatchController.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import com.tracex.security.RequestIdContext;', 'import com.tracex.util.RequestIdContext;')
text = text.replace('principal.getRole().name()', 'principal.getUser().getRole().name()')
text = text.replace('principal.isSuperAdmin()', 'principal.getUser().isSuperAdmin()')
text = text.replace('ApiResponse.error(ErrorCode.CONFLICT, e.getMessage())', 'ApiResponse.error(ErrorCode.CONFLICT, e.getMessage(), RequestIdContext.getRequestId())')

with open('backend/src/main/java/com/tracex/controller/BatchController.java', 'w', encoding='utf-8') as f:
    f.write(text)

# Fix ProductController.java
with open('backend/src/main/java/com/tracex/controller/ProductController.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import com.tracex.security.RequestIdContext;', 'import com.tracex.util.RequestIdContext;')

with open('backend/src/main/java/com/tracex/controller/ProductController.java', 'w', encoding='utf-8') as f:
    f.write(text)
