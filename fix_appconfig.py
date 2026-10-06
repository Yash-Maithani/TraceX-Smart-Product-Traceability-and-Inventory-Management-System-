with open('backend/src/main/java/com/tracex/config/AppConfig.java', 'r', encoding='utf-8') as f:
    text = f.read()

import_line = 'import java.time.Clock;\nimport java.time.ZoneId;\nimport org.springframework.beans.factory.annotation.Value;\n'
text = text.replace('import org.springframework.context.annotation.Configuration;', 'import org.springframework.context.annotation.Configuration;\n' + import_line)

bean_code = '''
    @Value("${tracex.business.timezone:Asia/Kolkata}")
    private String businessTimezone;

    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of(businessTimezone));
    }
'''
last_brace = text.rfind('}')
text = text[:last_brace] + bean_code + '\n}'

with open('backend/src/main/java/com/tracex/config/AppConfig.java', 'w', encoding='utf-8') as f:
    f.write(text)
