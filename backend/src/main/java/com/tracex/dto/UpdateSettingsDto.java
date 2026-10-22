package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;

/**
 * Display preferences synced to the account (PATCH /api/v1/auth/me/settings).
 * Every field is optional; a missing field keeps its stored value. Values match the frontend's
 * `src/lib/prefs.ts` unions.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateSettingsDto {

    @Pattern(regexp = "light|dark|system", message = "mode must be light, dark, or system")
    private String mode;

    @Pattern(regexp = "editorial|obsidian|emerald", message = "palette must be editorial, obsidian, or emerald")
    private String palette;

    @Pattern(regexp = "auto|cobalt|emerald|amber|rose", message = "accent must be auto, cobalt, emerald, amber, or rose")
    private String accent;

    private Boolean showPageImages;

    public UpdateSettingsDto() {
    }

    public UpdateSettingsDto(String mode, String palette, String accent, Boolean showPageImages) {
        this.mode = mode;
        this.palette = palette;
        this.accent = accent;
        this.showPageImages = showPageImages;
    }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getPalette() { return palette; }
    public void setPalette(String palette) { this.palette = palette; }
    public String getAccent() { return accent; }
    public void setAccent(String accent) { this.accent = accent; }
    public Boolean getShowPageImages() { return showPageImages; }
    public void setShowPageImages(Boolean showPageImages) { this.showPageImages = showPageImages; }
}
