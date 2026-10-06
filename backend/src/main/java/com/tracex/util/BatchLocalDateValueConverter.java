package com.tracex.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.convert.PropertyValueConverter;
import org.springframework.data.convert.ValueConversionContext;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;

/**
 * Property-scoped converter for Batch.packDate and Batch.expiryDate (D-17, R1, R2).
 * Stores date-only values in MongoDB as ISO-8601 "YYYY-MM-DD" strings and tolerates
 * unparseable/legacy values on Batch date fields only (returning null instead of throwing),
 * while leaving security-critical Instant fields (inviteExpiry, otpExpiry, resetTokenExpiry)
 * strictly validated.
 */
public class BatchLocalDateValueConverter implements PropertyValueConverter<Object, Object, ValueConversionContext<?>> {

    private static final Logger log = LoggerFactory.getLogger(BatchLocalDateValueConverter.class);

    @Override
    public LocalDate read(Object value, ValueConversionContext<?> context) {
        LocalDate parsed = tryParseLocalDate(value);
        if (parsed == null && value != null) {
            log.warn("Unparseable Batch LocalDate value '{}' encountered during MongoDB read; returning null", value);
        }
        return parsed;
    }

    @Override
    public Object write(Object value, ValueConversionContext<?> context) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate ld) {
            return ld.toString();
        }
        return value;
    }

    public static LocalDate tryParseLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate ld) {
            return ld;
        }
        if (value instanceof Date d) {
            return d.toInstant().atZone(ZoneOffset.UTC).toLocalDate();
        }
        if (value instanceof Instant inst) {
            return inst.atZone(ZoneOffset.UTC).toLocalDate();
        }
        String str = value.toString();
        if (!str.matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)) {
            return null;
        }
        try {
            return LocalDate.parse(str);
        } catch (Exception ignored) {
            return null;
        }
    }
}
