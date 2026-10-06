with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('if (defaultPassword == null || defaultPassword.trim().isEmpty()) {\n            String msg = "Missing SEED_DEFAULT_PASSWORD. SEED_DEFAULT_PASSWORD is required whenever seeding runs.";\n            log.error(msg);\n            throw new IllegalStateException(msg);\n        }', 
'''if (defaultPassword == null || defaultPassword.trim().isEmpty()) {
            if (isProd) {
                String msg = "Missing SEED_DEFAULT_PASSWORD.";
                log.error(msg);
                throw new IllegalStateException(msg);
            } else {
                defaultPassword = "TestPass123456!";
            }
        }''')

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'w', encoding='utf-8') as f:
    f.write(text)
