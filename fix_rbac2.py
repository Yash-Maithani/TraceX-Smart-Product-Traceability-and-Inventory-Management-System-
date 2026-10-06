# -*- coding: utf-8 -*-
with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('logger.info', 'log.info')

helper = '''
    private java.nio.file.Path findPermissionMatrixPath() {
        return java.nio.file.Path.of("../docs/permission-matrix.csv");
    }
'''
if 'private java.nio.file.Path findPermissionMatrixPath()' not in text:
    last_brace = text.rfind('}')
    text = text[:last_brace] + helper + '\n}'

with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'w', encoding='utf-8') as f:
    f.write(text)
