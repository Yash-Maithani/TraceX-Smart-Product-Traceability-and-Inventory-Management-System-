import re

with open('backend/src/main/java/com/tracex/service/BatchService.java', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern: auditService.record("ACTION", username, "BATCH", saved.getId(), requestId, "message");
# Replace with: auditService.record(null, username, "ACTION", "BATCH", saved.getId(), "message");
text = re.sub(
    r'auditService\.record\("([^"]+)",\s*([^,]+),\s*"BATCH",\s*([^,]+),\s*requestId,\s*(.+?)\);',
    r'auditService.record(null, \2, "\1", "BATCH", \3, \4);',
    text
)

with open('backend/src/main/java/com/tracex/service/BatchService.java', 'w', encoding='utf-8') as f:
    f.write(text)
