import re

with open('backend/src/test/java/com/tracex/RouteCoverageTest.java', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('phase <= 2', 'phase <= 3')
content = content.replace('phase > 2', 'phase > 3')
content = content.replace('Phase <= 2', 'Phase <= 3')

with open('backend/src/test/java/com/tracex/RouteCoverageTest.java', 'w', encoding='utf-8') as f:
    f.write(content)
