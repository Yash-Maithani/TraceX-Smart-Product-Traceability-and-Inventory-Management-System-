package com.tracex.config;

import com.tracex.util.MutableClock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.ZoneId;

@Configuration
public class TestClockConfig {

    @Bean
    @Primary
    public MutableClock testClock(@Value("${tracex.business.timezone:Asia/Kolkata}") String businessTimezone) {
        return new MutableClock(ZoneId.of(businessTimezone));
    }
}
