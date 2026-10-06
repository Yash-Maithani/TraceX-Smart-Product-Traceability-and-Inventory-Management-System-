# -*- coding: utf-8 -*-
import re

# Fix SeedRunner.java
with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import java.util.Optional;', 'import java.util.Optional;\nimport java.time.temporal.ChronoUnit;\nimport java.time.ZoneId;')

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'w', encoding='utf-8') as f:
    f.write(text)

# Fix BatchController.java
with open('backend/src/main/java/com/tracex/controller/BatchController.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('RequestIdContext.getRequestId()', 'RequestIdContext.getOrCreate()')

with open('backend/src/main/java/com/tracex/controller/BatchController.java', 'w', encoding='utf-8') as f:
    f.write(text)

# Fix ProductController.java
with open('backend/src/main/java/com/tracex/controller/ProductController.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('RequestIdContext.getRequestId()', 'RequestIdContext.getOrCreate()')

with open('backend/src/main/java/com/tracex/controller/ProductController.java', 'w', encoding='utf-8') as f:
    f.write(text)

