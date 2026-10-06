package com.tracex.util;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Jackson deserializer for LocalDate fields on batch request DTOs.
 * Primarily parses ISO-8601 date-only strings ("YYYY-MM-DD") with zero time-zone shift,
 * while also accepting ISO-8601 instant/offset strings if provided by callers.
 */
public class FlexibleLocalDateDeserializer extends JsonDeserializer<LocalDate> {

    @Override
    public LocalDate deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String text = p.getText();
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (Exception ignored) {
            // Try ISO instant or offset datetime
        }
        try {
            return Instant.parse(trimmed).atZone(ZoneOffset.UTC).toLocalDate();
        } catch (Exception ignored) {
            // Try offset datetime
        }
        try {
            return OffsetDateTime.parse(trimmed).toLocalDate();
        } catch (Exception ex) {
            throw InvalidFormatException.from(
                    p,
                    "Cannot deserialize value of type `java.time.LocalDate` from String \"" + trimmed + "\": expected format YYYY-MM-DD",
                    trimmed,
                    LocalDate.class
            );
        }
    }
}
