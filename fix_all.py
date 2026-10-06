# -*- coding: utf-8 -*-
import re

# Fix AppConfig
with open('backend/src/main/java/com/tracex/config/AppConfig.java', 'r', encoding='utf-8') as f:
    text = f.read()

# find multiple clock() and remove duplicates
first_clock = text.find('public Clock clock()')
second_clock = text.find('public Clock clock()', first_clock + 1)
if second_clock != -1:
    # remove the second one
    # it's 4 lines: @Bean public Clock clock() { return Clock.system(ZoneId.of(businessTimezone)); }
    text = re.sub(r'(@Bean\s+public Clock clock\(\) \{.*?\})', r'\1', text, count=1, flags=re.DOTALL) # keep first
    # actually let's just do manual replace
    pass # I'll do this in a sec

# I will write the actual replacements directly.
