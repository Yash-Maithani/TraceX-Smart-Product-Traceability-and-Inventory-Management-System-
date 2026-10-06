package com.tracex;

import com.tracex.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

public class ErrorCodeSpecSyncTest {

    private static final Pattern CODE_ROW_PATTERN = Pattern.compile("^\\|\\s*`([A-Z0-9_]+)`\\s*\\|.*");

    @Test
    @DisplayName("Assert that every ErrorCode enum value is in SPEC §6.2 and every code in SPEC §6.2 exists in ErrorCode enum")
    void testErrorCodeSyncWithSpec() throws IOException {
        Path specPath = findSpecPath();
        assertThat(specPath).isNotNull().exists();

        List<String> lines = Files.readAllLines(specPath);
        Set<String> specCodes = new HashSet<>();
        boolean inSection = false;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.contains("6.2") && trimmed.contains("Error Codes")) {
                inSection = true;
                continue;
            }
            if (inSection) {
                if (trimmed.startsWith("###") && !trimmed.contains("6.2")) {
                    break; // End of section
                }
                Matcher matcher = CODE_ROW_PATTERN.matcher(trimmed);
                if (matcher.matches()) {
                    specCodes.add(matcher.group(1));
                }
            }
        }

        assertThat(specCodes)
                .as("SPEC §6.2 error codes should not be empty")
                .isNotEmpty();

        Set<String> enumCodes = Arrays.stream(ErrorCode.values())
                .map(Enum::name)
                .collect(Collectors.toSet());

        assertThat(enumCodes)
                .as("ErrorCode enum values must exactly match codes documented in SPEC §6.2")
                .isEqualTo(specCodes);
    }

    private Path findSpecPath() {
        Path current = Path.of("").toAbsolutePath();
        for (int i = 0; i < 4; i++) {
            Path candidate = current.resolve("SPEC.md");
            if (Files.exists(candidate)) {
                return candidate;
            }
            current = current.getParent();
            if (current == null) {
                break;
            }
        }
        return null;
    }
}
