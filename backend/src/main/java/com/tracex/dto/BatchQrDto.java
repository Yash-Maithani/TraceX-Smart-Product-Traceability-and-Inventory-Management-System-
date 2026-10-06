package com.tracex.dto;

public class BatchQrDto {

    private String qrCodeDataUrl;
    private String qrAbsoluteUrl;

    public BatchQrDto() {
    }

    public BatchQrDto(String qrCodeDataUrl, String qrAbsoluteUrl) {
        this.qrCodeDataUrl = qrCodeDataUrl;
        this.qrAbsoluteUrl = qrAbsoluteUrl;
    }

    public String getQrCodeDataUrl() { return qrCodeDataUrl; }
    public void setQrCodeDataUrl(String qrCodeDataUrl) { this.qrCodeDataUrl = qrCodeDataUrl; }

    public String getQrAbsoluteUrl() { return qrAbsoluteUrl; }
    public void setQrAbsoluteUrl(String qrAbsoluteUrl) { this.qrAbsoluteUrl = qrAbsoluteUrl; }
}
