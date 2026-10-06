# -*- coding: utf-8 -*-
with open('backend/src/test/java/com/tracex/ProductAndBatchTests.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('u.setStatus("ACTIVE");', 'u.setActive(true);')
with open('backend/src/test/java/com/tracex/ProductAndBatchTests.java', 'w', encoding='utf-8') as f:
    f.write(text)

with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'r', encoding='utf-8') as f:
    text = f.read()

helper = '''
    private static final Logger logger = LoggerFactory.getLogger(RbacMatrixTest.class);

    private Path findPermissionMatrixPath() {
        return Path.of("../docs/permission-matrix.csv");
    }
'''
if 'findPermissionMatrixPath()' not in text:
    text = text.replace('public class RbacMatrixTest {', 'public class RbacMatrixTest {' + helper)

with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'w', encoding='utf-8') as f:
    f.write(text)
